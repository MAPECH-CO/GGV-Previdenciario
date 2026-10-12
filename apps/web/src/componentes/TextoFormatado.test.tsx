import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TextoFormatado } from './TextoFormatado.tsx'

describe('TextoFormatado (12/10)', () => {
  it('desenha negrito, lista, tabela e link do portal; texto puro continua um parágrafo só', () => {
    const { container } = render(<TextoFormatado texto={'Hoje: **4 urgentes**.\n\n- [Abrir](/casos/1)\n- dois\n\n| A | B |\n|---|---|\n| 1 | 2 |'} />)
    expect(container.querySelector('strong')?.textContent).toBe('4 urgentes')
    expect(screen.getByRole('link', { name: 'Abrir' }).getAttribute('href')).toBe('/casos/1')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    const tabela = screen.getByRole('table')
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['A', 'B'])
    render(<TextoFormatado texto="Antônio Exemplo está em Vigília." />)
    expect(screen.getByText('Antônio Exemplo está em Vigília.').tagName).toBe('P')
  })

  it('HTML vindo da IA aparece como texto', () => {
    const { container } = render(<TextoFormatado texto="<img src=x onerror=alert(1)>" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('<img src=x onerror=alert(1)>')
  })
})
