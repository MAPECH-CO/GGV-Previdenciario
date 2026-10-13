import { describe, expect, it } from 'vitest'
import { calcularCnis, type EntradaDoCnis } from './calculo-cnis.ts'

// Datas e vínculos inventados pelo teste, sem pessoa real.
const vinculo = (inicio: string, fim: string): EntradaDoCnis['vinculos'][number] => ({ inicio, fim, tempo: 'conferido', carencia: 'conferido' })
const entrada = (vinculos: EntradaDoCnis['vinculos'], outros: Partial<EntradaDoCnis> = {}): EntradaDoCnis => ({ nascimento: '01/01/1970', referencia: '11/10/2026', vinculos, excecoes: [], ...outros })
const calcular = (v: EntradaDoCnis) => {
  const r = calcularCnis(v, '11/10/2026')
  if (!r.ok) throw Error(r.erros.join('; '))
  return r
}
describe('memória do CNIS por código', () => {
  it('une sobreposições e não conta duas carências no mesmo mês', () => {
    const r = calcular(entrada([vinculo('01/01/2018', '20/01/2018'), vinculo('10/01/2018', '31/01/2018')]))
    expect(r.diasTotais).toBe(31)
    expect(r.carencia).toBe(1)
    expect(r.parcial).toBe(false)
  })
  it('conta limites inclusivos, um dia isolado e fevereiro bissexto', () => {
    expect(calcular(entrada([vinculo('01/02/2016', '29/02/2016')])).diasTotais).toBe(29)
    expect(calcular(entrada([vinculo('29/02/2016', '29/02/2016')])).diasTotais).toBe(1)
  })
  it('não preenche as lacunas entre os vínculos', () => {
    const r = calcular(entrada([vinculo('01/01/2018', '10/01/2018'), vinculo('21/01/2018', '31/01/2018')]))
    expect(r.diasTotais).toBe(21)
    expect(r.carencia).toBe(1)
  })
  it('considera novembro inteiro depois da reforma sem duplicar o mês concorrente', () => {
    const r = calcular(entrada([vinculo('31/10/2019', '02/11/2019'), vinculo('15/11/2019', '16/11/2019')]))
    expect(r.diasDeTempo).toBe(1)
    expect(r.competenciasIntegrais).toBe(1)
    expect(r.diasTotais).toBe(31)
    expect(r.carencia).toBe(2)
  })
  it('referência anterior à reforma ainda conta novembro de data a data', () => {
    const r = calcular(entrada([vinculo('01/11/2019', '12/11/2019')], { referencia: '12/11/2019' }))
    expect(r.diasTotais).toBe(12)
    expect(r.competenciasIntegrais).toBe(0)
  })
  it('preserva doze competências como um ano e os meses restantes como trinta dias', () => {
    const r = calcular(entrada([vinculo('31/01/2020', '01/01/2021')]))
    expect(r.competenciasIntegrais).toBe(13)
    expect(r.diasTotais).toBe(395)
    expect(r.carencia).toBe(13)
  })
  it('separa tempo de carência quando a pessoa conferiu apenas um deles', () => {
    const r = calcular(entrada([{ ...vinculo('01/01/2018', '31/01/2018'), carencia: 'nao-conta' }]))
    expect(r.diasTotais).toBe(31)
    expect(r.carencia).toBe(0)
    expect(r.competenciasExcluidas).toEqual(['2018-01'])
  })
  it('exclui competência abaixo do mínimo sem ajuste em todos os vínculos', () => {
    const r = calcular(entrada([vinculo('01/01/2020', '31/03/2020'), vinculo('01/02/2020', '29/02/2020')], {
      excecoes: [{ competencia: '02/2020', tempo: 'nao-conta', carencia: 'nao-conta' }],
    }))
    expect(r.diasTotais).toBe(60)
    expect(r.carencia).toBe(2)
  })
  it('pendência não é validade presumida, mesmo com exceção marcada como conferida', () => {
    const r = calcular(entrada([{ ...vinculo('01/01/2020', '31/01/2020'), tempo: 'pendente', carencia: 'pendente' }], {
      excecoes: [{ competencia: '01/2020', tempo: 'conferido', carencia: 'conferido' }],
    }))
    expect(r.diasTotais).toBe(0)
    expect(r.carencia).toBe(0)
    expect(r.parcial).toBe(true)
  })
  it('calcula os pontos preservando frações e sem decidir direito à aposentadoria', () => {
    const r = calcular(entrada([vinculo('01/01/2018', '31/01/2018')], { referencia: '01/01/2019' }))
    // 49 anos civis desde 1970, com 12 dias bissextos, mais os 31 dias do vínculo.
    expect(r.idadeDias).toBe(49 * 365 + 12)
    expect(r.pontos).toBe((49 * 365 + 12 + 31) / 365)
    expect(r).not.toHaveProperty('podeAposentar')
  })
  it.each([
    entrada([vinculo('31/02/2020', '01/03/2020')]),
    entrada([vinculo('02/01/2020', '01/01/2020')]),
    entrada([vinculo('01/01/1969', '01/01/1970')]),
    entrada([vinculo('01/01/2027', '01/02/2027')]),
    entrada([vinculo('01/01/2020', '01/01/2020')], { referencia: '12/10/2026' }),
    entrada([vinculo('01/01/2020', '01/01/2020')], { excecoes: [{ competencia: '13/2020', tempo: 'pendente', carencia: 'pendente' }] }),
  ])('rejeita datas impossíveis, invertidas, anteriores ao nascimento e futuras', v => {
    expect(calcularCnis(v, '11/10/2026').ok).toBe(false)
  })
  it('rejeita competências repetidas ou fora dos vínculos em vez de ignorá-las', () => {
    const e = { competencia: '02/2020', tempo: 'pendente' as const, carencia: 'pendente' as const }
    expect(calcularCnis(entrada([vinculo('01/01/2020', '31/01/2020')], { excecoes: [e] }), '11/10/2026').ok).toBe(false)
    expect(calcularCnis(entrada([vinculo('01/01/2020', '31/03/2020')], { excecoes: [e, e] }), '11/10/2026').ok).toBe(false)
  })
})
