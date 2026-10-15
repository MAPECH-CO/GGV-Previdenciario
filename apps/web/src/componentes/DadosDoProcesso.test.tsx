import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { DecidirPericia } from '../paginas/DecidirPericia.tsx'
import { DadosDoProcesso } from './DadosDoProcesso.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const PESSOA = '1a2b3c4d-1111-4222-8333-444455556666'
const RESUMO = {
  casoId: CASO,
  pessoa: { id: PESSOA, nome: 'Vera Lúcia', cpf: '27183946509', telefone: '11987654321' },
  beneficio: 'loas-deficiente',
  fase: 'administrativa',
  identificadores: { nb: '4561237895', protocolo: '2026123456', cnj: null },
  vara: null,
}

/** O servidor de mentira: o resumo do caso, ou a recusa do perfil que não vê o caso. */
function servidor(status = 200) {
  const fetch = vi.fn(async (url: string) =>
    url === `/api/casos/${CASO}/resumo` && status === 200 ? new Response(JSON.stringify(RESUMO)) : new Response(JSON.stringify({ erro: 'Sem permissão.' }), { status }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.pushState({}, '', '/')
})

describe('GGVP-86 CA14 · os dados do processo dentro da tarefa (Pedro, 14/10)', () => {
  it('mostra o cliente, o benefício, a fase e os números, com a ficha e o processo a um clique da advogada', async () => {
    servidor()
    entrarComo('advogada')
    render(comSessao(<DadosDoProcesso casoId={CASO} />))
    const bloco = (await screen.findByRole('heading', { name: 'Dados do processo' })).closest('section')!
    const linhas = [...bloco.querySelectorAll('dt')].map((dt) => `${dt.textContent}: ${dt.nextElementSibling?.textContent}`)
    expect(linhas).toEqual([
      'Cliente: Vera Lúcia',
      'CPF: 271.839.465-09',
      'Telefone: (11) 98765-4321',
      'Benefício: LOAS Deficiente',
      'Fase: Administrativa (INSS)',
      'NB: 456.123.789-5',
      'Requerimento: 2026123456',
    ])
    expect(within(bloco).getByRole('link', { name: 'Abrir a ficha' }).getAttribute('href')).toBe(`/clientes/${PESSOA}`)
    expect(within(bloco).getByRole('link', { name: 'Abrir o processo' }).getAttribute('href')).toBe(`/casos/${CASO}`)
  })

  it('a Documentação vê o bloco e abre a ficha, mas não o processo (GGVP-162)', async () => {
    servidor()
    entrarComo('documentacao')
    render(comSessao(<DadosDoProcesso casoId={CASO} />))
    const bloco = (await screen.findByRole('heading', { name: 'Dados do processo' })).closest('section')!
    expect(within(bloco).getByRole('link', { name: 'Abrir a ficha' })).toBeTruthy()
    expect(within(bloco).queryByRole('link', { name: 'Abrir o processo' })).toBeNull()
  })

  it('quem não vê o caso (o Financeiro) não vê o bloco', async () => {
    const fetch = servidor(403)
    entrarComo('financeiro')
    const { container } = render(comSessao(<DadosDoProcesso casoId={CASO} />))
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  it('a tela "Decidir perícia" do caso traz o bloco no topo, pelo endereço; fora de um caso, a moldura não pede nada', async () => {
    servidor()
    entrarComo('advogada')
    window.history.pushState({}, '', `/casos/${CASO}/pericia/decidir`)
    const { unmount } = render(comSessao(<DecidirPericia casoId={CASO} />))
    const bloco = (await screen.findByRole('heading', { name: 'Dados do processo' })).closest('section')!
    expect(bloco.textContent).toContain('Vera Lúcia')
    expect(screen.getByRole('heading', { level: 1, name: 'Precisa de perícia?' })).toBeTruthy()
    unmount()
    const fetch = servidor()
    window.history.pushState({}, '', '/')
    render(comSessao(<DecidirPericia casoId={CASO} />))
    expect(screen.queryByRole('heading', { name: 'Dados do processo' })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })
})
