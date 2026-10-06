import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Manifestar } from './Manifestar.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const base = {
  casoId: CASO,
  cliente: 'Paulo Reis (exemplo)',
  prazo: { fim: '2026-10-27', regra: 'Lei 11.419' },
  faltam: [],
  pendentes: [],
  versoes: [],
  dilacaoAutorizada: false,
  protocolo: null,
  podeAnexar: true,
  podeProtocolar: false,
  podeAutorizarDilacao: false,
}
const versao = (extra = {}) => ({ numero: 1, tipo: 'manifestacao', arquivo: 'peca.pdf', por: 'Gabi', em: '2026-10-05T15:00:00.000Z', aprovadaPor: null, aprovadaEm: null, ...extra })

function servidor(get: object, post: [number, unknown] = [201, { ok: true }]) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify(post[1]), { status: post[0] }) : new Response(JSON.stringify(get), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

describe('Manifestar e protocolar (GGVP-87)', () => {
  it('CA5 · com setor pendente, mostra o bloqueio com quem falta e o prazo; o botão fica desligado', async () => {
    servidor({ ...base, faltam: ['Atendimento'], pendentes: [{ setor: 'Atendimento', descricao: 'CTPS', prazoInterno: '2026-10-20' }] })
    render(<Manifestar casoId={CASO} />)
    expect((await screen.findByText(/Manifestar bloqueado/)).textContent).toBe('Manifestar bloqueado: falta Atendimento (G21).')
    expect(screen.getByText(/CTPS · até 20\/10\/2026/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Manifestar e protocolar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('G6 · aprovar a versão pede a marcação', async () => {
    servidor({ ...base, versoes: [versao()] })
    render(<Manifestar casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar a versão 1' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Marque "Aprovei a versão da manifestação (G6)"')
  })

  it('CA3 · protocolar pede o comprovante; com tudo, avisa a volta à vigília', async () => {
    servidor({ ...base, versoes: [versao({ aprovadaPor: 'Gabi', aprovadaEm: '2026-10-05T15:00:00.000Z' })], podeProtocolar: true }, [201, { ok: true, tipo: 'manifestacao' }])
    render(<Manifestar casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Manifestar e protocolar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Anexe o comprovante do protocolo (PDF ou imagem, até 25 MB).')
    fireEvent.change(screen.getByLabelText('Comprovante do protocolo'), { target: { files: [new File(['%PDF'], 'c.pdf', { type: 'application/pdf' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Manifestar e protocolar' }))
    expect((await screen.findByRole('status')).textContent).toBe('Manifestação protocolada. O processo voltou para a vigília.')
  })

  it('CA10 · protocolada, mostra a data, a versão e quem protocolou', async () => {
    servidor({ ...base, podeAnexar: false, protocolo: { em: '2026-10-05T15:00:00.000Z', versao: 2, tipo: 'manifestacao', por: 'Gabi' } })
    render(<Manifestar casoId={CASO} />)
    expect((await screen.findByLabelText('Protocolo')).textContent).toBe('Manifestação protocolada em 05/10/2026 · versão 2 · por Gabi')
  })

  it('CA12 · a Sênior autoriza a dilação, com o motivo obrigatório', async () => {
    servidor({ ...base, podeAnexar: false, faltam: ['Atendimento'], podeAutorizarDilacao: true })
    render(<Manifestar casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Autorizar a dilação' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva o motivo da dilação')
  })
})
