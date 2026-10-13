import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { ChanceDoCaso } from './ChanceDoCaso.tsx'

const CHANCE = {
  casos: 2,
  favoraveis: 1,
  porcentagem: 50,
  baseEm: '2026-10-07T15:00:00.000Z',
  regra: 'mesmo benefício',
  cor: 'amarelo',
  sugereNaoPegar: false,
  faltaSaber: ['o perito', 'o juízo', 'o parecer médico'],
  fatores: null,
  motivoIa: null,
}

function servidor() {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(CHANCE)))
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => {
  vi.unstubAllGlobals()
  entrarComo()
})

describe('ChanceDoCaso (GGVP-151)', () => {
  it('CA1 · sem caso, a chance do benefício escolhido, com a cor e o que falta saber', async () => {
    entrarComo('advogada')
    const fetch = servidor()
    render(comSessao(<ChanceDoCaso beneficio="pensao-morte" />))
    expect(await screen.findByText('Amarelo · de 15% a 50%')).toBeTruthy()
    expect(screen.getByText('50% · 1 de 2 casos · base de 07/10')).toBeTruthy()
    expect(screen.getAllByRole('listitem').map((i) => i.textContent)).toEqual(['o perito', 'o juízo', 'o parecer médico'])
    expect(fetch.mock.calls[0][0]).toBe('/api/chance?beneficio=pensao-morte')
  })

  it('CA2, CA4 · com o caso, a chance do caso, pedida ao servidor do caso', async () => {
    entrarComo('senior')
    const fetch = servidor()
    render(comSessao(<ChanceDoCaso casoId="6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6" />))
    expect(await screen.findByText('Amarelo · de 15% a 50%')).toBeTruthy()
    expect([fetch.mock.calls[0][0], fetch.mock.calls[0][1]?.method]).toEqual(['/api/casos/6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6/chance', 'POST'])
    expect(screen.getByText(/Uso interno: não vai ao cliente nem à peça/)).toBeTruthy()
  })

  it('CA5 · o Atendimento não vê e nada é pedido; sem caso nem benefício, nada aparece', async () => {
    entrarComo('atendimento')
    const fetch = servidor()
    const { container, unmount } = render(comSessao(<ChanceDoCaso casoId="6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6" />))
    expect([container.innerHTML, fetch.mock.calls.length]).toEqual(['', 0])
    unmount()
    entrarComo('advogada')
    expect(render(comSessao(<ChanceDoCaso />)).container.innerHTML).toBe('')
  })
})
