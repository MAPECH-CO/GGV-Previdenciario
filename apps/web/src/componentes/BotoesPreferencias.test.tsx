import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { iniciarPreferencias } from '../design/preferencias.ts'
import { BotoesPreferencias } from './BotoesPreferencias.tsx'

beforeEach(() => {
  window.localStorage.clear()
  iniciarPreferencias('')
})

describe('BotoesPreferencias', () => {
  it('alterna o tema claro e escuro', () => {
    render(<BotoesPreferencias />)
    fireEvent.click(screen.getByRole('button', { name: 'Mudar para o tema escuro' }))
    expect(document.documentElement.dataset.tema).toBe('escuro')
    fireEvent.click(screen.getByRole('button', { name: 'Mudar para o tema claro' }))
    expect(document.documentElement.dataset.tema).toBe('claro')
  })

  it('alterna a fonte padrão e grande', () => {
    render(<BotoesPreferencias />)
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar a fonte' }))
    expect(document.documentElement.dataset.fonte).toBe('grande')
    expect(screen.getByRole('button', { name: 'Diminuir a fonte' }).textContent).toBe('A−')
  })

  it('dois conjuntos de botões na tela ficam em sincronia', () => {
    render(
      <>
        <BotoesPreferencias />
        <BotoesPreferencias />
      </>,
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Mudar para o tema escuro' })[0])
    expect(screen.getAllByRole('button', { name: 'Mudar para o tema claro' })).toHaveLength(2)
  })
})
