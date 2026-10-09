import { fireEvent, render, screen, within } from '@testing-library/react'
import type { LancamentoFinanceiro, PainelFinanceiro } from '@ggv/contratos'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo } from '../dados/servidor.ts'
import { Financeiro } from './Financeiro.tsx'

const lancamento = (n: string, l: Partial<LancamentoFinanceiro>): LancamentoFinanceiro => ({
  casoId: `00000000-0000-4000-8000-00000000000${n}`,
  cliente: `Cliente ${n}`,
  beneficio: 'BPC/LOAS Idoso',
  processo: null,
  origem: 'inss',
  valor: null,
  vencimento: null,
  recebidoEm: null,
  status: 'a_receber',
  responsavel: 'Financeiro',
  ...l,
})
const lancamentos = [
  lancamento('1', { cliente: 'Lúcia Prado', status: 'aguardando_ok', responsavel: 'Advogada · Renata' }),
  lancamento('2', { cliente: 'Otávio Nery', valor: '2000.00', vencimento: '2026-10-30', origem: 'justica', processo: '0002991-55.2024.4.03.6301' }),
  lancamento('3', { cliente: 'Vera Lúcia', valor: '3703.70', vencimento: '2026-09-30', recebidoEm: '2026-10-02', status: 'recebido', responsavel: 'Financeiro · Ana', processo: 'INSS · 187.223.441-0' }),
]
const painel: PainelFinanceiro = {
  mes: '2026-10',
  recebidoNoMes: '3703.70',
  variacao: 12,
  aReceber: '2000.00',
  processosAReceber: 1,
  emAtraso: '0.00',
  processosEmAtraso: 0,
  aLancar: 2,
  aguardandoOk: 1,
  porMes: [
    { mes: '2026-09', recebido: '0.00', previsto: '3703.70' },
    { mes: '2026-10', recebido: '3703.70', previsto: '2000.00' },
  ],
  porOrigem: [{ origem: 'inss', valor: '3703.70', fatia: 100 }],
  lancamentos,
}

function servidor(corpo: PainelFinanceiro) {
  const chamada = vi.fn(async (_url: string) => new Response(JSON.stringify(corpo), { status: 200 }))
  vi.stubGlobal('fetch', chamada)
  return chamada
}
const itens = (nome: string) => within(screen.getByRole('list', { name: nome })).getAllByRole('listitem')
const linhas = () => within(screen.getByRole('table', { name: 'Lançamentos' })).getAllByRole('row').slice(1)

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 9, 10, 0), latencia: 0 })
  entrarComo('financeiro')
})
afterEach(() => {
  vi.unstubAllGlobals()
  entrarComo()
})

describe('GGVP-78 · o painel Financeiro, como no Figma (1930:4)', () => {
  it('os cartões do mês com os números do servidor, a receita por mês, por origem e as pendentes', async () => {
    const chamada = servidor(painel)
    render(comSessao(<Financeiro />))
    expect(await screen.findByRole('list', { name: 'Indicadores do mês' })).toBeTruthy()
    expect(chamada.mock.calls[0][0]).toBe('/api/financeiro?mes=2026-10')
    expect(itens('Indicadores do mês').map((i) => i.textContent)).toEqual([
      'Recebido no mêsR$ 3.703,70▲ 12% sobre setembro',
      'A receberR$ 2.000,001 processo esperando o recebimento',
      'Prestações de contas a lançar21 aguardando o OK da advogada (G8)',
      'Em atrasoR$ 0,000 processos com o prazo de pagamento vencido',
    ])
    expect(itens('Recebido e previsto por mês').map((i) => i.getAttribute('aria-label'))).toEqual([
      'setembro: recebido R$ 0,00; previsto R$ 3.703,70',
      'outubro: recebido R$ 3.703,70; previsto R$ 2.000,00',
    ])
    expect(itens('Receita por origem').map((i) => i.textContent)).toEqual(['Honorários administrativos (INSS)100%'])
    const pendentes = itens('Pendentes')
    expect(pendentes.map((i) => i.textContent)).toEqual(['Lúcia Prado · BPC/LOAS Idoso—Aguardando OK', 'Otávio Nery · BPC/LOAS IdosoR$ 2.000,00Lançar'])
    expect(within(pendentes[1]).getByRole('link', { name: 'Lançar a prestação de Otávio Nery' }).getAttribute('href')).toBe('/casos/00000000-0000-4000-8000-000000000002/prestacao/recebimento')
  })

  it('a tabela dos lançamentos: o nome abre a prestação; os filtros e o "Limpar"', async () => {
    servidor(painel)
    render(comSessao(<Financeiro />))
    await screen.findByRole('table', { name: 'Lançamentos' })
    expect(linhas().map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))).toEqual([
      ['Lúcia Prado', '—', 'Honorários administrativos (INSS)', '—', '—', 'Aguardando OK', 'Advogada · Renata'],
      ['Otávio Nery', '0002991-55.2024.4.03.6301', 'Honorários de êxito (Justiça)', 'R$ 2.000,00', '30/10/2026', 'A receber', 'Financeiro'],
      ['Vera Lúcia', 'INSS · 187.223.441-0', 'Honorários administrativos (INSS)', 'R$ 3.703,70', 'recebido 02/10', 'Recebido', 'Financeiro · Ana'],
    ])
    expect(screen.getByRole('link', { name: 'Vera Lúcia' }).getAttribute('href')).toBe('/casos/00000000-0000-4000-8000-000000000003/prestacao')

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'recebido' } })
    expect(linhas().map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['Vera Lúcia'])
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Cliente ou nº do processo' }), { target: { value: '187223' } })
    expect(linhas().map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['Vera Lúcia'])
    fireEvent.change(screen.getByRole('searchbox', { name: 'Cliente ou nº do processo' }), { target: { value: 'ninguém' } })
    expect(linhas().map((r) => r.textContent)).toEqual(['Nenhum lançamento com esses filtros.'])
  })

  it('o período pede o mês ao servidor', async () => {
    const chamada = servidor(painel)
    render(comSessao(<Financeiro />))
    await screen.findByRole('table', { name: 'Lançamentos' })
    expect(within(screen.getByLabelText('Período')).getAllByRole('option').map((o) => o.textContent).slice(0, 3)).toEqual(['out/2026', 'set/2026', 'ago/2026'])
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: '2026-09' } })
    await vi.waitFor(() => expect(chamada.mock.calls.at(-1)?.[0]).toBe('/api/financeiro?mes=2026-09'))
  })

  it('o Sócio vê os totais, sem as pendentes nem a tabela de cada cliente', async () => {
    entrarComo('socio')
    servidor({ ...painel, lancamentos: null })
    render(comSessao(<Financeiro />))
    expect(await screen.findByRole('list', { name: 'Indicadores do mês' })).toBeTruthy()
    expect(screen.queryByRole('table', { name: 'Lançamentos' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Prestações de contas pendentes' })).toBeNull()
    expect(screen.getByText('Os lançamentos de cada cliente ficam com o Financeiro; aqui, os totais do escritório.')).toBeTruthy()
  })

  it('sem nada no ano, os cartões zerados e os quadros dizem que não há valor', async () => {
    servidor({ ...painel, recebidoNoMes: '0.00', variacao: null, porMes: [{ mes: '2026-10', recebido: '0.00', previsto: '0.00' }], porOrigem: [], lancamentos: [] })
    render(comSessao(<Financeiro />))
    expect(await screen.findByText('Nenhum honorário recebido ou previsto no ano.')).toBeTruthy()
    expect(screen.getByText('sem recebimento em setembro')).toBeTruthy()
    expect(screen.getByText('Nenhum honorário recebido nos últimos 12 meses.')).toBeTruthy()
    expect(screen.getByText('Nenhuma prestação pendente.')).toBeTruthy()
  })
})
