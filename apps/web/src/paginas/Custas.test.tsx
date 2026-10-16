import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VisaoDasCustas } from '@ggv/contratos'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo } from '../dados/servidor.ts'
import { Custas } from './Custas.tsx'

const CASO = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
const OUTRO = '7a2d3c4b-5e6f-4a70-9b8c-1d2e3f4a5b6c'
const UBER = '11111111-1111-4111-8111-111111111111'

const visao = (mes = '2026-10'): VisaoDasCustas => ({
  mes,
  paraAprovar: [{ id: UBER, casoId: CASO, cliente: 'Cliente Inventada', data: '2026-10-05', descricao: 'Uber para levar o cliente à perícia', lancadoPor: 'Helena', valor: '45.90', situacao: 'esperando', motivo: null }],
  porProcesso: [
    { casoId: CASO, cliente: 'Cliente Inventada', ganhos: '1500.00', custos: '100.00', lucro: '1400.00', esperando: '45.90' },
    { casoId: OUTRO, cliente: 'Outra Pessoa Inventada', ganhos: '0.00', custos: '40.00', lucro: '-40.00', esperando: '0.00' },
  ],
  totalDoMes: { ganhos: '1500.00', custos: '140.00', lucro: '1360.00', esperando: '45.90' },
})

/** O servidor de mentira: GET /api/custas devolve a visão do mês pedido; POST responde `post`. */
function servidor(post: { status: number; corpo: object } = { status: 200, corpo: { ok: true, situacao: 'aprovado' } }) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify(post.corpo), { status: post.status }) : new Response(JSON.stringify(visao(new URL(url, 'http://x').searchParams.get('mes') ?? '2026-10'))),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const posts = (fetch: ReturnType<typeof servidor>) => fetch.mock.calls.filter(([, init]) => init?.method === 'POST')
const gets = (fetch: ReturnType<typeof servidor>) => fetch.mock.calls.filter(([, init]) => !init?.method || init.method === 'GET').map(([url]) => String(url))

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 9, 10, 0), latencia: 0 })
  entrarComo('financeiro')
})
afterEach(() => {
  cleanup()
  entrarComo()
  vi.unstubAllGlobals()
})

describe('GGVP-157 CA6 · a visão das custas', () => {
  it('o Financeiro vê os custos para aprovar e o mês por processo, com o total; o processo abre o detalhe aqui mesmo', async () => {
    servidor()
    render(comSessao(<Custas />))
    const aprovar = await screen.findByRole('table', { name: 'Custos para aprovar' })
    const linha = within(aprovar).getByText('Uber para levar o cliente à perícia').closest('tr')!
    expect(linha.textContent).toContain('Helena · 05/10/2026 · ')
    expect(within(linha).getByText(/comprovante anexado/).closest('a')!.getAttribute('href')).toBe(`/api/casos/${CASO}/custas/${UBER}/comprovante`)
    expect(within(linha).getByText('R$ 45,90')).toBeTruthy()
    expect(within(linha).getByRole('link', { name: 'Cliente Inventada' }).getAttribute('href')).toBe(`/custas/${CASO}`)

    expect(screen.getByRole('heading', { name: 'Outubro, por processo' })).toBeTruthy()
    const mes = screen.getByRole('table', { name: 'Custas de outubro, por processo' })
    const celulas = (tr: Element) => [...tr.querySelectorAll('th, td')].map((c) => c.textContent)
    expect(celulas(within(mes).getByRole('link', { name: 'Outra Pessoa Inventada' }).closest('tr')!)).toEqual(['Outra Pessoa Inventada', 'R$ 0,00', 'R$ 40,00', 'R$ -40,00', 'R$ 0,00'])
    expect(celulas(within(mes).getByText('Total do mês').closest('tr')!)).toEqual(['Total do mês', 'R$ 1.500,00', 'R$ 140,00', 'R$ 1.360,00', 'R$ 45,90'])
    expect(within(mes).getByRole('link', { name: 'Cliente Inventada' }).getAttribute('href')).toBe(`/custas/${CASO}`)
  })

  it('CA3 · aprovar manda ao servidor e lê a visão de novo', async () => {
    const fetch = servidor()
    render(comSessao(<Custas />))
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar' }))
    expect(await screen.findByText('Custo aprovado: passa a contar no lucro.')).toBeTruthy()
    expect(posts(fetch).map(([url]) => url)).toEqual([`/api/casos/${CASO}/custas/${UBER}/aprovacao`])
    await vi.waitFor(() => expect(gets(fetch)).toHaveLength(2))
  })

  it('CA3 · recusar pede o motivo antes de confirmar; sem motivo não envia', async () => {
    const fetch = servidor({ status: 200, corpo: { ok: true, situacao: 'recusado' } })
    render(comSessao(<Custas />))
    fireEvent.click(await screen.findByRole('button', { name: 'Recusar com motivo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar a recusa' }))
    expect(screen.getByText('Diga o motivo da recusa.')).toBeTruthy()
    expect(posts(fetch)).toHaveLength(0)
    fireEvent.change(screen.getByLabelText('Motivo da recusa'), { target: { value: 'Comprovante ilegível' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar a recusa' }))
    expect(await screen.findByText('Custo recusado. Fica no histórico e não conta no lucro.')).toBeTruthy()
    const [url, init] = posts(fetch)[0]
    expect([url, JSON.parse(String(init!.body))]).toEqual([`/api/casos/${CASO}/custas/${UBER}/recusa`, { motivo: 'Comprovante ilegível' }])
  })

  it('o erro do servidor ao aprovar aparece na linha', async () => {
    servidor({ status: 409, corpo: { erro: 'Este lançamento não está esperando o Financeiro.' } })
    render(comSessao(<Custas />))
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar' }))
    expect(await screen.findByText('Este lançamento não está esperando o Financeiro.')).toBeTruthy()
  })

  it('o seletor de mês pede o mês escolhido', async () => {
    const fetch = servidor()
    render(comSessao(<Custas />))
    fireEvent.change(await screen.findByLabelText('Mês'), { target: { value: '2026-09' } })
    expect(await screen.findByRole('heading', { name: 'Setembro, por processo' })).toBeTruthy()
    expect(gets(fetch)).toEqual(['/api/custas?mes=2026-10', '/api/custas?mes=2026-09'])
  })

  it('o sócio só lê: sem aprovar, e o processo abre a página do processo no card de custas', async () => {
    entrarComo('socio')
    servidor()
    render(comSessao(<Custas />))
    const mes = await screen.findByRole('table', { name: 'Custas de outubro, por processo' })
    expect(within(mes).getByRole('link', { name: 'Cliente Inventada' }).getAttribute('href')).toBe(`/casos/${CASO}#custas`)
    expect(screen.queryByRole('button', { name: 'Aprovar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Recusar com motivo' })).toBeNull()
    expect(screen.queryByRole('button', { name: '+ Novo custo' })).toBeNull()
  })

  it('Pedro, 16/10 · o Financeiro abre o Novo custo pela visão das custas', async () => {
    servidor()
    render(comSessao(<Custas />))
    fireEvent.click(await screen.findByRole('button', { name: '+ Novo custo' }))
    expect(screen.getByRole('dialog', { name: 'Novo custo' })).toBeTruthy()
    expect(screen.getByRole('searchbox', { name: /Buscar o processo/ })).toBeTruthy()
  })

  it('o detalhe de um processo para o Financeiro: o card de custas, com o caminho de volta', async () => {
    const custas = { casoId: CASO, cliente: 'Cliente Inventada', beneficio: null, origem: 'inss', totais: { ganhos: '0.00', custos: '0.00', lucro: '0.00', esperando: '0.00' }, lancamentos: [], podeLancar: true, podeAprovar: true }
    const fetch = vi.fn(async () => new Response(JSON.stringify(custas)))
    vi.stubGlobal('fetch', fetch)
    render(comSessao(<Custas casoId={CASO} />))
    expect(await screen.findByRole('region', { name: 'Custas do processo' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '← Voltar às custas' }).getAttribute('href')).toBe('/custas')
    expect(screen.getByRole('button', { name: 'Lançar (já entra aprovado)' })).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith(`/api/casos/${CASO}/custas`, expect.anything())
  })
})
