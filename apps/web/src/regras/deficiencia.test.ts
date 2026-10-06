import { describe, expect, it } from 'vitest'
import { FATORES, MINIMO_LC_142, enquadramento, grauEm, motivoParaNaoSalvar, paraDados, periodos, tempo, type DadosDaDeficiencia } from './deficiencia.ts'

const dados: DadosDaDeficiencia = { inicio: '2011-01-01', grau: 'leve', agravamentos: [{ data: '2012-01-01', grau: 'grave' }], sexo: 'feminino' }
const vinculo = { empresa: 'Exemplo Ltda', inicio: '2010-01', fim: '2012-12', indicadorPcd: true }

describe('Linha do tempo da deficiência (GGVP-42)', () => {
  it('CA1 e CA2 · o vínculo partido no início e no agravamento: sem deficiência, leve e grave', () => {
    const ps = periodos([vinculo], dados, [], '2026-10-06')
    expect(ps.map((p) => [p.inicio, p.fim, p.grau ?? 'sem', p.dias])).toEqual([
      ['2010-01-01', '2010-12-31', 'sem', 365],
      ['2011-01-01', '2011-12-31', 'leve', 365],
      ['2012-01-01', '2012-12-31', 'grave', 366],
    ])
    expect(grauEm(dados, '2010-06-30')).toBeUndefined()
    expect(grauEm(dados, '2011-06-30')).toBe('leve')
    expect(grauEm(dados, '2012-01-01')).toBe('grave')
    // Vínculo em aberto vai até a extração do CNIS; o indicador PCD do CNIS acompanha.
    const aberto = periodos([{ empresa: 'Exemplo Serviços', inicio: '2020-02' }], dados, [], '2026-06-30')
    expect(aberto.map((p) => [p.inicio, p.fim, p.grau, p.indicadorPcd])).toEqual([['2020-02-01', '2026-06-30', 'grave', false]])
  })

  it('CA3 · período com deficiência sem documento da época fica "sem prova da época"; o sem deficiência, nunca', () => {
    const provas = [
      { tipo: 'laudo', data: '2011-05-10', descricao: 'laudo de exemplo' },
      { tipo: 'aso', data: '2010-03-01', descricao: 'ASO admissional' },
      { tipo: 'comprovante-residencia', data: '2012-05-01', descricao: 'não prova deficiência' },
    ]
    const ps = periodos([vinculo], dados, provas, '2026-10-06')
    expect(ps.map((p) => [p.grau ?? 'sem', p.provas.map((x) => x.tipo), p.semProva])).toEqual([
      ['sem', [], false],
      ['leve', ['laudo'], false],
      ['grave', [], true],
    ])
  })

  it('CA4 · o enquadramento: o grau preponderante, os fatores do art. 70-E e o mínimo da LC 142 (G19)', () => {
    const e = enquadramento(periodos([vinculo], dados, [], '2026-10-06'), 'feminino')!
    expect(e.preponderante).toBe('grave')
    expect(e.faixas).toEqual([
      { faixa: 'grave', dias: 366, fator: 1, convertidos: 366 },
      // O ano leve vale menos para quem se aposenta pelo grave: 20 / 28 anos (0,71); o sem deficiência, 20 / 30 (0,67).
      { faixa: 'leve', dias: 365, fator: 0.71, convertidos: 259 },
      { faixa: 'sem', dias: 365, fator: 0.67, convertidos: 245 },
    ])
    expect([e.convertido, e.minimo, e.falta]).toEqual([870, 20, 20 * 365 - 870])
    expect(tempo(e.convertido)).toEqual({ anos: 2, meses: 4, dias: 20 })
    // Homem: o mesmo tempo, os fatores e o mínimo dele.
    const h = enquadramento(periodos([vinculo], { ...dados, sexo: 'masculino' }, [], '2026-10-06'), 'masculino')!
    expect(h.faixas.map((f) => f.fator)).toEqual([1, 0.76, 0.71])
    expect(h.minimo).toBe(25)
  })

  it('CA4 · empate de tempo fica o grau mais grave; sem deficiência nos vínculos, não há enquadramento', () => {
    const empate = periodos([{ empresa: 'A', inicio: '2011-01', fim: '2011-12' }, { empresa: 'B', inicio: '2013-01', fim: '2013-12' }], {
      ...dados,
      agravamentos: [{ data: '2013-01-01', grau: 'moderada' }],
    }, [], '2026-10-06')
    expect(enquadramento(empate, 'feminino')?.preponderante).toBe('moderada')
    expect(enquadramento(periodos([{ empresa: 'A', inicio: '2005-01', fim: '2009-12' }], dados, [], '2026-10-06'), 'feminino')).toBeUndefined()
  })

  it('CA4 · a tabela de conversão do art. 70-E e os mínimos da LC 142, por sexo', () => {
    expect(FATORES.feminino.leve.moderada).toBe(0.86)
    expect(FATORES.feminino.sem.moderada).toBe(0.8)
    expect(FATORES.masculino.moderada.grave).toBe(0.86)
    expect(FATORES.masculino.sem.leve).toBe(0.94)
    expect(MINIMO_LC_142).toEqual({ feminino: { grave: 20, moderada: 24, leve: 28 }, masculino: { grave: 25, moderada: 29, leve: 33 } })
  })

  it('CA2 · os dados só salvam com datas válidas, não futuras, e o agravamento para um grau mais grave', () => {
    const v = { inicio: '10/06/2014', grau: 'leve' as const, sexo: 'feminino' as const, agravamentos: [{ data: '01/03/2019', grau: 'moderada' as const }] }
    expect(motivoParaNaoSalvar(v, '2026-10-06')).toBeNull()
    expect(paraDados(v, '2026-10-06')).toEqual({ inicio: '2014-06-10', grau: 'leve', sexo: 'feminino', agravamentos: [{ data: '2019-03-01', grau: 'moderada' }] })
    expect(motivoParaNaoSalvar({ ...v, inicio: '10/06/2030' }, '2026-10-06')).toMatch(/não seja futura/)
    expect(motivoParaNaoSalvar({ ...v, sexo: '' }, '2026-10-06')).toMatch(/sexo/)
    expect(motivoParaNaoSalvar({ ...v, agravamentos: [{ data: '01/03/2010', grau: 'moderada' }] }, '2026-10-06')).toMatch(/depois do início/)
    expect(motivoParaNaoSalvar({ ...v, agravamentos: [{ data: '01/03/2019', grau: 'leve' }] }, '2026-10-06')).toMatch(/mais grave/)
  })
})
