import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { iniciarPerfil, lerPerfil } from '../dados/perfis.ts'
import { TrocarPerfil } from './TrocarPerfil.tsx'

beforeEach(() => {
  window.localStorage.clear()
  iniciarPerfil('')
})

describe('TrocarPerfil', () => {
  it('sem escolha, mostra a função da tela', () => {
    render(<TrocarPerfil funcao="Atendimento" />)
    expect(screen.getByRole('button', { name: 'Atendimento' }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('abre "Entrar como…" com os 6 perfis de exemplo, o atual marcado, e o glossário e o sair indisponíveis', () => {
    render(<TrocarPerfil funcao="Atendimento" />)
    fireEvent.click(screen.getByRole('button', { name: 'Atendimento' }))

    expect(screen.getByRole('menu', { name: 'Entrar como…' })).toBeTruthy()
    const perfis = screen.getAllByRole('menuitemradio')
    expect(perfis.map((p) => p.firstChild?.textContent)).toEqual([
      'Atendimento',
      'Atendimento · líder',
      'Advogada',
      'Sênior',
      'Financeiro',
      'Documentação',
    ])
    expect(perfis.filter((p) => p.getAttribute('aria-checked') === 'true')).toHaveLength(1)
    expect(perfis[0].getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('Dra. Paula (exemplo)')).toBeTruthy()
    for (const nome of ['Glossário · códigos e portões', 'Sair do portal']) {
      expect(screen.getByRole('menuitem', { name: nome }).getAttribute('aria-disabled'), nome).toBe('true')
    }
  })

  it('escolher um perfil troca o botão, fecha o menu e fica guardado para a próxima tela', () => {
    render(<TrocarPerfil funcao="Atendimento" />)
    fireEvent.click(screen.getByRole('button', { name: 'Atendimento' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: /^Advogada/ }))

    expect(screen.getByRole('button', { name: 'Advogada' })).toBeTruthy()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(lerPerfil('')?.id).toBe('advogada')
  })

  it('fecha com Esc e com clique fora', () => {
    render(<TrocarPerfil funcao="Atendimento" />)
    const botao = screen.getByRole('button', { name: 'Atendimento' })
    fireEvent.click(botao)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.click(botao)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('o endereço manda: ?perfil=financeiro abre a tela como Financeiro', () => {
    iniciarPerfil('?perfil=financeiro')
    render(<TrocarPerfil funcao="Atendimento" />)
    expect(screen.getByRole('button', { name: 'Financeiro' })).toBeTruthy()
  })
})
