import { describe, expect, it } from 'vitest'
import { mesAntes, montarPainelFinanceiro, type LinhaDoFinanceiro } from './financeiro.ts'

const linha = (casoId: string, l: Partial<LinhaDoFinanceiro>): LinhaDoFinanceiro => ({
  casoId: `00000000-0000-4000-8000-00000000000${casoId}`,
  cliente: `Cliente ${casoId}`,
  beneficio: null,
  processo: null,
  origem: 'inss',
  valor: null,
  vencimento: null,
  recebidoEm: null,
  responsavel: 'Financeiro',
  aguardandoOk: false,
  lancado: true,
  ...l,
})

const HOJE = '2026-10-09'
const linhas = [
  linha('1', { valor: '3703.70', vencimento: '2026-09-30', recebidoEm: '2026-10-02' }),
  linha('2', { valor: '0.10', vencimento: '2026-10-05', recebidoEm: '2026-10-08', origem: 'justica' }),
  linha('3', { valor: '0.20', vencimento: '2026-09-10', recebidoEm: '2026-09-12' }),
  linha('4', { valor: '1000.00', vencimento: '2026-10-30' }),
  linha('5', { valor: '500.00', vencimento: '2026-10-01' }),
  linha('6', { aguardandoOk: true }),
  linha('7', { valor: '250.00', vencimento: '2026-11-15', aguardandoOk: true }),
  // O OK saiu e o Financeiro não lançou: fica "Lançar", mesmo com o prazo vencido.
  linha('8', { valor: '300.00', vencimento: '2026-10-02', lancado: false }),
]

describe('GGVP-78 · painel Financeiro calculado em código (G19)', () => {
  it('o mês anterior atravessa o ano', () => {
    expect([mesAntes('2026-01'), mesAntes('2026-10', 9), mesAntes('2026-03', 14)]).toEqual(['2025-12', '2026-01', '2025-01'])
  })

  it('o status: aguardando o OK da advogada vem antes de tudo; sem lançamento, "Lançar"; lançada e sem a confirmação, o prazo vencido é atraso', () => {
    const p = montarPainelFinanceiro(linhas, '2026-10', HOJE, true)
    expect(p.lancamentos!.map((l) => [l.casoId.at(-1), l.status])).toEqual([
      ['7', 'aguardando_ok'],
      ['6', 'aguardando_ok'],
      ['8', 'a_lancar'],
      ['5', 'atrasado'],
      ['4', 'a_receber'],
      ['3', 'recebido'],
      ['1', 'recebido'],
      ['2', 'recebido'],
    ])
  })

  it('os cartões do mês, em centavos inteiros: 0,10 + 0,20 não vira 0,30000000000000004', () => {
    const p = montarPainelFinanceiro(linhas, '2026-10', HOJE, true)
    expect(p.recebidoNoMes).toBe('3703.80')
    // 3703,80 sobre 0,20 em setembro.
    expect(p.variacao).toBe(1_851_800)
    // A receber só o que foi lançado e espera a confirmação; a lançar, a que tem o OK sem lançamento e as que esperam o OK.
    expect([p.aReceber, p.processosAReceber, p.emAtraso, p.processosEmAtraso, p.aLancar, p.aguardandoOk]).toEqual(['1500.00', 2, '500.00', 1, 3, 2])
    expect(montarPainelFinanceiro(linhas, '2026-09', HOJE, true).recebidoNoMes).toBe('0.20')
  })

  it('sem recebido no mês anterior, não há variação', () => {
    expect(montarPainelFinanceiro(linhas, '2026-09', HOJE, true).variacao).toBeNull()
  })

  it('por mês, de janeiro ao período: o recebido pelo dia da confirmação, o previsto pelo prazo; quem espera o OK fica fora', () => {
    const { porMes } = montarPainelFinanceiro(linhas, '2026-10', HOJE, true)
    expect(porMes.map((m) => m.mes)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
    expect(porMes.at(-2)).toEqual({ mes: '2026-09', recebido: '0.20', previsto: '3703.90' })
    expect(porMes.at(-1)).toEqual({ mes: '2026-10', recebido: '3703.80', previsto: '1800.10' })
  })

  it('por origem, nos 12 meses até o período, com a fatia', () => {
    expect(montarPainelFinanceiro(linhas, '2026-10', HOJE, true).porOrigem).toEqual([
      { origem: 'inss', valor: '3703.90', fatia: 100 },
      { origem: 'justica', valor: '0.10', fatia: 0 },
    ])
    expect(montarPainelFinanceiro(linhas, '2027-11', HOJE, true).porOrigem).toEqual([])
  })

  it('sem quem vê valores, só os totais: nenhuma linha por cliente', () => {
    expect(montarPainelFinanceiro(linhas, '2026-10', HOJE, false).lancamentos).toBeNull()
  })

  it('sem nada no banco, zeros e listas vazias', () => {
    const p = montarPainelFinanceiro([], '2026-02', HOJE, true)
    expect([p.recebidoNoMes, p.aReceber, p.aLancar, p.porMes.length, p.porOrigem, p.lancamentos]).toEqual(['0.00', '0.00', 0, 2, [], []])
  })
})
