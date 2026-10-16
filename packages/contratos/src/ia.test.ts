import { describe, expect, it } from 'vitest'
import { faltaCompletar, numeroDeJurimetriaNoTexto, SugestaoDaIa } from './ia.ts'

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
  it('GGVP-158 · sem regex lenta: milhares de "[completar" sem o fecho respondem na hora e passam, como antes', () => {
    const montado = '[completar '.repeat(50_000)
    const inicio = performance.now()
    expect(faltaCompletar(montado)).toBeNull()
    expect(performance.now() - inicio).toBeLessThan(100)
    expect(faltaCompletar(`${montado}]`)).toBe(MOTIVO)
    expect(faltaCompletar('[COMPLETAR]')).toBe(MOTIVO)
    expect(faltaCompletar('] antes não fecha: [completar o nome')).toBeNull()
  })
})

describe('GGVP-158 P5.12 · número de jurimetria fora do texto da peça (G22)', () => {
  const MOTIVO = 'O texto cita número de jurimetria: tire antes de aprovar.'
  it('os formatos do portal acusam: a taxa com os casos, a base, a chance e o tempo médio', () => {
    for (const trecho of [
      'Este juízo julga procedentes 71% em 34 processos · base de 07/10.',
      'O perito tem 71% · 24 de 34 laudos favoráveis.',
      'a procedência é de 62,5 % (10 de 16 decisões)',
      'Na base histórica, 80% em 5 casos, base de 01/10',
      'A chance de êxito do autor é de 74%.',
      'com 74% de chance de procedência',
      'o tempo médio até o laudo é de 45 dias',
      // GGVP-158 E8 (15/10): escrito com "dos/das", e a taxa "dos casos" sem a contagem.
      'Em 71% dos 34 laudos o juiz aceitou a tese.',
      'O perito tem 71% · 24 dos 34 processos favoráveis.',
      'Na base de 07/10, 71% dos casos foram favoráveis.',
    ])
      expect([trecho, numeroDeJurimetriaNoTexto(trecho)]).toEqual([trecho, MOTIVO])
  })
  it('o percentual de lei, os entendimentos e os processos de exemplo passam', () => {
    for (const trecho of [
      'Requer o acréscimo de 25% previsto no art. 45 da Lei 8.213/91.',
      'A renda per capita é inferior a 1/4 do salário mínimo.',
      'Este juízo entende que o laudo do assistente técnico deve ser considerado (processo 0001234-56.2025.4.03.6301).',
      'O salário de 100% do benefício, desde a data-base de 01/05.',
      'O autor tem 34 anos e trabalhou por 10 anos.',
      'Os honorários são de 25% dos valores atrasados, em 3 dos 4 processos.',
    ])
      expect([trecho, numeroDeJurimetriaNoTexto(trecho)]).toEqual([trecho, null])
  })
  it('o texto grande responde na hora', () => {
    const grande = `${'9'.repeat(50_000)} ${'chance '.repeat(20_000)} ${'% de '.repeat(20_000)}`
    const inicio = performance.now()
    numeroDeJurimetriaNoTexto(grande)
    expect(performance.now() - inicio).toBeLessThan(200)
  })
})
