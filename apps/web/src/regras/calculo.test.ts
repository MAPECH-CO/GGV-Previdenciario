import { describe, expect, it } from 'vitest'
import { pontosDoCnis, tempoDosDias } from './calculo.ts'

describe('GGVP-158 P3.4 · o resultado do calcularCnis no registro do cálculo', () => {
  it('dias em anos, meses e dias, com o ano de 365 e o mês de 30 (IN 128, art. 207)', () => {
    expect(tempoDosDias(0)).toEqual({ anos: 0, meses: 0, dias: 0 })
    expect(tempoDosDias(364)).toEqual({ anos: 0, meses: 12, dias: 4 })
    expect(tempoDosDias(365)).toEqual({ anos: 1, meses: 0, dias: 0 })
    expect(tempoDosDias(365 * 30 + 30 * 2 + 15)).toEqual({ anos: 30, meses: 2, dias: 15 })
  })

  it('os pontos com duas casas, cortando: 95,999 não vira 96', () => {
    expect(pontosDoCnis(95.999)).toBe(95.99)
    expect(pontosDoCnis(96)).toBe(96)
    expect(pontosDoCnis(88.123456)).toBe(88.12)
  })
})
