import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Peritos } from './Peritos.tsx'
afterEach(() => vi.unstubAllGlobals())
describe('Cadastro de peritos', () => {
  it('lista só os peritos da API e avisa que gravar cadastro depende do servidor', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify([{ id: 'perito-inventado', nome: 'Perito Inventado', especialidade: 'Área fictícia', tipo: 'medica' }]), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    render(<Peritos />)
    await screen.findByText('Perito Inventado')
    expect((screen.getByRole('button', { name: 'Cadastrar perito' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'inexistente' } })
    expect(screen.queryByText('Perito Inventado')).toBeNull()
    expect(screen.getByText('Nenhum perito encontrado.')).toBeTruthy()
    expect(fetch.mock.calls).toHaveLength(1)
  })
  it('falha do servidor não mostra o cadastro de exemplo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ erro: 'Consulta indisponível.' }), { status: 503 })))
    render(<Peritos />)
    expect((await screen.findByRole('alert')).textContent).toBe('Consulta indisponível.')
    expect(screen.queryByText(/Prado/)).toBeNull()
  })
})
