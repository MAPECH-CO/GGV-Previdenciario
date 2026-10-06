import { describe, expect, it } from 'vitest'
import { aposErro, estaTravado, expiraEm } from './regras.ts'

const agora = new Date('2026-10-05T12:00:00Z')

describe('trava por senha errada', () => {
  it('as quatro primeiras só contam', () => {
    let estado = { tentativasErradas: 0, travadoAte: null as Date | null }
    for (let i = 1; i <= 4; i++) {
      estado = aposErro(estado.tentativasErradas, agora)
      expect(estado).toEqual({ tentativasErradas: i, travadoAte: null })
    }
  })

  it('a quinta seguida trava por 15 minutos e zera a contagem', () => {
    expect(aposErro(4, agora)).toEqual({ tentativasErradas: 0, travadoAte: new Date('2026-10-05T12:15:00Z') })
  })

  it('travado até o minuto 15; no minuto 15 já libera', () => {
    const ate = new Date('2026-10-05T12:15:00Z')
    expect(estaTravado(ate, new Date('2026-10-05T12:14:59Z'))).toBe(true)
    expect(estaTravado(ate, ate)).toBe(false)
    expect(estaTravado(null, agora)).toBe(false)
  })
})

describe('sessão', () => {
  it('dura 8 horas', () => {
    expect(expiraEm(agora)).toEqual(new Date('2026-10-05T20:00:00Z'))
  })
})
