import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App.tsx'

const usuario = { nome: 'Ana', email: 'ana@exemplo.ggv', perfis: ['atendimento'], perfilAtivo: 'atendimento', trocarSenha: false }

function servidorResponde(status: number, corpo: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(corpo), { status })))
}

afterEach(() => vi.unstubAllGlobals())

describe('App', () => {
  it('com sessão, na raiz abre a Central do Atendimento', async () => {
    servidorResponde(200, usuario)
    render(<App caminho="/" />)
    expect(await screen.findByRole('heading', { name: 'O que você tem que fazer' })).toBeTruthy()
  })

  it('em /tokens abre o guia de tokens, sem pedir sessão', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(<App caminho="/tokens" />)
    expect(screen.getByRole('heading', { name: 'Tokens do Figma' })).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('em rota sem tela avisa que não foi construída e mostra o caminho', async () => {
    servidorResponde(200, usuario)
    render(<App caminho="/clientes/novo" />)
    expect(await screen.findByRole('heading', { name: 'Esta tela ainda não foi construída' })).toBeTruthy()
    expect(screen.getByText('/clientes/novo')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar ao início' }).getAttribute('href')).toBe('/')
  })

  it('CA4 · sem perfil mostra o aviso e nenhuma tela de caso', async () => {
    servidorResponde(200, { ...usuario, perfis: [], perfilAtivo: null })
    render(<App caminho="/" />)
    expect(await screen.findByRole('heading', { name: 'Sem perfil, fale com a gestão.' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'O que você tem que fazer' })).toBeNull()
  })

  it('CA1 · senha provisória: abre a troca de senha antes de qualquer tela', async () => {
    servidorResponde(200, { ...usuario, trocarSenha: true })
    render(<App caminho="/" />)
    expect(await screen.findByRole('heading', { name: 'Crie a sua senha' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'O que você tem que fazer' })).toBeNull()
  })

  it('CA3 · sem sessão vai para o login guardando a tela de volta, e não mostra nada', async () => {
    servidorResponde(401, { erro: 'Sua sessão expirou. Entre de novo.' })
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, pathname: '/clientes/novo', search: '?aba=2', assign })
    const { container } = render(<App caminho="/clientes/novo" />)
    await vi.waitFor(() => expect(assign).toHaveBeenCalledOnce())
    expect(assign.mock.calls[0][0]).toBe('/entrar?volta=%2Fclientes%2Fnovo%3Faba%3D2')
    expect(container.textContent).toBe('')
  })

  it('GGVP-96 · cada perfil cai na sua Central; a da Sênior ainda não foi construída', async () => {
    servidorResponde(200, { ...usuario, perfis: ['senior'], perfilAtivo: 'senior' })
    render(<App caminho="/" />)
    expect(await screen.findByRole('heading', { name: 'Central · Sênior' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sênior' }).getAttribute('aria-haspopup')).toBe('menu')
    expect(screen.getByRole('button', { name: 'Sair' })).toBeTruthy()
  })

  it('GGVP-96 · a Documentação trabalha na Central do Atendimento', async () => {
    servidorResponde(200, { ...usuario, perfis: ['documentacao'], perfilAtivo: 'documentacao' })
    render(<App caminho="/" />)
    expect(await screen.findByRole('heading', { name: 'O que você tem que fazer' })).toBeTruthy()
  })
})
