import { describe, expect, it } from 'vitest'
import { proximoLembrete } from './exigencia.ts'

// Segunda, 05/10/2026. Sem feriado cadastrado, só o fim de semana conta.
const SEG = '2026-10-05'
const SEM_FERIADO = new Set<string>()

describe('GGVP-94 CA1 · próximo lembrete do laço (G15)', () => {
  it('sem prazo de fora, a cada 3 dias úteis, pulando o fim de semana e o feriado', () => {
    expect(proximoLembrete(SEG, 3, null, 3, SEM_FERIADO)).toBe('2026-10-08')
    expect(proximoLembrete('2026-10-08', 3, null, 2, SEM_FERIADO)).toBe('2026-10-13')
    expect(proximoLembrete('2026-10-08', 3, null, 2, new Set(['2026-10-12']))).toBe('2026-10-14')
  })

  it('com prazo, as tentativas que faltam se comprimem para caber antes dele', () => {
    // 5 dias úteis até o prazo (sex 09/10 e seg 12/10), 3 tentativas: de 1 em 1 dia útil.
    expect(proximoLembrete(SEG, 3, '2026-10-12', 3, SEM_FERIADO)).toBe('2026-10-06')
    // Prazo longe: o intervalo normal vale.
    expect(proximoLembrete(SEG, 3, '2026-11-30', 3, SEM_FERIADO)).toBe('2026-10-08')
  })

  it('nunca passa do prazo; sem intervalo configurado, o lembrete é o prazo', () => {
    expect(proximoLembrete(SEG, 3, '2026-10-06', 1, SEM_FERIADO)).toBe('2026-10-06')
    expect(proximoLembrete(SEG, null, '2026-10-20', 3, SEM_FERIADO)).toBe('2026-10-20')
  })
})
