import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FeriadosDoEscritorio } from '@ggv/contratos'
import { FeriadosDosTribunais } from './FeriadosDosTribunais.tsx'

const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`
const BASE: FeriadosDoEscritorio = {
  feriados: [
    { id: ID(1), data: '2026-11-20', tribunal: null, descricao: 'Dia Nacional de Zumbi e da Consciência Negra (Lei 14.759/2023)' },
    { id: ID(2), data: '2026-08-11', tribunal: '4.03', descricao: '11 de agosto: Justiça Federal (Lei 5.010/1966, art. 62)' },
    { id: ID(3), data: '2027-08-11', tribunal: '4.03', descricao: '11 de agosto: Justiça Federal (Lei 5.010/1966, art. 62)' },
  ],
  historico: [{ quando: '2026-10-08T15:00:00.000Z', quem: 'Helena', descricao: 'Carregou os feriados da lei de 2026 e 2027: 382 dia(s) acrescentado(s)' }],
  podeEditar: true,
}

function servidor(dados: FeriadosDoEscritorio = BASE) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const metodo = init?.method ?? 'GET'
    if (metodo === 'GET') return new Response(JSON.stringify(dados), { status: 200 })
    if (url.endsWith('/carga')) return new Response(JSON.stringify({ acrescentados: 382 }), { status: 200 })
    return new Response(JSON.stringify({ ok: true }), { status: metodo === 'POST' ? 201 : 200 })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const mudancas = (fetch: ReturnType<typeof servidor>) =>
  fetch.mock.calls.filter(([, i]) => i?.method && i.method !== 'GET').map(([url, i]) => [i!.method, url, i!.body ? JSON.parse(String(i!.body)) : undefined])
afterEach(() => vi.unstubAllGlobals())

describe('GGVP-146 parte 3 · feriados e suspensões dos tribunais', () => {
  it('a lista por tribunal e ano, e o histórico', async () => {
    servidor()
    render(<FeriadosDosTribunais />)
    const secao = await screen.findByRole('region', { name: 'Feriados e suspensões dos tribunais' })
    expect(within(secao).getByRole('list', { name: 'Feriados de Nacional em 2026' }).textContent).toContain('20/11/2026 · Dia Nacional de Zumbi')
    fireEvent.change(within(secao).getByLabelText('Tribunal'), { target: { value: '4.03' } })
    fireEvent.change(within(secao).getByLabelText('Ano'), { target: { value: '2027' } })
    expect(within(secao).getByRole('list', { name: 'Feriados de TRF3 em 2027' }).textContent).toContain('11/08/2027 · 11 de agosto')
    fireEvent.change(within(secao).getByLabelText('Tribunal'), { target: { value: '8.26' } })
    expect(within(secao).getByText('Nenhum dia de TJSP em 2027.')).toBeTruthy()
    expect(within(secao).getByRole('list', { name: 'Histórico dos feriados' }).textContent).toContain('Helena · Carregou os feriados da lei de 2026 e 2027')
  })

  it('a Sênior carrega os da lei, acrescenta (data pela biblioteca campos) e tira', async () => {
    const fetch = servidor()
    render(<FeriadosDosTribunais />)
    const secao = await screen.findByRole('region', { name: 'Feriados e suspensões dos tribunais' })
    fireEvent.click(within(secao).getByRole('button', { name: 'Carregar os feriados da lei de 2026 e 2027' }))
    expect((await within(secao).findByRole('status')).textContent).toBe('Feriados da lei de 2026 e 2027: 382 dia(s) acrescentado(s).')

    const form = within(secao).getByRole('form', { name: 'Acrescentar feriado ou suspensão' })
    const dia = within(form).getByLabelText('Dia (dd/mm/aaaa)') as HTMLInputElement
    fireEvent.change(dia, { target: { value: '31022026' } })
    expect(dia.value).toBe('31/02/2026')
    expect(dia.getAttribute('aria-invalid')).toBe('true')
    fireEvent.change(within(form).getByLabelText('O que é'), { target: { value: 'Suspensão: sistema fora do ar' } })
    expect(within(form).getByRole('button', { name: 'Acrescentar' })).toHaveProperty('disabled', true)
    fireEvent.change(dia, { target: { value: '20032026' } })
    fireEvent.change(within(form).getByLabelText('Vale para'), { target: { value: '4.03' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Acrescentar' }))
    await waitFor(() => expect(within(secao).getByRole('status').textContent).toBe('Acrescentado: 20/03/2026.'))

    fireEvent.click(within(secao).getByRole('button', { name: 'Tirar 20/11/2026 · Dia Nacional de Zumbi e da Consciência Negra (Lei 14.759/2023)' }))
    await waitFor(() => expect(within(secao).getByRole('status').textContent).toBe('Tirado: 20/11/2026.'))
    expect(mudancas(fetch)).toEqual([
      ['POST', '/api/configuracao/feriados/carga', undefined],
      ['POST', '/api/configuracao/feriados', { data: '20/03/2026', tribunal: '4.03', descricao: 'Suspensão: sistema fora do ar' }],
      ['DELETE', `/api/configuracao/feriados/${ID(1)}`, undefined],
    ])
  })

  it('quem só vê (a gestão sem a permissão de mudar) não tem botão nem formulário', async () => {
    servidor({ ...BASE, podeEditar: false })
    render(<FeriadosDosTribunais />)
    const secao = await screen.findByRole('region', { name: 'Feriados e suspensões dos tribunais' })
    expect(within(secao).queryByRole('button')).toBeNull()
    expect(within(secao).queryByRole('form')).toBeNull()
  })
})
