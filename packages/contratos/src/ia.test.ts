import { describe, expect, it } from 'vitest'
import { faltaCompletar, SugestaoDaIa } from './ia.ts'

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

describe('faltaCompletar (GGVP-22 CA6, GGVP-67 CA12)', () => {
  const MOTIVO = 'O texto ainda tem [completar]: preencha antes de aprovar.'
  it('com o marcador da IA, com ou sem o que falta, em qualquer caixa, não se aprova', () => {
    expect(faltaCompletar('Seu pedido foi negado. [completar: o motivo da decisão]. Estamos à disposição.')).toBe(MOTIVO)
    expect(faltaCompletar('valor da causa [completar]')).toBe(MOTIVO)
    expect(faltaCompletar('[Completar o CPF]')).toBe(MOTIVO)
  })
  it('preenchido, segue; a palavra solta não conta', () => {
    expect(faltaCompletar('Seu pedido foi negado porque faltou o laudo. Vamos completar a documentação.')).toBeNull()
  })
})
