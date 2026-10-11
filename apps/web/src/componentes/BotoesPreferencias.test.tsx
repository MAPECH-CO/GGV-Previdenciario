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

  it('aumenta e diminui o tamanho de 10 em 10; o número volta a 100%', () => {
    render(<BotoesPreferencias />)
    const aumentar = screen.getByRole('button', { name: 'Aumentar o tamanho' })
    fireEvent.click(aumentar)
    fireEvent.click(aumentar)
    expect(document.documentElement.style.zoom).toBe('1.2')
    expect(screen.getByRole('button', { name: 'Tamanho em 120%. Voltar a 100%' }).textContent).toBe('120%')
    fireEvent.click(screen.getByRole('button', { name: 'Diminuir o tamanho' }))
    expect(document.documentElement.style.zoom).toBe('1.1')
    fireEvent.click(screen.getByRole('button', { name: /^Tamanho em 110%/ }))
    expect(document.documentElement.style.zoom).toBe('')
  })

  it('nos limites, o botão daquele lado fica desligado', () => {
    iniciarPreferencias('?escala=70')
    render(<BotoesPreferencias />)
    expect((screen.getByRole('button', { name: 'Diminuir o tamanho' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Aumentar o tamanho' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('dois conjuntos de botões na tela ficam em sincronia', () => {
    render(
      <>
        <BotoesPreferencias />
        <BotoesPreferencias empilhado />
      </>,
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Mudar para o tema escuro' })[0])
    expect(screen.getAllByRole('button', { name: 'Mudar para o tema claro' })).toHaveLength(2)
  })
})
