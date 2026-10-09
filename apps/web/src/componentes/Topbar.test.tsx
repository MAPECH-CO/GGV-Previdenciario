import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHAVE } from '../dados/servidor.ts'
import { Topbar } from './Topbar.tsx'

afterEach(() => vi.unstubAllGlobals())

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

  it('GGVP-117 · Sair encerra a sessão; a cópia do navegador fica para o roteiro na mesma aba (09/10)', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))
    const assign = vi.fn()
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('location', { ...window.location, assign })
    sessionStorage.setItem(CHAVE, '{"fichas":[]}')
    render(<Topbar itens={itens} ativo="inicio" funcao="Atendimento" />)
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(sessionStorage.getItem(CHAVE)).toBe('{"fichas":[]}')
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/entrar'))
    expect(fetch).toHaveBeenCalledWith('/api/sessao', expect.objectContaining({ method: 'DELETE' }))
  })
})
