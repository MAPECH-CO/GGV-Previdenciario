// Teste de verdade no Drive do escritório (GGVP-107). Só roda com as variáveis do Drive; no CI, pula. Na raiz do clone:
//   cd apps/api && node --env-file=../../.env.drive node_modules/vitest/vitest.mjs run src/drive.real.test.ts
// Cuidado com o que já existe lá: o teste só lê o id do Drive compartilhado a partir de "#5. CLIENTES" e cria tudo numa
// pasta própria na raiz, com "CLIENTES" e "A REVISAR" de teste e um cliente inventado. No fim manda para a lixeira só
// essa pasta, e só se tudo lá dentro foi ele que criou.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { armazenamentoLocal, type Armazenamento } from './armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from './banco/conexao.ts'
import { caso, documento, peticao, peticaoVersao, pessoa } from './banco/esquema.ts'
import { criarDrive, criarToken, type Drive, type PastasDoDrive } from './drive.ts'
import { sincronizarDrive } from './fluxo/arquivar.ts'

const { GOOGLE_DRIVE_CREDENCIAIS: credenciais, GOOGLE_DRIVE_PASTA_CLIENTES: clientesDeVerdade } = process.env
const API = 'https://www.googleapis.com/drive/v3/files'
const CLIENTE = 'Cliente Inventado do Teste'
const QUANDO = new Date('2026-10-08T15:00:00Z')

describe.skipIf(!credenciais || !clientesDeVerdade)('Drive de verdade (GGVP-107)', { timeout: 120_000 }, () => {
  const conta = JSON.parse(Buffer.from(credenciais ?? 'e30=', 'base64').toString())
  const autorizacao = criarToken(conta)
  const criados = new Set<string>()
  const real = criarDrive(conta)
  // O mesmo cliente do portal, anotando cada item que cria, para a limpeza só mexer no que é do teste.
  const drive: Drive = {
    ...real,
    criarPasta: async (...a) => {
      const id = await real.criarPasta(...a)
      criados.add(id)
      return id
    },
    enviar: async (a) => {
      const id = await real.enviar(a)
      criados.add(id)
      return id
    },
  }
  const google = async (caminho: string, init: { method?: string; body?: string } = {}) => {
    const r = await fetch(`${API}${caminho}`, { ...init, headers: { authorization: await autorizacao(), 'content-type': 'application/json' } })
    if (!r.ok) throw new Error(`Drive: ${r.status} ${await r.text()}`)
    return r.json()
  }
  let raiz = ''
  let pastas: PastasDoDrive
  let arquivos: Armazenamento
  let banco: Banco
  let fechar: () => Promise<void>
  let casoId = ''
  let laudoId = ''

  beforeAll(async () => {
    const { driveId } = await google(`/${clientesDeVerdade}?supportsAllDrives=true&fields=driveId`)
    raiz = await drive.criarPasta(`TESTE DO PORTAL (MAPECH) - pode apagar - ${new Date().toISOString()}`, driveId, `teste:${Date.now()}`)
    const [clientes, revisar] = await Promise.all(['CLIENTES', 'A REVISAR'].map((n) => drive.criarPasta(n, raiz, `teste:${raiz}:${n}`)))
    pastas = { clientes, revisar }

    ;({ banco, fechar } = await abrirBancoEmbutido())
    arquivos = armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-')))
    const [p] = await banco.insert(pessoa).values({ nome: CLIENTE }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'judicial' }).returning()
    casoId = c.id
    const guardar = async (tipo: string, nome: string) => {
      const chave = `casos/${casoId}/${tipo}`
      await arquivos.salvar(chave, Buffer.from(`%PDF-1.4 ${tipo} do teste`), 'application/pdf')
      const [d] = await banco
        .insert(documento)
        .values({ casoId, tipo, chaveArmazenamento: chave, nomeOriginal: nome, mime: 'application/pdf', tamanho: 20, hashSha256: 'h', origem: 'portal', criadoEm: QUANDO })
        .returning()
      return d
    }
    laudoId = (await guardar('laudo', 'laudo.pdf')).id
    const carta = await guardar('carta_indeferimento', 'carta.pdf')
    const [pe] =await banco.insert(peticao).values({ casoId, tipo: 'inicial' }).returning()
    await banco.insert(peticaoVersao).values({
      peticaoId: pe.id,
      numero: 1,
      conteudo: 'Petição do teste',
      hash: 'h',
      geradaPor: 'teste',
      pacote: [{ documentoId: carta.id, origemId: carta.id, nome: 'carta.pdf', hash: 'h', papel: 'carta' }],
      pacoteGeradoEm: QUANDO,
    })
    expect(await sincronizarDrive(banco, drive, pastas, arquivos)).toEqual({ enviados: 3, falhas: [] })
  })

  afterAll(async () => {
    await fechar?.()
    if (!raiz) return
    // Só o que o teste criou: se aparecer lá dentro algo que ele não criou, não apaga nada e avisa.
    const dentro = async (id: string): Promise<string[]> => {
      const filhos = (await google(`?supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id)&q=${encodeURIComponent(`'${id}' in parents and trashed = false`)}`)).files as { id: string }[]
      return [...filhos.map((f) => f.id), ...(await Promise.all(filhos.map((f) => dentro(f.id)))).flat()]
    }
    const estranhos = (await dentro(raiz)).filter((id) => !criados.has(id))
    if (estranhos.length) throw new Error(`A pasta de teste tem ${estranhos.length} item(ns) que o teste não criou: nada foi para a lixeira.`)
    await google(`/${raiz}?supportsAllDrives=true`, { method: 'PATCH', body: JSON.stringify({ trashed: true }) })
  })

  it('CA1 · cria a pasta do cliente e arquiva cada documento com "Tipo - Nome - AAAA-MM-DD"; CA6 · o pacote', async () => {
    const [pasta] = await drive.pastas(pastas.clientes)
    expect(pasta.nome).toBe(`${CLIENTE} X A CLASSIFICAR`)
    expect((await drive.nomes(pasta.id)).sort()).toEqual([
      `Carta indeferimento - ${CLIENTE} - 2026-10-08.pdf`,
      `Laudo médico - ${CLIENTE} - 2026-10-08.pdf`,
      'Pacote de protocolo - 2026-10-08',
    ])
    const doPacote = (await drive.pastas(pasta.id))[0]
    expect(await drive.nomes(doPacote.id)).toEqual(['carta.pdf'])
  })

  it('CA3 · rodar de novo não duplica, nem quando o portal perdeu a resposta do Drive', async () => {
    // Como se o Drive tivesse gravado e a resposta não chegasse: o portal acha pela marca e não envia de novo.
    await banco.update(documento).set({ drivePendente: true, driveArquivoId: null }).where(eq(documento.id, laudoId))
    const antes = criados.size
    expect(await sincronizarDrive(banco, drive, pastas, arquivos)).toEqual({ enviados: 1, falhas: [] })
    expect(criados.size).toBe(antes)
    const [pasta] = await drive.pastas(pastas.clientes)
    expect((await drive.nomes(pasta.id)).filter((n) => n.startsWith('Laudo médico'))).toHaveLength(1)
  })

  it('CA2 · mover o arquivo no Drive não quebra o vínculo; CA4 · nenhuma pasta pública', async () => {
    const id = await drive.achar(`documento:${laudoId}`)
    const [pasta] = await drive.pastas(pastas.clientes)
    await google(`/${id}?supportsAllDrives=true&addParents=${pastas.revisar}&removeParents=${pasta.id}`, { method: 'PATCH', body: '{}' })
    expect(await drive.onde(id!)).toEqual({ nome: `Laudo médico - ${CLIENTE} - 2026-10-08.pdf`, pais: [pastas.revisar] })
    for (const item of [raiz, pasta.id, id!]) {
      const { permissions } = await google(`/${item}/permissions?supportsAllDrives=true&fields=permissions(type)`)
      expect((permissions as { type: string }[]).map((p) => p.type)).not.toContain('anyone')
    }
  })
})
