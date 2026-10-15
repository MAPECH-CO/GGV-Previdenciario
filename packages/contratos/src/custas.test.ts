import { describe, expect, it } from 'vitest'
import { LancarCusto, custasDoMes, somarCustas } from './custas.ts'

describe('GGVP-157 · custas do processo', () => {
  it('CA4 · lucro = ganhos − custos aprovados (com a comissão de captação), fechado em centavos', () => {
    const custos = [
      { valor: '0.10', situacao: 'aprovado' as const },
      { valor: '0.20', situacao: 'aprovado' as const },
      { valor: '1500.00', situacao: 'aprovado' as const }, // comissão de captação
      { valor: '45.90', situacao: 'esperando' as const },
      { valor: '99.99', situacao: 'recusado' as const },
      { valor: '12.00', situacao: 'cancelado' as const },
    ]
    // 0,1 + 0,2 em ponto flutuante é 0,30000000000000004; em centavos, 0,30.
    expect(somarCustas(['3703.70', '0.01'], custos)).toEqual({ ganhos: '3703.71', custos: '1500.30', lucro: '2203.41', esperando: '45.90' })
  })

  it('CA4 · gasto maior que o ganho dá lucro negativo; sem nada, tudo zero', () => {
    expect(somarCustas([], [{ valor: '80.00', situacao: 'aprovado' }]).lucro).toBe('-80.00')
    expect(somarCustas([], [])).toEqual({ ganhos: '0.00', custos: '0.00', lucro: '0.00', esperando: '0.00' })
  })

  it('CA6 · o mês conta o ganho pelo dia do recebimento e o custo pela data do gasto, por processo e no total', () => {
    const r = custasDoMes(
      [
        { casoId: 'a', valor: '1000.00', dia: '2026-10-02' },
        { casoId: 'b', valor: '500.00', dia: '2026-09-30' },
      ],
      [
        { casoId: 'a', valor: '100.00', situacao: 'aprovado', data: '2026-10-05' },
        { casoId: 'a', valor: '30.00', situacao: 'esperando', data: '2026-10-06' },
        { casoId: 'b', valor: '40.00', situacao: 'aprovado', data: '2026-10-01' },
        { casoId: 'c', valor: '9.00', situacao: 'aprovado', data: '2026-09-01' },
      ],
      '2026-10',
    )
    expect(r.porProcesso).toEqual([
      { casoId: 'a', ganhos: '1000.00', custos: '100.00', lucro: '900.00', esperando: '30.00' },
      { casoId: 'b', ganhos: '0.00', custos: '40.00', lucro: '-40.00', esperando: '0.00' },
    ])
    expect(r.totalDoMes).toEqual({ ganhos: '1000.00', custos: '140.00', lucro: '860.00', esperando: '30.00' })
  })

  it('CA2 · o lançamento valida data, descrição e valor pela biblioteca campos', () => {
    expect(LancarCusto.parse({ data: '05/10/2026', descricao: ' Uber do cliente ', valor: 'R$ 1.234,5' })).toEqual({ data: '2026-10-05', descricao: 'Uber do cliente', valor: '1234.50' })
    for (const errado of [
      { data: '31/02/2026', descricao: 'Uber', valor: '10' },
      { data: '05/10/2026', descricao: '  ', valor: '10' },
      { data: '05/10/2026', descricao: 'Uber', valor: '0' },
      { data: '05/10/2026', descricao: 'Uber', valor: '10,005' },
      { data: '05/10/2026', descricao: 'Uber', valor: 'dez' },
    ])
      expect(LancarCusto.safeParse(errado).success, JSON.stringify(errado)).toBe(false)
  })
})
