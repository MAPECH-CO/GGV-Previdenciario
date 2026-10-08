import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Topbar } from './Topbar.tsx'

const itens = [
  { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' },
  { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
]

describe('Topbar', () => {
  it('mostra a marca, os botões da função com o atual aceso, a ação, tema e fonte e a função', () => {
    render(
      <Topbar itens={itens} ativo="inicio" funcao="Atendimento" acao={{ rotulo: '+ Novo cliente', href: '/clientes/novo' }} />,
    )
    expect(screen.getByText('GGV Previdenciário')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'GGV Previdenciário, início' }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Agenda' }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('link', { name: '+ Novo cliente' }).getAttribute('href')).toBe('/clientes/novo')
    expect(screen.getByRole('button', { name: /^Mudar para o tema (escuro|claro)$/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^(Aumentar|Diminuir) a fonte$/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Atendimento' })).toBeTruthy()
  })

  it('a troca de função, ainda não ligada, avisa que está indisponível e não promete menu', () => {
    render(<Topbar itens={itens} ativo="inicio" funcao="Atendimento" />)
    const funcao = screen.getByRole('button', { name: 'Atendimento' })
    expect(funcao.getAttribute('aria-disabled')).toBe('true')
    expect(funcao.getAttribute('aria-haspopup')).toBeNull()
  })
})
