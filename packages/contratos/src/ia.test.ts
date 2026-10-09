import { describe, expect, it } from 'vitest'
import { SugestaoDaIa } from './ia.ts'

describe('GGVP-106 · sugestão da IA', () => {
  it('CA2 · só passa marcada como sugestão, com as fontes', () => {
    const ok = {
      chamadaId: '11111111-1111-4111-8111-111111111111',
      sugestao: true,
      texto: 'Exigência do juiz, prazo de 15 dias.',
      fontes: [{ tipo: 'publicacao', referencia: 'publicacao:1' }],
      modelo: 'gpt-4.1-mini',
      geradaEm: '2026-10-07T20:00:00.000Z',
      alerta: null,
    }
    expect(SugestaoDaIa.parse(ok).sugestao).toBe(true)
    expect(SugestaoDaIa.safeParse({ ...ok, sugestao: false }).success).toBe(false)
    expect(SugestaoDaIa.safeParse({ ...ok, fontes: undefined }).success).toBe(false)
  })
})
