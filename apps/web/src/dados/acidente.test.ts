import { beforeEach, describe, expect, it } from 'vitest'
import { obterAcidente, salvarAcidente } from './acidente.ts'
import { conferirChecklist, obterChecklist } from './checklist.ts'
import { enviarArquivos } from './documentos.ts'
import { arquivarDocumentos, documentosLidos } from './leitura.ts'
import { liberarAoJuridico } from './liberacao.ts'
import { configurarExemplo, ler, obterFicha, zerarExemplo } from './servidor.ts'
import { parecerParaOPortao } from './parecer.ts'
import type { DadosDoAcidente } from '../regras/acidente.ts'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 6, 15, 10), latencia: 0 })
  zerarExemplo()
})

const JESSICA = { perfil: 'documentacao', nome: 'Jéssica (exemplo)' }
const TRABALHO: DadosDoAcidente = { circunstancia: 'trabalho', categoria: 'empregado', acidenteEm: '2024-03-15', auxilioAnterior: false, recusados: [] }
const tudoConferido = { perfil: 'documentacao' as const, conferiChecklist: true, conferiAssinaturas: true }

async function arquivarTudo(fichaId: string) {
  const c = await documentosLidos(fichaId)
  const documentos = c!.documentos.filter((d) => d.situacao === 'a-conferir').map(({ id, tipo, data }) => ({ id, tipo, data }))
  await arquivarDocumentos(fichaId, { conferi: true, documentos, duplicados: 'manter' })
}

/** Chegam pelo card e a Documentação arquiva, com o tipo conferido. */
async function chegam(arquivos: [string, string][], n = 30) {
  await enviarArquivos('sebastiao-exemplo', {
    origem: 'card',
    arquivos: arquivos.map(([nome, tipo], i) => ({ nome, formato: 'pdf' as const, tamanho: 1000, tipo, hash: String(n + i).padStart(64, '0') })),
  })
  await arquivarTudo('sebastiao-exemplo')
}

const itens = async () => (await obterChecklist('sebastiao-exemplo-1'))!.checklist.itens.map((i) => [i.nome, i.exigencia ?? '', i.situacao, i.naoConta ?? false])

describe('Auxílio-Acidente: prova do acidente · servidor de exemplo', () => {
  it('CA2 · antes de marcar a circunstância, o checklist do Sebastião mostra o kit e trava', async () => {
    const c = (await obterChecklist('sebastiao-exemplo-1'))!.checklist
    expect(c.itens.map((i) => [i.nome, i.situacao])).toEqual([
      ['Contrato assinado (kit)', 'recebido'],
      ['Documento pessoal (RG)', 'recebido'],
      ['Documento pessoal (CPF)', 'recebido'],
      ['CNIS', 'recebido'],
      ['Laudo médico', 'recebido'],
    ])
    expect([c.completo, c.bloqueio]).toEqual([false, 'Marque a circunstância do acidente: o que é obrigatório depende dela.'])
    expect(await obterAcidente('sebastiao-exemplo-1')).toEqual({})
  })

  it('CA1 e CA2 · acidente de trabalho com auxílio anterior: os complementares, cada um com a exigência e o status; a semente já traz a CAT e o exame posterior à alta', async () => {
    await salvarAcidente('sebastiao-exemplo-1', { ...TRABALHO, auxilioAnterior: true }, JESSICA)
    expect((await itens()).slice(5)).toEqual([
      ['CAT (Comunicação de Acidente de Trabalho)', 'obrigatorio', 'recebido', false],
      ['Boletim de ocorrência', 'desejavel', 'pendente', true],
      ['Ficha do pronto-socorro', 'obrigatorio', 'pendente', false],
      ['Prontuário', 'obrigatorio', 'pendente', false],
      ['Exame de imagem da época do acidente', 'obrigatorio', 'pendente', false],
      ['Exame posterior à alta', 'obrigatorio', 'recebido', false],
      ['Cópia do processo do auxílio por incapacidade temporária', 'condicional', 'pendente', false],
    ])
    expect((await obterFicha('sebastiao-exemplo'))?.historico.at(-1)).toMatchObject({
      quem: 'Jéssica (exemplo)',
      oQue: 'Marcou a circunstância do acidente: Acidente de trabalho · Empregado · B94 · auxílio-acidente acidentário',
    })
  })

  it('CA2 · no trânsito a CAT sai, e o boletim e as fotos são obrigatórios; na doença ocupacional entra o PPP, com a válvula da recusa do empregador', async () => {
    await salvarAcidente('sebastiao-exemplo-1', { ...TRABALHO, circunstancia: 'transito' }, JESSICA)
    const transito = await itens()
    expect(transito.map((i) => i[0])).not.toContain('CAT (Comunicação de Acidente de Trabalho)')
    expect(transito.slice(5, 8)).toEqual([
      ['Boletim de ocorrência', 'obrigatorio', 'pendente', false],
      ['Fotos do acidente', 'obrigatorio', 'pendente', false],
      ['Ficha do pronto-socorro', 'obrigatorio', 'pendente', false],
    ])
    expect(transito.find((i) => i[0] === 'Prontuário')).toEqual(['Prontuário', 'obrigatorio', 'pendente', false])

    await salvarAcidente('sebastiao-exemplo-1', { ...TRABALHO, circunstancia: 'ocupacional', recusados: ['ppp'] }, JESSICA)
    const ppp = (await obterChecklist('sebastiao-exemplo-1'))!.checklist.itens.find((i) => i.tipo === 'ppp')
    expect(ppp).toMatchObject({ exigencia: 'obrigatorio', situacao: 'pendente', motivo: 'o empregador recusou: pendência que não trava', naoConta: true })
    expect((await itens()).map((i) => i[0])).not.toContain('Ficha do pronto-socorro')
  })

  it('CA3 · chegam a ficha do pronto-socorro, o prontuário e o exame da época: o checklist fica completo e o caso libera (G1)', async () => {
    await salvarAcidente('sebastiao-exemplo-1', TRABALHO, JESSICA)
    await expect(liberarAoJuridico('sebastiao-exemplo-1', tudoConferido)).rejects.toThrow(
      'O checklist está incompleto. Falta: Ficha do pronto-socorro, Prontuário e Exame de imagem da época do acidente.',
    )
    await chegam([
      ['pronto socorro.pdf', 'ficha-pronto-socorro'],
      ['prontuario cirurgia.pdf', 'prontuario'],
      ['raio x do acidente.pdf', 'exame-imagem-epoca'],
    ])
    const caso = (await obterChecklist('sebastiao-exemplo-1'))!
    expect([caso.checklist.completo, caso.checklist.faltam]).toEqual([true, []])
    await conferirChecklist('sebastiao-exemplo-1')
    expect((await obterFicha('sebastiao-exemplo'))?.historico.at(-1)?.oQue).toBe('Conferiu o checklist do Auxílio Acidentário: completo')
    const liberacao = await liberarAoJuridico('sebastiao-exemplo-1', tudoConferido)
    expect(liberacao.processoId).toBe('sebastiao-exemplo-1')
  })

  it('CA2 · facultativo trava na categoria, mesmo com os documentos', async () => {
    await salvarAcidente('sebastiao-exemplo-1', { ...TRABALHO, categoria: 'facultativo' }, JESSICA)
    const c = (await obterChecklist('sebastiao-exemplo-1'))!.checklist
    expect(c.bloqueio).toBe('Facultativo não tem direito ao auxílio-acidente: o caso trava na categoria.')
    await expect(liberarAoJuridico('sebastiao-exemplo-1', tudoConferido)).rejects.toThrow('Facultativo não tem direito ao auxílio-acidente')
    await conferirChecklist('sebastiao-exemplo-1')
    expect((await obterFicha('sebastiao-exemplo'))?.historico.at(-1)?.oQue).toBe(
      'Conferiu o checklist do Auxílio Acidentário: travado: Facultativo não tem direito ao auxílio-acidente: o caso trava na categoria.',
    )
  })

  it('o servidor confere de novo: o perfil, a data e o benefício', async () => {
    await expect(salvarAcidente('sebastiao-exemplo-1', TRABALHO, { perfil: 'atendimento', nome: 'Bruna' })).rejects.toThrow('Só a Documentação ou o Jurídico')
    await expect(salvarAcidente('sebastiao-exemplo-1', { ...TRABALHO, acidenteEm: '2030-01-01' }, JESSICA)).rejects.toThrow('não seja futura')
    await expect(salvarAcidente('rita-exemplo-1', TRABALHO, JESSICA)).rejects.toThrow('é do Auxílio-Acidente')
    expect(ler().acidentes).toBeUndefined()
  })

  it('CA4 · o laudo de lesão não consolidada trava a liberação (G18) e sugere a troca, mesmo com o parecer Suficiente de antes', async () => {
    await salvarAcidente('sebastiao-exemplo-1', TRABALHO, JESSICA)
    await chegam([
      ['pronto socorro.pdf', 'ficha-pronto-socorro'],
      ['prontuario cirurgia.pdf', 'prontuario'],
      ['raio x do acidente.pdf', 'exame-imagem-epoca'],
      ['laudo lesao nao consolidada.pdf', 'laudo'],
    ])
    expect(parecerParaOPortao(ler(), 'sebastiao-exemplo-1')).toMatchObject({
      situacao: 'suficiente',
      contradicoes: [{ id: 'nao-consolidada', texto: 'Lesão ainda não consolidada' }],
    })
    await expect(liberarAoJuridico('sebastiao-exemplo-1', tudoConferido)).rejects.toThrow(
      'Não dá para liberar ao Jurídico: a análise da IA achou documento que contradiz o requisito do benefício (lesão ainda não consolidada). O caso fica parado até o Jurídico conferir o parecer (G18). Sugestão: trocar para Auxílio por Incapacidade Temporária; o caso muda de porta.',
    )
  })

  it('CA4 · o laudo sem redução da capacidade também trava (Tema 416), sem a sugestão de troca', async () => {
    await chegam([['laudo sem reducao da capacidade.pdf', 'laudo']])
    expect(parecerParaOPortao(ler(), 'sebastiao-exemplo-1')?.contradicoes?.map((c) => c.id)).toEqual(['sem-reducao'])
  })
})
