import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal, type Armazenamento } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, documento, peticao, peticaoVersao, pessoa, resultadoInss, tarefa } from '../banco/esquema.ts'
import type { Drive, PastasDoDrive } from '../drive.ts'
import { PASSO_DO_DRIVE, TITULO_DA_FALHA, pastaDoTitulo, sincronizarDrive } from './arquivar.ts'

type Item = { id: string; nome: string; pai: string; pasta: boolean; marca: string; conteudo?: string }

/** O Drive na memória. `falhar(n)`: os próximos n envios falham; `perderResposta(n)`: gravam, mas a resposta se perde. */
function driveNaMemoria(pastasDeClientes: string[] = []) {
  const itens: Item[] = []
  let falhas = 0
  let perdidas = 0
  const novo = (i: Omit<Item, 'id'>) => {
    const id = `d${itens.length + 1}`
    itens.push({ id, ...i })
    return id
  }
  for (const nome of pastasDeClientes) novo({ nome, pai: 'clientes', pasta: true, marca: '' })
  const drive: Drive = {
    pastas: async (pai) => itens.filter((i) => i.pai === pai && i.pasta).map(({ id, nome }) => ({ id, nome })),
    nomes: async (pai) => itens.filter((i) => i.pai === pai).map((i) => i.nome),
    achar: async (marca) => itens.find((i) => i.marca === marca)?.id ?? null,
    criarPasta: async (nome, pai, marca) => novo({ nome, pai, pasta: true, marca }),
    async enviar({ nome, paiId, conteudo, marca }) {
      if (falhas > 0 && falhas--) throw new Error('Drive: 503 Service Unavailable')
      const id = novo({ nome, pai: paiId, pasta: false, marca, conteudo: conteudo.toString() })
      if (perdidas > 0 && perdidas--) throw new Error('Drive: tempo esgotado')
      return id
    },
    onde: async (id) => {
      const i = itens.find((x) => x.id === id)!
      return { nome: i.nome, pais: [i.pai] }
    },
  }
  const dentro = (pai: string) => itens.filter((i) => i.pai === pai).map((i) => i.nome)
  const pastaChamada = (nome: string) => itens.find((i) => i.pasta && i.nome === nome)?.id
  return { drive, itens, dentro, pastaChamada, falhar: (n: number) => void (falhas = n), perderResposta: (n: number) => void (perdidas = n) }
}

const PASTAS: PastasDoDrive = { clientes: 'clientes', revisar: 'revisar' }
let banco: Banco
let fechar: () => Promise<void>
let arquivos: Armazenamento

async function cliente(nome: string, cpf?: string) {
  const [p] = await banco.insert(pessoa).values({ nome, cpf }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'judicial' }).returning()
  return { pessoaId: p.id, casoId: c.id }
}

async function guardar(casoId: string, tipo: string, criadoEm = new Date('2026-10-08T15:00:00Z'), extra: Partial<typeof documento.$inferInsert> = {}) {
  const chave = `casos/${casoId}/${crypto.randomUUID()}`
  await arquivos.salvar(chave, Buffer.from(`%PDF-1.4 ${tipo}`), 'application/pdf')
  const [d] = await banco
    .insert(documento)
    .values({ casoId, tipo, chaveArmazenamento: chave, nomeOriginal: `${tipo}.pdf`, mime: 'application/pdf', tamanho: 10, hashSha256: 'h', origem: 'portal', criadoEm, ...extra })
    .returning()
  return d
}

const rodar = (drive: Drive) => sincronizarDrive(banco, drive, PASTAS, arquivos, () => new Date('2026-10-08T15:30:00Z'))
const doc = async (id: string) => (await banco.select().from(documento).where(eq(documento.id, id)))[0]
const tarefasDoDrive = (casoId: string) =>
  banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, PASSO_DO_DRIVE), eq(tarefa.titulo, TITULO_DA_FALHA)))

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  arquivos = armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-')))
})
afterEach(() => fechar())

describe('arquivar no Drive (GGVP-107)', () => {
  it('CA1, CA2 · o primeiro documento cria "<Nome> X A CLASSIFICAR", guarda a pasta no cliente, e cada documento entra nela com "Tipo - Nome - AAAA-MM-DD"', async () => {
    const g = driveNaMemoria()
    const { pessoaId, casoId } = await cliente('Rita Exemplo')
    // 23h de 07/10 em Brasília: a data do nome é a de Brasília.
    const laudo = await guardar(casoId, 'laudo', new Date('2026-10-08T02:00:00Z'))
    const rg = await guardar(casoId, 'rg')
    const outroLaudo = await guardar(casoId, 'laudo', new Date('2026-10-08T02:30:00Z'))

    expect(await rodar(g.drive)).toEqual({ enviados: 3, falhas: [] })
    const pasta = g.pastaChamada('Rita Exemplo X A CLASSIFICAR')!
    expect(g.dentro('clientes')).toEqual(['Rita Exemplo X A CLASSIFICAR'])
    expect(g.dentro(pasta)).toEqual([
      'Laudo médico - Rita Exemplo - 2026-10-07.pdf',
      'Laudo médico - Rita Exemplo - 2026-10-07 (2).pdf',
      'Documento pessoal (RG) - Rita Exemplo - 2026-10-08.pdf',
    ])
    expect((await banco.select().from(pessoa).where(eq(pessoa.id, pessoaId)))[0].drivePastaId).toBe(pasta)

    // CA2: o caso guarda o id; alguém move o arquivo no Drive e o id continua levando a ele.
    const d = await doc(laudo.id)
    expect([d.drivePendente, g.itens.find((i) => i.id === d.driveArquivoId)?.conteudo]).toEqual([false, '%PDF-1.4 laudo'])
    g.itens.find((i) => i.id === d.driveArquivoId)!.pai = 'outra-pasta'
    expect(await g.drive.onde(d.driveArquivoId!)).toEqual({ nome: 'Laudo médico - Rita Exemplo - 2026-10-07.pdf', pais: ['outra-pasta'] })

    // O cliente já tem pasta: o documento novo vai direto para ela, sem procurar nem criar outra.
    await guardar(casoId, 'cnis')
    await rodar(g.drive)
    expect(g.dentro('clientes')).toEqual(['Rita Exemplo X A CLASSIFICAR'])
    expect(g.dentro(pasta)).toContain('CNIS - Rita Exemplo - 2026-10-08.pdf')
    expect([(await doc(rg.id)).drivePendente, (await doc(outroLaudo.id)).drivePendente]).toEqual([false, false])
  })

  it('CA1 · acha a pasta que já existe pela regra do balcão; mais de uma pasta possível vai para "A REVISAR"', async () => {
    const g = driveNaMemoria(['RITA EXEMPLO X BPC LOAS - Fe12ab', '111.444.777-35 X João de Souza', 'Maria Lima X BPC', 'Maria Lima X Aposentadoria', 'Antonio Exemplo X Auxílio'])
    const rita = await cliente('Rita Exemplo')
    const joao = await cliente('João Souza', '11144477735')
    const maria = await cliente('Maria Lima')
    const antonio = await cliente('Antônio Exempla')
    for (const c of [rita, joao, maria, antonio]) await guardar(c.casoId, 'rg')

    await rodar(g.drive)
    expect(g.dentro(g.pastaChamada('RITA EXEMPLO X BPC LOAS - Fe12ab')!)).toEqual(['Documento pessoal (RG) - Rita Exemplo - 2026-10-08.pdf'])
    expect(g.dentro(g.pastaChamada('111.444.777-35 X João de Souza')!)).toEqual(['Documento pessoal (RG) - João Souza - 2026-10-08.pdf'])
    expect(g.dentro(g.pastaChamada('Antonio Exemplo X Auxílio')!)).toEqual(['Documento pessoal (RG) - Antônio Exempla - 2026-10-08.pdf'])
    expect(g.dentro('revisar')).toEqual(['Documento pessoal (RG) - Maria Lima - 2026-10-08.pdf'])
    expect((await banco.select().from(pessoa).where(eq(pessoa.id, maria.pessoaId)))[0].drivePastaId).toBeNull()
    expect(g.dentro('clientes')).toHaveLength(5) // nenhuma pasta nova
  })

  it('CA1 · lê o título da pasta como o balcão: nome antes do " X ", CPF no começo ou no meio, sem o código do fim', () => {
    expect(pastaDoTitulo({ id: '1', nome: 'Rita Exemplo X BPC Loas - Fenhg8' })).toEqual({ id: '1', nome: 'Rita Exemplo', caminho: 'Rita Exemplo X BPC Loas - Fenhg8' })
    expect(pastaDoTitulo({ id: '2', nome: '111.444.777-35 X João de Souza' })).toMatchObject({ nome: 'João de Souza', cpf: '11144477735' })
    expect(pastaDoTitulo({ id: '3', nome: 'Rita Exemplo - Fenhg8' })).toMatchObject({ nome: 'Rita Exemplo' })
    expect(pastaDoTitulo({ id: '4', nome: 'Rita Exemplo X 111.444.777-35' })).toMatchObject({ nome: 'Rita Exemplo', cpf: '11144477735' })
  })

  it('CA3 · a falha vira uma tarefa da Documentação no caso; a próxima rodada reprocessa sem duplicar e fecha a tarefa', async () => {
    const g = driveNaMemoria()
    const { casoId } = await cliente('Rita Exemplo')
    const d = await guardar(casoId, 'laudo')

    g.falhar(1)
    expect((await rodar(g.drive)).falhas).toEqual(['Drive: 503 Service Unavailable'])
    g.falhar(1)
    await rodar(g.drive)
    expect(await tarefasDoDrive(casoId)).toMatchObject([{ situacao: 'aberta', perfilDono: 'documentacao', concluidaEm: null }])
    expect((await doc(d.id)).drivePendente).toBe(true)

    g.perderResposta(1) // o Drive gravou, mas a resposta não chegou
    await rodar(g.drive)
    expect((await doc(d.id)).drivePendente).toBe(true)
    expect(await rodar(g.drive)).toEqual({ enviados: 1, falhas: [] })

    const pasta = g.pastaChamada('Rita Exemplo X A CLASSIFICAR')!
    expect(g.dentro(pasta)).toEqual(['Laudo médico - Rita Exemplo - 2026-10-08.pdf'])
    expect(g.dentro('clientes')).toHaveLength(1)
    expect((await doc(d.id)).driveArquivoId).toBe(g.itens.find((i) => i.marca === `documento:${d.id}`)!.id)
    expect(await tarefasDoDrive(casoId)).toMatchObject([{ situacao: 'concluida' }])
  })

  it('CA3 · arquivo que não abre no armazenamento não cria pasta no Drive: fica a tarefa', async () => {
    const g = driveNaMemoria()
    const { casoId } = await cliente('Rita Exemplo')
    await banco
      .insert(documento)
      .values({ casoId, tipo: 'laudo', chaveArmazenamento: 'casos/nao-existe', nomeOriginal: 'laudo.pdf', mime: 'application/pdf', tamanho: 1, hashSha256: 'h', origem: 'portal' })
    expect((await rodar(g.drive)).falhas).toHaveLength(1)
    expect(g.itens).toEqual([])
    expect(await tarefasDoDrive(casoId)).toHaveLength(1)
  })

  it('CA5 · o motivo de indeferimento fica só no banco, ligado ao caso: nada vai para o Drive', async () => {
    const g = driveNaMemoria()
    const { casoId } = await cliente('Rita Exemplo')
    await banco
      .insert(resultadoInss)
      .values({ casoId, resultado: 'indeferido', dataDecisao: '2026-10-05', motivoIndeferimento: 'Renda per capita acima de 1/4', motivoEscrito: 'A renda da filha entrou na conta' })
    expect(await rodar(g.drive)).toEqual({ enviados: 0, falhas: [] })
    expect(g.itens).toEqual([])
  })

  it('CA6 · o pacote do protocolo vai para "Pacote de protocolo - AAAA-MM-DD" na pasta do cliente; gerado de novo, outra pasta', async () => {
    const g = driveNaMemoria()
    const { casoId } = await cliente('Rita Exemplo')
    const peca = await guardar(casoId, 'pacote_peticao', undefined, { nomeOriginal: 'peticao-inicial-v1.pdf' })
    const carta = await guardar(casoId, 'carta_indeferimento', undefined, { nomeOriginal: 'carta.pdf' })
    const [p] = await banco.insert(peticao).values({ casoId, tipo: 'inicial' }).returning()
    const pacote = [
      { documentoId: peca.id, origemId: peca.id, nome: 'peticao-inicial-v1.pdf', hash: 'h', papel: 'peticao' },
      { documentoId: carta.id, origemId: carta.id, nome: 'carta.pdf', hash: 'h', papel: 'carta' },
    ]
    const [v] = await banco
      .insert(peticaoVersao)
      .values({ peticaoId: p.id, numero: 1, conteudo: 'Petição', hash: 'h', geradaPor: 'advogada', pacote, pacoteGeradoEm: new Date('2026-10-08T14:00:00Z') })
      .returning()

    await rodar(g.drive)
    const pasta = g.pastaChamada('Rita Exemplo X A CLASSIFICAR')!
    const doPacote = g.pastaChamada('Pacote de protocolo - 2026-10-08')!
    // A carta é documento do cliente (entra pelo nome padrão); o PDF da petição só vai dentro do pacote.
    expect(g.dentro(pasta)).toEqual(['Carta indeferimento - Rita Exemplo - 2026-10-08.pdf', 'Pacote de protocolo - 2026-10-08'])
    expect(g.dentro(doPacote)).toEqual(['peticao-inicial-v1.pdf', 'carta.pdf'])
    expect((await banco.select().from(peticaoVersao).where(eq(peticaoVersao.id, v.id)))[0].pacoteDriveId).toBe(doPacote)

    await banco.update(peticaoVersao).set({ pacoteGeradoEm: new Date('2026-10-08T16:00:00Z'), pacoteDriveId: null }).where(eq(peticaoVersao.id, v.id))
    await rodar(g.drive)
    expect(g.dentro(pasta)).toContain('Pacote de protocolo - 2026-10-08 (2)')
    expect(g.dentro(g.pastaChamada('Pacote de protocolo - 2026-10-08 (2)')!)).toEqual(['peticao-inicial-v1.pdf', 'carta.pdf'])
  })

  it('CA7, CA8 · o arquivo do chat vai sozinho com o mesmo padrão, sem tarefa manual; o que já existia antes e o excluído não vão', async () => {
    const g = driveNaMemoria()
    const { casoId } = await cliente('Rita Exemplo')
    const doChat = await guardar(casoId, 'comprovante_rpv', undefined, { origem: 'chat' })
    await guardar(casoId, 'cnis', undefined, { drivePendente: false })
    await guardar(casoId, 'ctps', undefined, { excluidoEm: new Date('2026-10-08T15:10:00Z') })
    await guardar(casoId, 'rg', undefined, { origem: 'exemplo' })

    expect(await rodar(g.drive)).toEqual({ enviados: 1, falhas: [] })
    expect(g.dentro(g.pastaChamada('Rita Exemplo X A CLASSIFICAR')!)).toEqual(['Comprovante rpv - Rita Exemplo - 2026-10-08.pdf'])
    expect((await doc(doChat.id)).driveArquivoId).not.toBeNull()
    expect(await banco.select().from(tarefa).where(eq(tarefa.casoId, casoId))).toEqual([])
  })
})
