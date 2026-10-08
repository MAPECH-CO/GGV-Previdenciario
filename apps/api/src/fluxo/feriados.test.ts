import { describe, expect, it } from 'vitest'
import { feriadosDaLei, pascoa } from './feriados.ts'

const doTribunal = (ano: number, tribunal: string | null) =>
  feriadosDaLei(ano)
    .filter((f) => f.tribunal === tribunal)
    .map((f) => f.data)

describe('GGVP-146 parte 3 · os feriados que a lei fixa', () => {
  it('a Páscoa sai da conta', () => {
    expect([2024, 2025, 2026, 2027, 2028].map(pascoa)).toEqual(['2024-03-31', '2025-04-20', '2026-04-05', '2027-03-28', '2028-04-16'])
  })

  it('os nacionais de 2026, com a Paixão de Cristo na sexta antes da Páscoa', () => {
    expect(doTribunal(2026, null)).toEqual([
      '2026-01-01',
      '2026-04-03',
      '2026-04-21',
      '2026-05-01',
      '2026-09-07',
      '2026-10-12',
      '2026-11-02',
      '2026-11-15',
      '2026-11-20',
      '2026-12-25',
    ])
  })

  it('a Justiça Federal, igual nos seis TRFs: recesso, Carnaval, Semana Santa, 11/08, 01/11 e 08/12, sem repetir o nacional', () => {
    const trf3 = doTribunal(2027, '4.03')
    expect(trf3).toEqual([
      '2027-01-02',
      '2027-01-03',
      '2027-01-04',
      '2027-01-05',
      '2027-01-06',
      '2027-02-08',
      '2027-02-09',
      '2027-03-24',
      '2027-03-25',
      '2027-03-27',
      '2027-03-28',
      '2027-08-11',
      '2027-11-01',
      '2027-12-08',
      ...['20', '21', '22', '23', '24', '26', '27', '28', '29', '30', '31'].map((d) => `2027-12-${d}`),
    ])
    for (const t of ['4.01', '4.02', '4.04', '4.05', '4.06']) expect(doTribunal(2027, t)).toEqual(trf3)
  })

  it('o TJSP: a suspensão do CPC (20/12 a 20/01) e o 9 de julho', () => {
    const tjsp = doTribunal(2026, '8.26')
    expect(tjsp.filter((d) => d < '2026-02-01')).toHaveLength(19)
    expect(tjsp).toContain('2026-07-09')
    expect(tjsp.filter((d) => d >= '2026-12-01')).toHaveLength(11)
    expect(tjsp).not.toContain('2026-12-25')
  })

  it('nenhum dia repetido no mesmo tribunal', () => {
    for (const ano of [2026, 2027]) {
      const chaves = feriadosDaLei(ano).map((f) => `${f.data}|${f.tribunal}`)
      expect(new Set(chaves).size).toBe(chaves.length)
    }
  })
})
