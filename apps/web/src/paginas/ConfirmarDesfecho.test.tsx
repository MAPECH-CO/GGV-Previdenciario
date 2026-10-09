import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DesfechoParaConfirmar } from '@ggv/contratos'
import { ConfirmarDesfecho } from './ConfirmarDesfecho.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const base: DesfechoParaConfirmar = {
  casoId: CASO,
  fichaId: '7a2d3c4b-5e6f-4a70-9b8c-1d2e3f4a5b6c',
  cliente: 'Rosa Lima (exemplo)',
  beneficio: 'bpc_loas_idoso',
  decisao: { disponibilizadaEm: '2026-10-05', fonte: 'djen', numeroCnj: '50001014520234036301', texto: 'JULGO PROCEDENTE EM PARTE o pedido.', classeSugeridaIa: 'merito', confiancaIa: 0.91 },
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
/** O valor de uma linha do cartão da decisão (chave e valor, como no Figma). */
const linha = (chave: string) => screen.getByText(chave, { selector: 'dt' }).nextElementSibling?.textContent

describe('Confirmar o desfecho de mérito (GGVP-90)', () => {
  it('CA3 · mostra o processo, o trecho, a leitura da IA com a confiança e o prazo do recurso', async () => {
    servidor(base)
    render(<ConfirmarDesfecho casoId={CASO} />)
    await screen.findByRole('region', { name: 'Decisão de mérito' })
    expect(screen.getByText('sentença publicada 05/10 · mérito')).toBeTruthy()
    expect(linha('Processo')).toBe('5000101-45.2023.4.03.6301')
    expect(linha('Trecho')).toBe('"…JULGO PROCEDENTE EM PARTE o pedido.…"')
    expect(linha('Leitura da IA')).toBe('decisão de mérito · confiança de 91%')
    expect(linha('Prazo do recurso')).toBe('21/10/2026')
  })

  it('CA4 · procedente em parte por RPV: envia a forma e diz o passo seguinte', async () => {
    const fetch = servidor(base)
    render(<ConfirmarDesfecho casoId={CASO} />)
    fireEvent.click(await screen.findByRole('radio', { name: 'Procedente parcial' }))
    fireEvent.click(screen.getByRole('radio', { name: 'RPV' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect((await screen.findByRole('status')).textContent).toBe('Desfecho confirmado. Nasceu "Acompanhar pagamento".')
    expect(corpoDo(fetch)).toEqual({ desfecho: 'procedente_parcial', forma: 'rpv' })
  })

  it('CA3 · extinção sem a causa não envia; sem escolher, também não', async () => {
    const fetch = servidor(base)
    render(<ConfirmarDesfecho casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escolha o desfecho da decisão')
    fireEvent.click(screen.getByRole('radio', { name: 'Extinto sem julgar o mérito' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva a causa da extinção sem mérito')
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })

  it('CA4 · depois de confirmado, mostra o desfecho, quem confirmou e quando; outro perfil vê só a situação', async () => {
    servidor({ ...base, podeConfirmar: false, confirmado: { desfecho: 'improcedente', causa: null, forma: null, por: 'Gabi (exemplo)', em: '2026-10-09T13:00:00.000Z' } })
    render(<ConfirmarDesfecho casoId={CASO} />)
    expect(await screen.findByRole('heading', { name: '✓ Improcedente' })).toBeTruthy()
    expect(screen.getByText('Confirmado por Gabi (exemplo) em 09/10/2026, 10:00')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull()
    cleanup()
    servidor({ ...base, podeConfirmar: false })
    render(<ConfirmarDesfecho casoId={CASO} />)
    expect(await screen.findByText('O desfecho espera a confirmação da advogada.')).toBeTruthy()
  })

  it('CA3 · a tela do passo: o topo, "O que você deve fazer" com a ficha do cliente e "Antes de concluir"', async () => {
    servidor(base)
    render(<ConfirmarDesfecho casoId={CASO} />)
    expect(await screen.findByRole('heading', { name: 'O que você deve fazer' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Rosa Lima (exemplo) · Confirmar desfecho')
    expect(screen.getByRole('radiogroup', { name: 'A ação foi procedente?' }).textContent).toBe(
      'Procedente totalProcedente parcialImprocedenteExtinto sem julgar o mérito',
    )
    expect(screen.getByRole('link', { name: 'Abrir a ficha do cliente' }).getAttribute('href')).toBe('/clientes/7a2d3c4b-5e6f-4a70-9b8c-1d2e3f4a5b6c')
    expect(screen.getByRole('complementary', { name: 'Antes de concluir' }).textContent).toContain('a Sênior recebe "Decidir recurso"')
  })
})
