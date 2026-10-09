import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RecursoDoCaso } from '@ggv/contratos'
import { DecidirRecurso } from './DecidirRecurso.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const base: RecursoDoCaso = {
  casoId: CASO,
  pessoaId: '7a2b3c4d-5e6f-4a1b-9c2d-3e4f5a6b7c8d',
  cliente: 'Sérgio Nunes (exemplo)',
  beneficio: 'Auxílio-Acidente',
  sentenca: { disponibilizadaEm: '2026-10-05', texto: 'Sentença: julgo improcedente o pedido.' },
  prazo: { fim: '2026-10-20', regra: 'Recurso contra a sentença: 10 dias úteis (lado seguro, G12)' },
  chance: null,
  decisao: null,
  podeDecidir: true,
}

function servidor(get: RecursoDoCaso) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify({ ok: true }), { status: 201 }) : new Response(JSON.stringify(get)),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

describe('Decidir recurso (GGVP-100)', () => {
  it('CA4, CA8 · o prazo recursal em destaque, contado pelo sistema; sem jurimetria do juízo, diz que não há número', async () => {
    servidor(base)
    render(<DecidirRecurso casoId={CASO} />)
    expect((await screen.findByText('20/10/2026')).tagName).toBe('STRONG')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sérgio Nunes (exemplo) · Decidir recurso')
    expect(screen.getByText('A chance pela jurimetria ainda não está disponível para este juízo.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Antes de concluir' })).toBeTruthy()
  })

  it('CA3 · "Registrar" só habilita com a escolha e a justificativa; envia as duas', async () => {
    const fetch = servidor(base)
    render(<DecidirRecurso casoId={CASO} />)
    const registrar = (await screen.findByRole('button', { name: 'Registrar' })) as HTMLButtonElement
    expect(registrar.disabled).toBe(true)
    expect(screen.getByText('Escolha se vale recorrer')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Sim, recorrer' }))
    expect(registrar.disabled).toBe(true)
    expect(screen.getByText('Escreva a justificativa')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Justificativa *'), { target: { value: 'O laudo ignorou o médico assistente.' } })
    expect(registrar.disabled).toBe(false)
    fireEvent.click(registrar)
    await vi.waitFor(() => expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true))
    const [, init] = fetch.mock.calls.find(([, i]) => i?.method === 'POST')!
    expect(JSON.parse(String(init?.body))).toEqual({ decisao: 'recorrer', justificativa: 'O laudo ignorou o médico assistente.' })
  })

  it('CA3 · decidido, mostra quem decidiu e a justificativa; quem só lê não vê os botões', async () => {
    servidor({ ...base, podeDecidir: false, decisao: { decisao: 'nao_recorrer', justificativa: 'Laudo firme, sem prova nova.', por: 'Helena (exemplo)', em: '2026-10-09T13:00:00.000Z' } })
    render(<DecidirRecurso casoId={CASO} />)
    expect((await screen.findByRole('heading', { name: '✓ Não, encerrar com estudo de caso' })).textContent).toBeTruthy()
    expect(screen.getByText(/Decidido por Helena \(exemplo\) em .*Justificativa: Laudo firme, sem prova nova\./)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Registrar' })).toBeNull()
  })

  it('quem só lê, antes da decisão, vê que a decisão é da Sênior', async () => {
    servidor({ ...base, podeDecidir: false })
    render(<DecidirRecurso casoId={CASO} />)
    expect(await screen.findByText('A decisão é da Sênior e ainda não foi registrada.')).toBeTruthy()
    expect(screen.queryByRole('radio')).toBeNull()
  })
})
