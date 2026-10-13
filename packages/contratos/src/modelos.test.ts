import { describe, expect, it } from 'vitest'
import { PercentualDoModelo } from './modelos.ts'

describe('GGVP-158 P3.3 · o percentual de honorários do modelo', () => {
  it('vai de 0 a 100 e aceita casa decimal; fora disso ou sem número, recusa com o que informar', () => {
    for (const percentual of [0, 30, 25.5, 100]) expect(PercentualDoModelo.safeParse({ percentual }).success, String(percentual)).toBe(true)
    for (const percentual of [-1, 100.5, '30', null, Number.NaN]) {
      const r = PercentualDoModelo.safeParse({ percentual })
      expect([r.success, r.error?.issues[0]?.message], String(percentual)).toEqual([false, 'Informe o percentual de honorários, de 0 a 100.'])
    }
  })
})
