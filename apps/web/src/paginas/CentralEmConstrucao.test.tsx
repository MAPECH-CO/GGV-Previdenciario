import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { CentralAtendimento } from './CentralAtendimento.tsx'
import { CentralEmConstrucao } from './CentralEmConstrucao.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 8, 14, 32), latencia: 0 })
  zerarExemplo()
  // A fila do servidor vem vazia: o que aparece é o da tela.
  vi.stubGlobal('fetch', vi.fn(async () => new Response('[]', { status: 200 })))
})
afterEach(() => vi.unstubAllGlobals())

const topo = () => within(screen.getByRole('navigation', { name: 'Principal' })).getAllByRole('link').map((a) => a.textContent?.replace(/^\S+ /, ''))
const sugestoes = () => within(screen.getByRole('region', { name: 'Chat com a IA' })).getAllByRole('button').map((b) => b.textContent)

describe('GGVP-135 · a Central da Sênior, do Financeiro e do Sócio, como as outras (P11)', () => {
  it('a Sênior: a busca, o chat com as sugestões do Figma, os roteiros de laudos e a Gestão no topo', async () => {
    entrarComo('senior')
    render(comSessao(<CentralEmConstrucao rotulo="Sênior" />))
    expect(screen.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' })).toBeTruthy()
    expect(sugestoes()).toEqual(expect.arrayContaining(['O que estourou o limite?', 'Criar tarefa', 'Casos para conferir', 'Subir no acervo']))
    expect(topo()).toEqual(['Início', 'Estudos de caso', 'Roteiros de laudos', 'Tentativas bloqueadas', 'Prazos', 'Uso do cofre', 'Resultados', 'Configuração'])
    expect(screen.getByRole('link', { name: /Roteiros de laudos/ }).getAttribute('href')).toBe('/roteiros')
  })

  it('CA4 · fila vazia: o atalho leva à busca de cliente, para quem vê o caso', async () => {
    entrarComo('senior')
    render(comSessao(<CentralEmConstrucao rotulo="Sênior" />))
    fireEvent.click(await screen.findByRole('button', { name: 'Buscar um cliente' }))
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' }))
  })

  it('o Financeiro: o chat dele; sem roteiros nem o atalho de buscar cliente, que ele não vê', async () => {
    entrarComo('financeiro')
    render(comSessao(<CentralEmConstrucao rotulo="Financeiro" />))
    expect(sugestoes()).toEqual(expect.arrayContaining(['Prestações recebidas', 'Documento novo', 'Resumo do cliente']))
    expect(await screen.findByText('Nada na sua fila agora.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Buscar um cliente' })).toBeNull()
    expect(topo()).not.toContain('Roteiros de laudos')
  })

  it('o Sócio: a busca e o chat', async () => {
    entrarComo('socio')
    render(comSessao(<CentralEmConstrucao rotulo="Sócio" />))
    expect(screen.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' })).toBeTruthy()
    expect(sugestoes()).toEqual(expect.arrayContaining(['Prestações recebidas', 'Criar tarefa']))
  })
})

describe('GGVP-135 · a Gestão no topo do líder do Atendimento (P14)', () => {
  it('o líder vê Prazos, Tentativas bloqueadas e Resultados; o Atendimento, não', async () => {
    entrarComo('atendimento-lider')
    const { unmount } = render(comSessao(<CentralAtendimento />))
    expect(topo()).toEqual(['Início', 'Agenda', 'Tentativas bloqueadas', 'Prazos', 'Uso do cofre', 'Resultados', 'Configuração'])
    unmount()
    entrarComo('atendimento')
    render(comSessao(<CentralAtendimento />))
    expect(topo()).toEqual(['Início', 'Agenda'])
  })
})
