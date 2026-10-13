import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { ChatDoPortal } from './ChatDoPortal.tsx'

// A resposta em blocos só vem do servidor com a IA; aqui o `perguntar` devolve uma pronta.
vi.mock('../dados/chat.ts', async (original) => ({ ...(await original<typeof import('../dados/chat.ts')>()), perguntar: vi.fn() }))
const { perguntar } = await import('../dados/chat.ts')

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 12, 10, 0), latencia: 0 })
  zerarExemplo()
  entrarComo()
})

describe('12/10 · a resposta em blocos', () => {
  it('desenha texto e widget na ordem dos blocos', async () => {
    const sugestao = { chamadaId: '00000000-0000-4000-8000-000000000001', sugestao: true as const, texto: 'Hoje: ', fontes: [], modelo: 'gpt-4.1-mini', geradaEm: '2026-10-12T10:00:00Z', alerta: null }
    vi.mocked(perguntar).mockResolvedValue({
      tipo: 'resposta',
      sugestao,
      links: [],
      blocos: [
        { tipo: 'texto', texto: 'Hoje você tem **2**:' },
        { tipo: 'widget', widget: { tipo: 'numeros', itens: [{ rotulo: 'Abertas', valor: 2 }] } },
      ],
    })
    render(comSessao(<ChatDoPortal exemplo="Ex.:" sugestoes={[]} funcao="Advogada" />))
    fireEvent.change(screen.getByLabelText('✦ Pergunte ou peça'), { target: { value: 'O que tem hoje?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    const numeros = await screen.findByRole('list', { name: 'Números' })
    const negrito = screen.getByText('2', { selector: 'strong' })
    expect(negrito.compareDocumentPosition(numeros) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
