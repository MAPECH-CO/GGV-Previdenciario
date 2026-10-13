import { describe, expect, it } from 'vitest'
import { amostraPerito } from './amostraPerito.ts'
describe('Amostra do perito vinda do acervo', () => {
  it('conta cada caso uma vez e usa o último laudo, mesmo fora de ordem', () => {
    expect(amostraPerito([
      { caso: 'caso-inventado-a', data: '2026-10-09' },
      { caso: 'caso-inventado-a', data: '2026-10-07' },
      { caso: 'caso-inventado-b', data: '2026-09-30' },
    ])).toEqual({ casos: 2, base: '2026-10-09' })
  })
  it('não inventa base para acervo vazio', () => {
    expect(amostraPerito([])).toEqual({ casos: 0, base: null })
  })
})
