import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UsuarioDaSessao } from '@ggv/contratos'
import { CHAVE } from '../dados/servidor.ts'
import { SessaoContexto } from '../sessao.ts'
import { menuDoPerfil } from './menuDoPerfil.ts'
import { Topbar } from './Topbar.tsx'

afterEach(() => vi.unstubAllGlobals())

const itens = [
  { id: 'inicio', rotulo: 'Início', href: '/' },
  { id: 'agenda', rotulo: 'Agenda', href: '/agenda' },
]

const ana: UsuarioDaSessao = { nome: 'Ana Lima', email: 'ana@exemplo.ggv', perfis: ['atendimento'], perfilAtivo: 'atendimento', trocarSenha: false }

describe('Topbar', () => {
  it('mostra a marca, os botões da função com ícone e o atual aceso, a ação, o tema, o tamanho e a função', () => {
    render(
      <Topbar itens={itens} ativo="inicio" funcao="Atendimento" acao={{ rotulo: '+ Novo cliente', href: '/clientes/novo' }} />,
    )
    expect(screen.getByText('GGV Previdenciário')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'GGV Previdenciário, início' }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Início' }).querySelector('svg')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Agenda' }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('link', { name: '+ Novo cliente' }).getAttribute('href')).toBe('/clientes/novo')
    expect(screen.getByRole('button', { name: /^Mudar para o tema (escuro|claro)$/ })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Tamanho do portal' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Atendimento' })).toBeTruthy()
  })

  it('com sessão, mostra a pessoa pelo nome, e não a função', () => {
    render(
      <SessaoContexto value={ana}>
        <Topbar itens={itens} ativo="inicio" funcao="Atendimento" />
      </SessaoContexto>,
    )
    expect(screen.getByRole('button', { name: 'Ana Lima, Atendimento' }).getAttribute('aria-haspopup')).toBe('menu')
  })

  it('a troca de função, ainda não ligada, avisa que está indisponível e não promete menu', () => {
    render(<Topbar itens={itens} ativo="inicio" funcao="Atendimento" />)
    const funcao = screen.getByRole('button', { name: 'Atendimento' })
    expect(funcao.getAttribute('aria-disabled')).toBe('true')
    expect(funcao.getAttribute('aria-haspopup')).toBeNull()
  })

  it('GGVP-159 · Sair encerra a sessão e apaga a cópia do navegador', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))
    const assign = vi.fn()
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('location', { ...window.location, assign })
    sessionStorage.setItem(CHAVE, '{"fichas":[]}')
    render(
      <SessaoContexto value={ana}>
        <Topbar itens={itens} ativo="inicio" funcao="Atendimento" />
      </SessaoContexto>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Ana Lima, Atendimento' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sair' }))
    expect(sessionStorage.getItem(CHAVE)).toBeNull()
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/entrar'))
    expect(fetch).toHaveBeenCalledWith('/api/sessao', expect.objectContaining({ method: 'DELETE' }))
  })
})

describe('GGVP-78 · o topo pelo perfil da sessão, igual em toda tela', () => {
  const ids = (perfil: string | null) => {
    const { principais, gestao } = menuDoPerfil(perfil)
    return { principais: principais.map((i) => i.id), gestao: gestao.map((i) => i.id) }
  }

  it('Clientes e Processos depois do Início e da Agenda; a líder só com Clientes (GGVP-162); a Gestão à parte', () => {
    expect(ids('atendimento_lider')).toEqual({ principais: ['inicio', 'balcao', 'agenda', 'clientes'], gestao: ['tentativas', 'prazos', 'cofre', 'resultados', 'configuracao'] })
    expect(ids('advogada')).toEqual({ principais: ['inicio', 'agenda', 'clientes', 'processos'], gestao: [] })
    expect(ids('senior')).toEqual({
      principais: ['inicio', 'agenda', 'clientes', 'processos', 'estudos', 'roteiros'],
      gestao: ['tentativas', 'prazos', 'cofre', 'resultados', 'configuracao', 'importar'],
    })
  })

  it('o Atendimento tem a Agenda; o Financeiro, que não vê o caso, fica sem ela e com os Resultados e o painel Financeiro', () => {
    expect(ids('atendimento')).toEqual({ principais: ['inicio', 'balcao', 'agenda'], gestao: [] })
    expect(ids('financeiro')).toEqual({ principais: ['inicio', 'financeiro', 'custas'], gestao: ['resultados'] })
    expect(ids(null)).toEqual({ principais: ['inicio'], gestao: [] })
  })

  it('GGVP-162 CA8 e CA9 · o Sócio tem as bases e as telas de consulta; a vigília no topo é só dele', () => {
    expect(ids('socio')).toEqual({
      principais: ['inicio', 'agenda', 'clientes', 'processos', 'estudos', 'roteiros', 'vigilia', 'financeiro', 'custas'],
      gestao: ['tentativas', 'prazos', 'cofre', 'resultados', 'configuracao', 'importar'],
    })
    for (const perfil of ['advogada', 'senior', 'juridico_adm', 'atendimento_lider']) expect(ids(perfil).principais).not.toContain('vigilia')
  })

  it('GGVP-157 · as Custas ao lado do painel Financeiro, para quem vê valores: o Financeiro e o Sócio; os outros, não', () => {
    expect(ids('financeiro').principais.at(-1)).toBe('custas')
    expect(ids('socio').principais.at(-1)).toBe('custas')
    for (const perfil of ['senior', 'atendimento_lider', 'advogada', 'juridico_adm', 'atendimento', 'documentacao'])
      expect(ids(perfil).principais, perfil).not.toContain('custas')
  })

  it('com sessão, o topo ignora a lista da tela: o mesmo menu em qualquer página; a Gestão abre num menu só', () => {
    const helena = { ...ana, nome: 'Helena', perfis: ['senior'], perfilAtivo: 'senior' }
    render(
      <SessaoContexto value={helena}>
        <Topbar itens={[{ id: 'qualquer', rotulo: 'Qualquer', href: '/x' }]} ativo="prazos" funcao="" />
      </SessaoContexto>,
    )
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(screen.queryByRole('link', { name: 'Qualquer' })).toBeNull()
    expect(nav.textContent).toContain('Roteiros de laudos')
    const gestao = screen.getByRole('button', { name: 'Gestão · Prazos' })
    expect(screen.queryByRole('link', { name: 'Tentativas bloqueadas' })).toBeNull()
    fireEvent.click(gestao)
    expect(gestao.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('link', { name: 'Prazos' }).getAttribute('aria-current')).toBe('page')
    fireEvent.keyDown(screen.getByRole('link', { name: 'Tentativas bloqueadas' }), { key: 'Escape' })
    expect(screen.queryByRole('link', { name: 'Tentativas bloqueadas' })).toBeNull()
    expect(document.activeElement).toBe(gestao)
  })

  it('o Financeiro, com um item só de gestão, tem os Resultados soltos, sem o menu', () => {
    const julia = { ...ana, nome: 'Júlia', perfis: ['financeiro'], perfilAtivo: 'financeiro' }
    render(
      <SessaoContexto value={julia}>
        <Topbar itens={[]} ativo="inicio" funcao="" />
      </SessaoContexto>,
    )
    expect(screen.getByRole('link', { name: 'Resultados' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Gestão/ })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Agenda' })).toBeNull()
  })
})
