import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Tentativas } from './Tentativas.tsx'

function servidor(corpo: object) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(corpo), { status: 200 })),
  )
}
afterEach(() => vi.unstubAllGlobals())

describe('Tentativas bloqueadas (GGVP-109)', () => {
  it('CA9 · mostra quando, quem, o caso e o que a pessoa tentou', async () => {
    servidor({
      tentativas: [
        {
          quando: '2026-10-06T17:30:00.000Z',
          quem: 'Ana',
          perfil: 'atendimento',
          casoId: '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6',
          cliente: 'Vera Lúcia (exemplo)',
          portao: 'G8',
          descricao: 'Avisar o cliente antes do OK da advogada na prestação de contas (G8)',
        },
        { quando: '2026-10-06T16:00:00.000Z', quem: 'Gabi', perfil: 'advogada', casoId: null, cliente: null, portao: 'perfil', descricao: 'Ação fora do perfil (vigilia.reprocessar)' },
      ],
    })
    render(<Tentativas />)
    const itens = within(await screen.findByRole('list', { name: 'Tentativas bloqueadas' })).getAllByRole('listitem')
    expect(itens.map((i) => i.textContent)).toEqual([
      '06/10/2026, 14:30 · Ana (Atendimento) · Vera Lúcia (exemplo) · Avisar o cliente antes do OK da advogada na prestação de contas (G8)',
      '06/10/2026, 13:00 · Gabi (Advogada responsável) · sem caso · Ação fora do perfil (vigilia.reprocessar)',
    ])
  })

  it('sem tentativa, diz que não há nenhuma', async () => {
    servidor({ tentativas: [] })
    render(<Tentativas />)
    expect(await screen.findByText('Nenhuma tentativa bloqueada.')).toBeTruthy()
  })
})
