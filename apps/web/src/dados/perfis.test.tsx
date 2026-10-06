import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App.tsx'
import { PERFIS } from './perfis.ts'

const perfil = (id: string) => PERFIS.find((p) => p.id === id)!

// As telas abrem depois de o servidor confirmar a sessão (GGVP-117): aqui ele responde com um usuário de exemplo.
const usuario = { nome: 'Ana', email: 'ana@exemplo.ggv', perfil: 'atendimento', trocarSenha: false }
afterEach(() => vi.unstubAllGlobals())

describe('tela inicial e ação de cada perfil', () => {
  it('segue o mapa: Atendimento e Documentação na Central do Atendimento, Advogada na dela', () => {
    expect(Object.fromEntries(PERFIS.map((p) => [p.id, p.inicio]))).toEqual({
      atendimento: '/',
      'atendimento-lider': '/atendimento-lider',
      advogada: '/advogada',
      senior: '/senior',
      financeiro: '/financeiro',
      documentacao: '/',
      'senior-2': '/senior',
    })
  })

  it('"+ Novo cliente" só onde o Figma tem: Atendimento, líder e a Documentação, que usa a Central do Atendimento', () => {
    const comAcao = PERFIS.filter((p) => p.acao).map((p) => p.id)
    expect(comAcao).toEqual(['atendimento', 'atendimento-lider', 'documentacao'])
    expect(perfil('atendimento').acao).toEqual({ rotulo: '+ Novo cliente', href: '/clientes/novo' })
  })

  it('função sem Central ainda cai em "Esta tela ainda não foi construída"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(usuario), { status: 200 })))
    for (const id of ['atendimento-lider', 'senior', 'financeiro']) {
      const { unmount } = render(<App caminho={perfil(id).inicio} />)
      expect(await screen.findByRole('heading', { name: 'Esta tela ainda não foi construída' }), id).toBeTruthy()
      unmount()
    }
  })
})
