import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WidgetNoChat } from './WidgetsDoChat.tsx'

describe('os widgets do chat (12/10)', () => {
  it('números com o rótulo e o valor', () => {
    render(
      <WidgetNoChat
        widget={{
          tipo: 'numeros',
          itens: [
            { rotulo: 'Abertas', valor: 12 },
            { rotulo: 'Urgentes', valor: 4, tom: 'erro' },
          ],
        }}
      />,
    )
    const lista = screen.getByRole('list', { name: 'Números' })
    expect(within(lista).getAllByRole('listitem').map((i) => i.textContent)).toEqual(['Abertas12', 'Urgentes4'])
  })

  it('lista: a linha inteira é o link quando há link; o selo aparece', () => {
    render(
      <WidgetNoChat
        widget={{
          tipo: 'lista',
          titulo: 'Tarefas',
          itens: [{ titulo: 'Ana · Cobrar', sub: 'pendente', href: '/casos/a', selo: { texto: 'hoje', tom: 'acento' } }, { titulo: 'Sem link' }],
        }}
      />,
    )
    expect(screen.getByRole('link', { name: /Ana · Cobrar/ }).getAttribute('href')).toBe('/casos/a')
    expect(screen.getByText('hoje')).toBeTruthy()
    expect(screen.getByText('Sem link').closest('a')).toBeNull()
  })

  it('prazos: a lista leva a data; o fim de semana fica só na lista', () => {
    render(
      <WidgetNoChat
        widget={{
          tipo: 'prazos',
          titulo: 'Prazos da semana',
          inicio: '2026-10-12',
          itens: [
            { data: '2026-10-13', oQue: 'Manifestar', urgente: true },
            { data: '2026-10-17', oQue: 'Sábado', urgente: false },
          ],
        }}
      />,
    )
    const lista = screen.getByRole('list', { name: 'Prazos da semana' })
    expect(within(lista).getAllByRole('listitem').map((i) => i.textContent)).toEqual(['13/10Manifestar', '17/10Sábado'])
  })

  it('etapas: a atual com aria-current', () => {
    render(
      <WidgetNoChat
        widget={{
          tipo: 'etapas',
          itens: [
            { rotulo: 'INSS', estado: 'feita' },
            { rotulo: 'Vigília', estado: 'atual' },
            { rotulo: 'Desfecho', estado: 'futura' },
          ],
        }}
      />,
    )
    expect(screen.getByText('Vigília').closest('li')!.getAttribute('aria-current')).toBe('step')
  })

  it('linha do tempo e barras', () => {
    render(<WidgetNoChat widget={{ tipo: 'linha-do-tempo', titulo: 'Últimos', itens: [{ quando: '2026-10-10', quem: 'Ana', texto: 'Juiz pediu perícia' }] }} />)
    expect(screen.getByRole('list', { name: 'Últimos' }).textContent).toContain('10/10')
    render(
      <WidgetNoChat
        widget={{
          tipo: 'barras',
          titulo: 'Por cliente',
          itens: [
            { rotulo: 'Ana', valor: 3 },
            { rotulo: 'Beto', valor: 1 },
          ],
        }}
      />,
    )
    expect(within(screen.getByRole('list', { name: 'Por cliente' })).getAllByRole('listitem').map((i) => i.textContent)).toEqual(['Ana3', 'Beto1'])
  })
})
