import { describe, expect, it } from 'vitest'
import { ORIGENS, esperaOInss, etapaEmPericia, prazoFalado, prazosDaPericia, proximaTentativa, situacaoDaPericia } from './pericia.ts'

describe('GGVP-49 · iniciar a tarefa de perícia', () => {
  it('CA1 · o caso mostra "Em perícia" com o diagrama de origem, e a data quando já existe', () => {
    expect(etapaEmPericia({ origem: 'd2-necessidade', tipo: 'medica' }, '2026-10-07')).toBe('Em perícia · pedido ao INSS (D2) · perícia médica')
    expect(etapaEmPericia({ origem: 'd3a-juiz', tipo: 'medica', marcacao: { data: '2026-10-16', hora: '10:30' } }, '2026-10-07')).toBe(
      'Em perícia · pedido do juiz (D3a) · perícia médica em 16/10, 10:30',
    )
    expect(etapaEmPericia({ origem: 'd2-exigencia', tipo: 'social' }, '2026-10-07')).toContain('exigência do INSS (D2) · avaliação social')
  })

  it('CA3 · cada origem diz quem pediu e o passo da decisão', () => {
    expect(ORIGENS['d2-necessidade']).toMatchObject({ rotulo: 'D2 · necessidade inicial', passo: 'D2.03' })
    expect(ORIGENS['d2-exigencia'].rotulo).toBe('D2 · exigência do INSS')
    expect(ORIGENS['d3-despacho'].rotulo).toBe('D3 · despacho da sênior')
    expect(ORIGENS['d3a-juiz'].rotulo).toBe('D3a · pedido do juiz')
  })

  it('CA2 · só o D2 espera o INSS liberar o agendamento; D3 e D3a nascem liberados', () => {
    expect(esperaOInss('d2-necessidade')).toBe(true)
    expect(esperaOInss('d2-exigencia')).toBe(true)
    expect(esperaOInss('d3-despacho')).toBe(false)
    expect(esperaOInss('d3a-juiz')).toBe(false)
    expect(situacaoDaPericia({})).toBe('aguardando-inss')
    expect(situacaoDaPericia({ liberadaEm: '2026-10-07T08:00:00Z' })).toBe('marcar')
    expect(situacaoDaPericia({ liberadaEm: 'x', esperaComprovante: { desde: 'x' } })).toBe('aguardando-comprovante')
    expect(situacaoDaPericia({ liberadaEm: 'x', marcacao: {} })).toBe('agendada')
  })

  it('G19 · os prazos que a data define: 10 dias antes, 3 dias antes, véspera e dia seguinte', () => {
    expect(prazosDaPericia('2026-10-21')).toEqual({ documentosAte: '2026-10-11', preparoAte: '2026-10-18', vespera: '2026-10-20', diaSeguinte: '2026-10-22' })
    // Na virada do mês.
    expect(prazosDaPericia('2026-11-01').vespera).toBe('2026-10-31')
  })

  it('G19 · tentativa diária: a primeira no dia da liberação, a seguinte no dia depois da última', () => {
    expect(proximaTentativa([], '2026-10-07')).toBe('2026-10-07')
    expect(proximaTentativa([{ dia: '2026-10-07' }], '2026-10-07')).toBe('2026-10-08')
    expect(proximaTentativa([{ dia: '2026-10-09' }, { dia: '2026-10-08' }], '2026-10-07')).toBe('2026-10-10')
  })

  it('o prazo como a Central lê', () => {
    expect(prazoFalado('2026-10-07', '2026-10-07')).toEqual({ texto: 'hoje', urgente: true })
    expect(prazoFalado('2026-10-08', '2026-10-07')).toEqual({ texto: 'amanhã', urgente: false })
    expect(prazoFalado('2026-10-05', '2026-10-07')).toEqual({ texto: 'atrasada desde 05/10', urgente: true })
    expect(prazoFalado('2026-10-17', '2026-10-07')).toEqual({ texto: 'até 17/10', urgente: false })
  })
})
