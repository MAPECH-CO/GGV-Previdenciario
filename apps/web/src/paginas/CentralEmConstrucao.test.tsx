import { render, screen, within } from '@testing-library/react'
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

describe('GGVP-78 · o início de perfil sem Central', () => {
  it('desde as Centrais da Sênior e do Financeiro e o início do Sócio, só perfil novo cai aqui: o título, a busca, o chat e a fila', async () => {
    render(<CentralEmConstrucao rotulo="Perfil novo" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Central · Perfil novo' })).toBeTruthy()
    expect(screen.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Chat com a IA' })).toBeTruthy()
    expect(await screen.findByText('Nada na sua fila agora.')).toBeTruthy()
  })
})

describe('GGVP-135 · a Gestão no topo do líder do Atendimento (P14)', () => {
  it('o líder vê Prazos, Tentativas bloqueadas e Resultados; o Atendimento, não', async () => {
    entrarComo('atendimento-lider')
    const { unmount } = render(comSessao(<CentralAtendimento />))
    expect(topo()).toEqual(['Início', 'Agenda', 'Clientes', 'Processos', 'Tentativas bloqueadas', 'Prazos', 'Uso do cofre', 'Resultados', 'Configuração'])
    unmount()
    entrarComo('atendimento')
    render(comSessao(<CentralAtendimento />))
    expect(topo()).toEqual(['Início', 'Agenda'])
  })
})
