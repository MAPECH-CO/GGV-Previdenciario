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
  etapa: 'depois_do_laudo',
  aviso: null,
}

function servidor(chance: object = CHANCE) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(chance)))
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
    // GGVP-163 R6: a etapa da conta aparece; sem aviso, nenhuma nota.
    expect(screen.getByText('Etapa da conta: depois do laudo.')).toBeTruthy()
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('GGVP-163 R6 · o recorte vazio cai na etapa anterior, com o aviso do servidor; "outro" sem chance mostra o motivo', async () => {
    entrarComo('advogada')
    servidor({ ...CHANCE, etapa: 'antes_da_pericia', aviso: 'Nenhum caso da base com o mesmo laudo: a chance é a de antes da perícia.' })
    render(comSessao(<ChanceDoCaso casoId="6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6" />))
    expect(await screen.findByText('Etapa da conta: antes da perícia.')).toBeTruthy()
    expect(screen.getByRole('note').textContent).toBe('Nenhum caso da base com o mesmo laudo: a chance é a de antes da perícia.')
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
