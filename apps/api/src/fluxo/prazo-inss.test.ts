import { describe, expect, it } from 'vitest'
import { diasUteisAte, prazoInss } from './prazo-inss.ts'

const SEM_FERIADO = new Set<string>()

describe('GGVP-39 CA7 · prazo da exigência do INSS (Lei 9.784, art. 66)', () => {
  it('conta dias corridos a partir do dia seguinte: 30 dias de uma sexta caem num domingo e vão para segunda', () => {
    // 02/10/2026 é sexta; +30 = 01/11/2026, domingo → 02/11/2026
    expect(prazoInss('2026-10-02', 30, SEM_FERIADO)).toBe('2026-11-02')
  })

  it('fim em dia útil fica onde está', () => {
    expect(prazoInss('2026-10-05', 10, SEM_FERIADO)).toBe('2026-10-15')
  })

  it('fim no sábado vai para segunda; se a segunda é feriado, para terça', () => {
    expect(prazoInss('2026-10-01', 9, SEM_FERIADO)).toBe('2026-10-12')
    expect(prazoInss('2026-10-01', 9, new Set(['2026-10-12']))).toBe('2026-10-13')
  })

  it('véspera de feriado: o prazo que cai no feriado passa para o dia útil seguinte', () => {
    expect(prazoInss('2026-10-27', 5, new Set(['2026-11-02']))).toBe('2026-11-03')
  })
})

describe('GGVP-39 CA14 · dias úteis até o prazo', () => {
  it('conta só dias úteis, de amanhã até o prazo', () => {
    // segunda 05/10 → sexta 09/10: terça a sexta = 4
    expect(diasUteisAte('2026-10-05', '2026-10-09', SEM_FERIADO)).toBe(4)
    // sexta 09/10 → segunda 12/10: o fim de semana não conta, só a segunda
    expect(diasUteisAte('2026-10-09', '2026-10-12', SEM_FERIADO)).toBe(1)
    expect(diasUteisAte('2026-10-05', '2026-10-09', new Set(['2026-10-07']))).toBe(3)
  })

  it('prazo hoje dá 0; vencido dá negativo', () => {
    expect(diasUteisAte('2026-10-05', '2026-10-05', SEM_FERIADO)).toBe(0)
    expect(diasUteisAte('2026-10-07', '2026-10-05', SEM_FERIADO)).toBe(-2)
  })
})
