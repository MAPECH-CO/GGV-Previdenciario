import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { voltaSegura } from '../api.ts'
import { Entrar } from './Entrar.tsx'

let assign: ReturnType<typeof vi.fn>

beforeEach(() => {
  assign = vi.fn()
  vi.stubGlobal('location', { ...window.location, assign })
})
afterEach(() => vi.unstubAllGlobals())

function preencher(email: string, senha: string) {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Senha'), { target: { value: senha } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('Entrar', () => {
  it('CA1 · com e-mail e senha certos entra e volta para a tela de onde veio', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ nome: 'Ana', email: 'a@b.co', perfil: 'atendimento', trocarSenha: false })))
    vi.stubGlobal('fetch', fetch)
    render(<Entrar busca="?volta=%2Fclientes%2Fnovo" />)
    preencher('ana@exemplo.ggv', 'senha-certa')
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/clientes/novo'))
    expect(fetch).toHaveBeenCalledWith('/api/sessao', expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'ana@exemplo.ggv', senha: 'senha-certa' }) }))
  })

  it('CA1 · senha provisória vai para a troca de senha, levando a volta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ nome: 'Bia', email: 'b@b.co', perfil: 'atendimento', trocarSenha: true }))))
    render(<Entrar busca="?volta=%2F" />)
    preencher('bia@exemplo.ggv', 'provisoria')
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/trocar-senha?volta=%2F'))
  })

  it('CA2 · senha errada mostra a mensagem do servidor, limpa a senha e não sai da tela', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ erro: 'E-mail ou senha inválidos.' }), { status: 401 })))
    render(<Entrar busca="" />)
    preencher('ana@exemplo.ggv', 'errada')
    expect((await screen.findByRole('alert')).textContent).toBe('E-mail ou senha inválidos.')
    expect((screen.getByLabelText('Senha') as HTMLInputElement).value).toBe('')
    expect(assign).not.toHaveBeenCalled()
  })

  it('e-mail inválido é barrado pela biblioteca campos, sem chamar o servidor', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(<Entrar busca="" />)
    preencher('ana@', 'x')
    expect(screen.getByText('Digite um e-mail válido.')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('CA3 · vindo de sessão expirada, avisa', () => {
    render(<Entrar busca="?expirou=1&volta=%2F" />)
    expect(screen.getByRole('status').textContent).toContain('Sua sessão expirou')
  })
})

describe('voltaSegura', () => {
  it('só aceita caminho interno', () => {
    expect(voltaSegura('/clientes/novo?aba=2')).toBe('/clientes/novo?aba=2')
    expect(voltaSegura('//site-malicioso.com')).toBe('/')
    expect(voltaSegura('https://site-malicioso.com')).toBe('/')
    expect(voltaSegura('/entrar')).toBe('/')
    expect(voltaSegura(null)).toBe('/')
  })
})
