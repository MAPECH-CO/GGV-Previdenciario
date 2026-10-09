import { describe, expect, it } from 'vitest'
import { menorDe16, relatoriosDaCrianca } from './infantil.ts'

describe('BPC/LOAS de menor de 16 anos (GGVP-50)', () => {
  it('CA1 · menor de 16 anos pela data de nascimento, no dia; sem data, vale o adulto', () => {
    expect(menorDe16('2019-04-12', '2026-10-06')).toBe(true)
    expect(menorDe16('2010-10-07', '2026-10-06')).toBe(true)
    expect(menorDe16('2010-10-06', '2026-10-06')).toBe(false)
    expect(menorDe16('1964-03-12', '2026-10-06')).toBe(false)
    expect(menorDe16(undefined, '2026-10-06')).toBe(false)
  })

  it('CA2 · os relatórios por condição: o escolar só para quem vai à escola ou à creche, o CAPS só na saúde mental, a neurologia e as terapias', () => {
    expect(relatoriosDaCrianca({ condicoes: [], terapias: [], escola: false })).toEqual([])
    expect(relatoriosDaCrianca({ condicoes: [], terapias: [], escola: true })).toEqual(['relatorio-escolar'])
    expect(relatoriosDaCrianca({ condicoes: ['neurologica'], terapias: ['to', 'fono'], escola: false })).toEqual(['relatorio-neurologia', 'relatorio-fono', 'relatorio-to'])
    expect(relatoriosDaCrianca({ condicoes: ['saude-mental', 'neurologica'], terapias: ['fono', 'to', 'psicologia'], escola: true })).toEqual([
      'relatorio-escolar',
      'relatorio-caps',
      'relatorio-neurologia',
      'relatorio-fono',
      'relatorio-to',
      'relatorio-psicologia',
    ])
  })
})
