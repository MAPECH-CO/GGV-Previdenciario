import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UsuarioDaSessao } from '@ggv/contratos'
import { Exige } from '../paginas/SemPermissao.tsx'
import { SessaoContexto } from '../sessao.ts'
import { EntrarComo } from './EntrarComo.tsx'

const eva: UsuarioDaSessao = {
  nome: 'Eva',
  email: 'eva@exemplo.ggv',
  perfis: ['atendimento_lider', 'atendimento'],
  perfilAtivo: 'atendimento_lider',
  trocarSenha: false,
}

afterEach(() => vi.unstubAllGlobals())

describe('Entrar como… (GGVP-96 CA10)', () => {
  it('mostra o perfil ativo e, aberto, só os perfis atribuídos à pessoa', () => {
    render(<EntrarComo usuario={eva} />)
    const botao = screen.getByRole('button', { name: 'Atendimento · líder' })
    expect(botao.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(botao)
    const itens = screen.getAllByRole('menuitemradio').map((i) => [i.textContent, i.getAttribute('aria-checked')])
    expect(itens).toEqual([
      ['Atendimento · líder', 'true'],
      ['Atendimento', 'false'],
    ])
    expect(screen.queryByRole('menuitemradio', { name: 'Sênior' })).toBeNull()
  })

  it('escolher outro perfil pede ao servidor e volta ao início', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ...eva, perfilAtivo: 'atendimento' })))
    const assign = vi.fn()
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('location', { ...window.location, assign })
    render(<EntrarComo usuario={eva} />)
    fireEvent.click(screen.getByRole('button', { name: 'Atendimento · líder' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Atendimento' }))
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/'))
    expect(fetch).toHaveBeenCalledWith('/api/sessao/perfil', expect.objectContaining({ method: 'POST', body: JSON.stringify({ perfil: 'atendimento' }) }))
  })

  it('Esc fecha o menu', () => {
    render(<EntrarComo usuario={eva} />)
    fireEvent.click(screen.getByRole('button', { name: 'Atendimento · líder' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('Sem permissão (GGVP-96 CA9 e CA11)', () => {
  const Tela = vi.fn(() => <h1>Conferência da Sênior</h1>)

  it('sem a permissão, avisa e a tela nem monta (nenhum dado é pedido)', () => {
    render(
      <SessaoContexto value={eva}>
        <Exige acao="caso.aprovar_para_inss">
          <Tela />
        </Exige>
      </SessaoContexto>,
    )
    expect(screen.getByRole('heading', { name: 'Sem permissão' })).toBeTruthy()
    expect(Tela).not.toHaveBeenCalled()
  })

  it('com a permissão, mostra a tela', () => {
    render(
      <SessaoContexto value={{ ...eva, perfis: ['senior'], perfilAtivo: 'senior' }}>
        <Exige acao="caso.aprovar_para_inss">
          <Tela />
        </Exige>
      </SessaoContexto>,
    )
    expect(screen.getByRole('heading', { name: 'Conferência da Sênior' })).toBeTruthy()
  })
})
