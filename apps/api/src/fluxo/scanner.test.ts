import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { configuracao, documento, fichaRecepcao, leituraDocumento, pessoa, tarefaRecepcao, usuario } from '../banco/esquema.ts'
import type { Drive, ItemMudado } from '../drive.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { criarLeitor } from './leitura.ts'
import { MARCA_DO_SCANNER, olharOScanner, tipoPeloNome } from './scanner.ts'

// GGVP-158 P4.3: o papel do scanner entra pelo Drive, pela lista de mudanças; o n8n não muda.

const SENHA = 'senha-do-portal-1'
const PASTAS = { clientes: 'clientes', revisar: 'revisar' }
const relogio = new Date('2026-10-13T15:00:00Z')
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>

/** O Drive de mentira do scanner: a lista de mudanças que o teste põe, as pastas e o que foi baixado. */
function driveDoScanner() {
  let rodada = 0
  const d = { mudancas: [] as ItemMudado[], pastas: new Map<string, { nome: string; pais: string[] }>(), baixados: [] as string[], falhar: new Set<string>() }
  const drive = {
    // Sem marca, o Google devolve só a marca de agora: o que mudou antes dela não aparece depois.
    mudancas: async (marca: string | null) => {
      const itens = d.mudancas.splice(0)
      return marca === null ? { itens: [], marca: 'm0' } : { itens, marca: `m${++rodada}` }
    },
    onde: async (id: string) => d.pastas.get(id) ?? { nome: '', pais: [] },
    baixar: async (id: string) => {
      if (d.falhar.delete(id)) throw new Error('Drive: 503 Service Unavailable')
      d.baixados.push(id)
      return Buffer.from(`%PDF-1.4 ${id}`)
    },
  } as unknown as Drive
  return { d, drive }
}
const arquivo = (id: string, nome: string, pais: string[], extra: Partial<ItemMudado> = {}): ItemMudado => ({ id, nome, mime: 'application/pdf', pais, doPortal: false, fora: false, ...extra })

/** A IA de mentira lê o CNIS da Joana. */
function leitor() {
  const lido = { tipo: 'cnis', data: '2026-09-30', nome: 'Joana Ribeiro', cpf: '', rg: '', endereco: '', assinado: null, dataEmBranco: false, legivel: true, confianca: 90, emitente: '', registro: '' }
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(lido) } }] })))
  return criarLeitor({ ia: criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste-openai' }, fetch, agora: () => relogio }), agora: () => relogio })
}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
async function lead(nome: string, cpf?: string) {
  const r = await app.inject({
    method: 'POST',
    url: '/api/fichas',
    cookies: await cookieDe('ana'),
    payload: { nome, idade: 66, pretende: 'Quer o BPC.', telefone: '11987654321', cpf, beneficioInteresse: 'loas-idoso', outraPessoa: true },
  })
  return r.json().id as string
}
const ligarPasta = (pessoaId: string, pastaId: string) => banco.update(pessoa).set({ drivePastaId: pastaId }).where(eq(pessoa.id, pessoaId))
const fichaDe = async (id: string) => (await banco.select().from(fichaRecepcao).where(eq(fichaRecepcao.pessoaId, id)))[0].documento as { arquivos: { nome: string; tipo: string; origem: string }[]; historico: { oQue: string }[] }

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => relogio })
  await banco.insert(usuario).values({ email: 'ana@exemplo.ggv', nome: 'ana', senhaHash: await bcrypt.hash(SENHA, 4), perfis: ['atendimento'], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-158 P4.3 · o papel do scanner entra pelo Drive', () => {
  it('a primeira rodada só guarda a marca; o arquivo novo na pasta ligada entra, aponta para o Drive e é lido; a mesma mudança não repete', async () => {
    const { d, drive } = driveDoScanner()
    const joana = await lead('Joana Ribeiro', '52998224725')
    await ligarPasta(joana, 'pasta-joana')
    const rodar = () => olharOScanner({ banco, drive, pastas: PASTAS, leitor: leitor(), agora: () => relogio })

    d.mudancas.push(arquivo('antes', 'CNIS - Joana Ribeiro - 2026-10-01.pdf', ['pasta-joana']))
    expect(await rodar()).toEqual({ entraram: 0, ficaramDeFora: 0, falhas: 0 })
    expect((await banco.select().from(configuracao).where(eq(configuracao.chave, MARCA_DO_SCANNER)))[0].valor).toBe('m0')

    d.mudancas.push(arquivo('cnis', 'CNIS - Joana Ribeiro - 2026-10-13.pdf', ['pasta-joana']))
    expect(await rodar()).toEqual({ entraram: 1, ficaramDeFora: 0, falhas: 0 })
    const ficha = await fichaDe(joana)
    expect(ficha.arquivos).toMatchObject([{ nome: 'CNIS - Joana Ribeiro - 2026-10-13.pdf', tipo: 'cnis', origem: 'scanner', aguardaLeitura: true }])
    expect(ficha.historico.at(-1)).toMatchObject({ quem: 'Automação do scanner', oQue: 'Chegou pelo scanner: 1 documento na pasta do Drive' })
    const [d1] = await banco.select().from(documento)
    expect([d1.pessoaId, d1.origem, d1.chaveArmazenamento, d1.driveArquivoId, d1.drivePendente]).toEqual([joana, 'scanner', 'drive:cnis', 'cnis', false])
    expect((await banco.select().from(leituraDocumento)).map((l) => (l.dados as { tipo: string; situacao: string }).situacao)).toEqual(['a-conferir'])

    d.mudancas.push(arquivo('cnis', 'CNIS - Joana Ribeiro - 2026-10-13.pdf', ['pasta-joana']))
    expect(await rodar()).toEqual({ entraram: 0, ficaramDeFora: 0, falhas: 0 })
    expect(await banco.select().from(documento)).toHaveLength(1)
  })

  it('fica fora: o que o portal mandou, a lixeira, "A REVISAR" e o que não é PDF nem imagem; nada é baixado', async () => {
    const { d, drive } = driveDoScanner()
    await ligarPasta(await lead('Joana Ribeiro', '52998224725'), 'pasta-joana')
    const rodar = () => olharOScanner({ banco, drive, pastas: PASTAS, leitor: leitor(), agora: () => relogio })
    await rodar()
    d.mudancas.push(
      arquivo('do-portal', 'Rg - Joana Ribeiro - 2026-10-13.pdf', ['pasta-joana'], { doPortal: true }),
      arquivo('lixeira', 'CNIS.pdf', ['pasta-joana'], { fora: true }),
      arquivo('revisar', 'Lote sem dono.pdf', ['revisar']),
      arquivo('planilha', 'Planilha', ['pasta-joana'], { mime: 'application/vnd.google-apps.spreadsheet' }),
    )
    expect(await rodar()).toEqual({ entraram: 0, ficaramDeFora: 0, falhas: 0 })
    expect(d.baixados).toEqual([])
  })

  it('a pasta não ligada é ligada quando o título leva a uma ficha só; com duas fichas possíveis, nada entra', async () => {
    const { d, drive } = driveDoScanner()
    const joana = await lead('Joana Ribeiro', '52998224725')
    await lead('Maria Souza')
    await lead('Maria Souza')
    const rodar = () => olharOScanner({ banco, drive, pastas: PASTAS, leitor: leitor(), agora: () => relogio })
    await rodar()
    d.pastas.set('pasta-x', { nome: '529.982.247-25 X Joana Ribeiro', pais: ['clientes'] })
    d.pastas.set('pasta-maria', { nome: 'Maria Souza X LOAS - Ab12cd', pais: ['clientes'] })
    d.mudancas.push(arquivo('a', 'CNIS - Joana Ribeiro - 2026-10-13.pdf', ['pasta-x']), arquivo('b', 'RG - Maria Souza - 2026-10-13.pdf', ['pasta-maria']))
    expect(await rodar()).toEqual({ entraram: 1, ficaramDeFora: 1, falhas: 0 })
    expect((await banco.select().from(pessoa).where(eq(pessoa.id, joana)))[0].drivePastaId).toBe('pasta-x')
    expect(d.baixados).toEqual(['a'])
  })

  it('o lote vai à tarefa "Receber documento" aberta, e o laudo que chega avisa o Jurídico', async () => {
    const { d, drive } = driveDoScanner()
    const joana = await lead('Joana Ribeiro', '52998224725')
    await ligarPasta(joana, 'pasta-joana')
    await app.inject({ method: 'POST', url: `/api/fichas/${joana}/encaminhamentos`, cookies: await cookieDe('ana'), payload: { motivo: 'documento', setor: 'Documentação · ADM' } })
    const rodar = () => olharOScanner({ banco, drive, pastas: PASTAS, leitor: leitor(), agora: () => relogio })
    await rodar()
    d.mudancas.push(arquivo('laudo', 'Laudo médico - Joana Ribeiro - 2026-10-13.pdf', ['pasta-joana']))
    await rodar()
    const tarefas = (await banco.select().from(tarefaRecepcao).where(eq(tarefaRecepcao.pessoaId, joana))).map((t) => t.dados as { acao: string; lote?: { status: string; arquivos: { tipo: string }[] } })
    expect(tarefas.find((t) => t.acao === 'Receber documento')?.lote).toMatchObject({ status: 'arquivado', arquivos: [{ tipo: 'laudo' }] })
    expect(tarefas.map((t) => t.acao)).toContain('Analisar laudo novo')
  })

  it('falha ao baixar: a marca não anda, e a rodada seguinte tenta de novo', async () => {
    const { d, drive } = driveDoScanner()
    await ligarPasta(await lead('Joana Ribeiro', '52998224725'), 'pasta-joana')
    const rodar = () => olharOScanner({ banco, drive, pastas: PASTAS, leitor: leitor(), agora: () => relogio })
    await rodar()
    d.falhar.add('cnis')
    d.mudancas.push(arquivo('cnis', 'CNIS - Joana Ribeiro - 2026-10-13.pdf', ['pasta-joana']))
    expect(await rodar()).toEqual({ entraram: 0, ficaramDeFora: 0, falhas: 1 })
    expect((await banco.select().from(configuracao).where(eq(configuracao.chave, MARCA_DO_SCANNER)))[0].valor).toBe('m0')
    d.mudancas.push(arquivo('cnis', 'CNIS - Joana Ribeiro - 2026-10-13.pdf', ['pasta-joana']))
    expect(await rodar()).toEqual({ entraram: 1, ficaramDeFora: 0, falhas: 0 })
  })

  it('o tipo vem do começo do nome, como o n8n nomeia; fora do catálogo, "outro"', () => {
    expect(['Laudo médico - Rita - 2026-10-13.pdf', 'CNIS - Rita - 2026-10-13.pdf', 'RG - Rita.pdf', 'Comprovante de residencia - Rita.pdf', 'Foto do cachorro.jpg'].map(tipoPeloNome)).toEqual([
      'laudo',
      'cnis',
      'rg',
      'comprovante-residencia',
      'outro',
    ])
  })
})
