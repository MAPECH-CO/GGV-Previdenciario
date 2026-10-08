import { beforeEach, describe, expect, it } from 'vitest'
import { encerrarGravacao, iniciarGravacao, transcrever } from './entrevista.ts'
import { configurarExemplo, obterFicha, tarefasDoSetor, zerarExemplo } from './servidor.ts'
import * as transcricao from './transcricao.ts'
import { conferirDocumentos, conferirInformacoes, marcarProva, obterGravacoes } from './transcricao.ts'

const AGORA = new Date(2026, 9, 5, 14, 32)

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
})

async function entrevistaDaJosefa() {
  const g = await iniciarGravacao('josefa-entrevista', { avisei: true })
  await encerrarGravacao(g.id, { aos: 140, online: true })
  return transcrever(g.id)
}

describe('Transcrever a entrevista · servidor de exemplo', () => {
  it('CA4 e CA5 · a lista do caso, da mais nova para a mais antiga, e nada que apague', async () => {
    const lista = await obterGravacoes('antonio-exemplo')
    expect(lista.map((g) => [g.data, g.titulo, g.participantes.join(' + '), g.duracao])).toEqual([
      ['2026-09-27', 'WhatsApp: exigência do juiz', 'Atendimento + Antônio Exemplo', 0],
      ['2026-09-20', 'Telefone: indeferimento e próximo passo', 'Atendimento + Antônio Exemplo', 720],
      ['2026-07-10', 'Entrevista com a advogada', 'Dra. Paula + Atendimento + Antônio Exemplo', 2292],
    ])
    expect(Object.keys(transcricao).filter((n) => /apagar|excluir|remover/i.test(n))).toEqual([])
  })

  it('CA1 e CA8 · a entrevista transcrita fica no caso com a data e separa quem fala', async () => {
    await entrevistaDaJosefa()
    const [g] = await obterGravacoes('josefa-exemplo')
    expect(g).toMatchObject({ data: '2026-10-05', transcricao: 'pronta' })
    expect(g.trechos.slice(0, 2).map((t) => [t.quem, t.papel])).toEqual([
      ['Dra. Paula', 'advogada'],
      ['Josefa', 'cliente'],
    ])
  })

  it('CA6 · só o conferido sai da transcrição: a ficha muda com o valor antigo no histórico; o documento vira pedido', async () => {
    const g = await entrevistaDaJosefa()
    await expect(conferirInformacoes(g.id, [])).rejects.toThrow('Marque o que você conferiu.')
    const { gravacao, ficha } = await conferirInformacoes(g.id, ['telefone', 'estado-civil', 'laudos', 'senha'])
    expect(ficha).toMatchObject({ telefone: '11900000021', estadoCivil: 'União estável' })
    expect(ficha.profissao).toBeUndefined()
    expect(ficha.historico.slice(-3).map((e) => e.oQue)).toEqual([
      'Pediu à Documentação, da entrevista de 05/10: 2 laudos do ortopedista',
      'Levou à ficha, da entrevista de 05/10, estado civil: «—» → «União estável»',
      'Levou à ficha, da entrevista de 05/10, telefone: «(11) 90000-0002» → «(11) 90000-0021»',
    ])
    expect(gravacao.marcas).toEqual(['ficha atualizada'])
    expect(gravacao.extraidas.filter((e) => e.conferidaEm).map((e) => e.id)).toEqual(['laudos', 'estado-civil', 'telefone'])
    expect(tarefasDoSetor('Documentação · ADM')).toMatchObject([{ codigo: 'D1.23', acao: 'Pedir documento', detalhe: '2 laudos do ortopedista · citado da entrevista de 05/10' }])
  })

  it('CA7 · a lista de documentos vai ao checklist do benefício só depois de conferida', async () => {
    const g = await entrevistaDaJosefa()
    expect(g.documentos).toEqual(['RG', 'CPF', 'Comprovante de residência', 'CNIS', 'Carta de indeferimento do INSS', '2 laudos do ortopedista'])
    expect((await obterFicha('josefa-exemplo'))!.checklist).toBeUndefined()
    const conferida = await conferirDocumentos(g.id, ['RG', 'CPF', '2 laudos do ortopedista'])
    expect(conferida.documentosConferidosEm).toBe(AGORA.toISOString())
    expect((await obterFicha('josefa-exemplo'))!.checklist).toEqual(['RG', 'CPF', '2 laudos do ortopedista'])
  })

  it('marcar e desmarcar um trecho como prova', async () => {
    const g = await marcarProva('antonio-entrevista', 6, true)
    expect(g.trechos.filter((t) => t.prova).map((t) => t.aos)).toEqual([6, 140, 348, 352])
    expect((await marcarProva('antonio-entrevista', 6, false)).trechos.find((t) => t.aos === 6)?.prova).toBeUndefined()
  })
})
