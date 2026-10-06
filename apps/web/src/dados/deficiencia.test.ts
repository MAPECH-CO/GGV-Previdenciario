import { beforeEach, describe, expect, it } from 'vitest'
import { enquadramentoDoCaso, obterLinhaDoTempo, salvarDeficiencia } from './deficiencia.ts'
import { enviarArquivos } from './documentos.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from './servidor.ts'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 6, 15, 10), latencia: 0 })
  zerarExemplo()
})

const PAULA = { perfil: 'advogada', nome: 'Dra. Paula (exemplo)' }

describe('Linha do tempo da deficiência · servidor de exemplo', () => {
  it('CA1, CA2 e CA3 · a Cleide: os vínculos partidos no início e no agravamento, o indicador PCD, a insalubridade e a prova da época', async () => {
    const l = (await obterLinhaDoTempo('cleide-exemplo-1'))!
    expect(l.beneficio).toBe('PCD Aposentadoria por Contribuição')
    expect(l.periodos.map((p) => [p.empresa, p.inicio, p.fim, p.grau ?? 'sem', p.indicadorPcd, p.insalubre, p.semProva])).toEqual([
      ['Exemplo Têxtil Ltda', '2008-02-01', '2013-05-31', 'sem', false, true, false],
      ['Exemplo Metalúrgica Ltda', '2013-08-01', '2014-06-09', 'sem', true, true, false],
      ['Exemplo Metalúrgica Ltda', '2014-06-10', '2019-02-28', 'leve', true, true, false],
      ['Exemplo Metalúrgica Ltda', '2019-03-01', '2019-12-31', 'moderada', true, true, true],
      ['Exemplo Serviços Ltda', '2020-02-01', '2026-06-30', 'moderada', true, false, false],
    ])
    expect(l.periodos[2].provas.map((p) => p.descricao)).toEqual(['Laudo da neurologia (exemplo)'])
    expect(l.periodos[4].provas.map((p) => p.tipo)).toEqual(['contratacao-cota', 'laudo'])
  })

  it('CA4 · o enquadramento da Cleide: moderada, 16 anos, 3 meses e 10 dias convertidos, mínimo de 24 anos (G19)', async () => {
    const e = (await obterLinhaDoTempo('cleide-exemplo-1'))!.enquadramento!
    expect(e.faixas.map((f) => [f.faixa, f.dias, f.fator, f.convertidos])).toEqual([
      ['moderada', 2648, 1, 2648],
      ['leve', 1725, 0.86, 1484],
      ['sem', 2260, 0.8, 1808],
    ])
    expect([e.preponderante, e.convertido, e.minimo, e.falta]).toEqual(['moderada', 5940, 24, 2820])
    expect(enquadramentoDoCaso('cleide-exemplo-1')).toBe('grau moderada · 16 anos, 3 meses e 10 dias convertidos · mínimo de 24 anos · calculado por código (G19)')
  })

  it('CA2 · a advogada registra um agravamento novo: o grau muda a partir da data; o histórico não leva o dado de saúde', async () => {
    const l = await salvarDeficiencia(
      'cleide-exemplo-1',
      { inicio: '2014-06-10', grau: 'leve', sexo: 'feminino', agravamentos: [{ data: '2019-03-01', grau: 'moderada' }, { data: '2023-01-01', grau: 'grave' }] },
      PAULA,
    )
    expect(l.periodos.slice(-2).map((p) => [p.inicio, p.fim, p.grau])).toEqual([
      ['2020-02-01', '2022-12-31', 'moderada'],
      ['2023-01-01', '2026-06-30', 'grave'],
    ])
    expect((await obterFicha('cleide-exemplo'))?.historico.at(-1)).toMatchObject({
      quem: 'Dra. Paula (exemplo)',
      oQue: 'Atualizou os dados da deficiência na linha do tempo (PCD Aposentadoria por Contribuição)',
    })
  })

  it('CA2 · o servidor confere de novo: só o Jurídico, data não futura e agravamento para um grau mais grave', async () => {
    const dados = { inicio: '2014-06-10', grau: 'leve' as const, sexo: 'feminino' as const, agravamentos: [] }
    await expect(salvarDeficiencia('cleide-exemplo-1', dados, { perfil: 'atendimento', nome: 'Ana' })).rejects.toThrow('Só o Jurídico')
    await expect(salvarDeficiencia('cleide-exemplo-1', { ...dados, inicio: '2030-01-01' }, PAULA)).rejects.toThrow('não seja futura')
    await expect(salvarDeficiencia('cleide-exemplo-1', { ...dados, agravamentos: [{ data: '2019-03-01', grau: 'leve' }] }, PAULA)).rejects.toThrow('mais grave')
  })

  it('CA3 · o laudo que chega à pasta vira prova da época do período dele', async () => {
    await salvarDeficiencia('cleide-exemplo-1', { inicio: '2014-06-10', grau: 'leve', sexo: 'feminino', agravamentos: [{ data: '2019-03-01', grau: 'moderada' }] }, PAULA)
    await enviarArquivos('cleide-exemplo', {
      origem: 'card',
      arquivos: [{ nome: 'laudo neurologia.pdf', formato: 'pdf', tamanho: 1000, tipo: 'laudo', hash: '6'.padStart(64, '0') }],
    })
    // A leitura data o laudo no dia em que chegou: entra nas provas do caso, mas não prova a época de 2019.
    const l = (await obterLinhaDoTempo('cleide-exemplo-1'))!
    expect(l.provas.map((p) => [p.data, p.descricao])).toContainEqual(['2026-10-06', 'Laudo médico · Dr. Exemplo Silva'])
    expect(l.periodos[3].semProva).toBe(true)
  })

  it('caso sem CNIS ou sem dados da deficiência não tem linha nem enquadramento', async () => {
    const l = (await obterLinhaDoTempo('rita-exemplo-1'))!
    expect([l.periodos, l.enquadramento]).toEqual([[], undefined])
    expect(await obterLinhaDoTempo('nao-existe')).toBeNull()
  })
})
