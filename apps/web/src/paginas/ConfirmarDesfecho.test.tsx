import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DesfechoParaConfirmar } from '@ggv/contratos'
import { ConfirmarDesfecho } from './ConfirmarDesfecho.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const base: DesfechoParaConfirmar = {
  casoId: CASO,
  cliente: 'Rosa Lima (exemplo)',
  beneficio: 'bpc_loas_idoso',
  decisao: { disponibilizadaEm: '2026-10-05', fonte: 'djen', texto: 'JULGO PROCEDENTE EM PARTE o pedido.', classeSugeridaIa: 'merito', confiancaIa: 0.91 },
  prazoRecurso: '2026-10-21',
  confirmado: null,
  podeConfirmar: true,
}

function servidor(get: DesfechoParaConfirmar, post: { status: number; corpo: object } = { status: 201, corpo: { ok: true } }) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify(post.corpo), { status: post.status }) : new Response(JSON.stringify(get)),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const corpoDo = (fetch: ReturnType<typeof servidor>) => JSON.parse(String(fetch.mock.calls.find(([, init]) => init?.method === 'POST')?.[1]?.body))

describe('Confirmar o desfecho de mérito (GGVP-90)', () => {
  it('CA3 · mostra o trecho, a leitura da IA com a confiança e o prazo do recurso', async () => {
    servidor(base)
    render(<ConfirmarDesfecho casoId={CASO} />)
    expect(await screen.findByText('JULGO PROCEDENTE EM PARTE o pedido.')).toBeTruthy()
    expect(screen.getByText(/Leitura da IA: decisão de mérito · confiança de 91%/)).toBeTruthy()
    expect(screen.getByText('Prazo do recurso: 21/10/2026')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Decisão de 05/10/2026 · DJEN' })).toBeTruthy()
  })

  it('CA4 · procedente em parte por RPV: envia a forma e diz o passo seguinte', async () => {
    const fetch = servidor(base)
    render(<ConfirmarDesfecho casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Procedente em parte'))
    fireEvent.click(screen.getByLabelText('RPV'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar desfecho' }))
    expect((await screen.findByRole('status')).textContent).toBe('Desfecho confirmado. Nasceu "Acompanhar pagamento".')
    expect(corpoDo(fetch)).toEqual({ desfecho: 'procedente_parcial', forma: 'rpv' })
  })

  it('CA3 · extinção sem a causa não envia; sem escolher, também não', async () => {
    const fetch = servidor(base)
    render(<ConfirmarDesfecho casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar desfecho' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escolha o desfecho da decisão')
    fireEvent.click(screen.getByLabelText('Extinto sem julgar o mérito'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar desfecho' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva a causa da extinção sem mérito')
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('CA4 · depois de confirmado, mostra o desfecho, quem confirmou e quando; outro perfil vê só a situação', async () => {
    servidor({ ...base, podeConfirmar: false, confirmado: { desfecho: 'improcedente', causa: null, forma: null, por: 'Gabi (exemplo)', em: '2026-10-09T13:00:00.000Z' } })
    render(<ConfirmarDesfecho casoId={CASO} />)
    expect(await screen.findByRole('heading', { name: '✓ Improcedente' })).toBeTruthy()
    expect(screen.getByText('Confirmado por Gabi (exemplo) em 09/10/2026, 10:00')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirmar desfecho' })).toBeNull()
    cleanup()
    servidor({ ...base, podeConfirmar: false })
    render(<ConfirmarDesfecho casoId={CASO} />)
    expect(await screen.findByText('O desfecho espera a confirmação da advogada.')).toBeTruthy()
  })
})
