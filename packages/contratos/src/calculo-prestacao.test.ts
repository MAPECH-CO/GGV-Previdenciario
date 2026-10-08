import { describe, expect, it } from 'vitest'
import { calcularPrestacao } from './prestacao.ts'

describe('GGVP-44 CA5 · valores da prestação calculados em código', () => {
  it('honorários pelo percentual e repasse do resto', () => {
    expect(calcularPrestacao(10_000, 30)).toEqual({ valorRecebido: '10000.00', honorarios: '3000.00', repasse: '7000.00' })
  })

  it('centavos quebrados: honorários arredondados para baixo, a favor do cliente; a soma fecha', () => {
    // 30% de 12.345,67 = 3.703,701 → 3.703,70
    expect(calcularPrestacao(12_345.67, 30)).toEqual({ valorRecebido: '12345.67', honorarios: '3703.70', repasse: '8641.97' })
    // 33,33% de 0,10 = 0,03333 → 0,03
    expect(calcularPrestacao(0.1, 33.33)).toEqual({ valorRecebido: '0.10', honorarios: '0.03', repasse: '0.07' })
  })

  it('valor de ponto flutuante não vira centavo errado (0,1 + 0,2)', () => {
    expect(calcularPrestacao(0.1 + 0.2, 50)).toEqual({ valorRecebido: '0.30', honorarios: '0.15', repasse: '0.15' })
  })

  it('percentual zero: tudo para o cliente', () => {
    expect(calcularPrestacao(1_500, 0)).toEqual({ valorRecebido: '1500.00', honorarios: '0.00', repasse: '1500.00' })
  })
})
