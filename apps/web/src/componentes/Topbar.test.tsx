import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { iniciarPerfil, trocarPerfil } from '../dados/perfis.ts'
import { Topbar } from './Topbar.tsx'

beforeEach(() => {
  window.localStorage.clear()
  iniciarPerfil('')
})

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

  it('a função abre o menu "Entrar como…"', () => {
    render(<Topbar itens={itens} ativo="inicio" funcao="Atendimento" />)
    const funcao = screen.getByRole('button', { name: 'Atendimento' })
    expect(funcao.getAttribute('aria-haspopup')).toBe('menu')
    expect(funcao.getAttribute('aria-disabled')).toBeNull()
  })

  it('com um perfil escolhido, o início e a ação principal passam a ser os da função; sem escolha, ficam os da tela', () => {
    const acao = { rotulo: '+ Novo cliente', href: '/clientes/novo' }
    render(<Topbar itens={itens} ativo="inicio" funcao="Atendimento" acao={acao} />)
    expect(screen.getByRole('link', { name: '+ Novo cliente' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('href')).toBe('/')

    act(() => trocarPerfil('advogada'))
    expect(screen.queryByRole('link', { name: '+ Novo cliente' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('href')).toBe('/advogada')
    expect(screen.getByRole('link', { name: 'GGV Previdenciário, início' }).getAttribute('href')).toBe('/advogada')
    expect(screen.getByRole('link', { name: 'Agenda' }).getAttribute('href')).toBe('/agenda')

    act(() => trocarPerfil('documentacao'))
    expect(screen.getByRole('link', { name: '+ Novo cliente' }).getAttribute('href')).toBe('/clientes/novo')
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('href')).toBe('/')
  })
})
