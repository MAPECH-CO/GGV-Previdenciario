import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { CentralFinanceiro } from './CentralFinanceiro.tsx'

const CASO = '22222222-2222-4222-8222-222222222222'
/** As tarefas do Financeiro vêm do servidor (GGVP-44, GGVP-98): receber a prestação e avisar o cliente. */
const tarefa = (id: string, passo: string, titulo: string, tela: string) => ({
  id,
  casoId: CASO,
  passo,
  cliente: { id: '33333333-3333-4333-8333-333333333333', nome: 'Vera Lúcia (exemplo)' },
  contexto: null,
  titulo,
  detalhe: 'bpc loas idoso',
  tela,
  prazo: null,
  urgente: false,
})

function servidor(tarefas: object[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/tarefas' ? tarefas : []), { status: 200 })))
}

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 8, 14, 32), latencia: 0 })
  zerarExemplo()
  entrarComo('financeiro')
  servidor([])
})
afterEach(() => {
  vi.unstubAllGlobals()
  entrarComo()
})

const topo = () => within(screen.getByRole('navigation', { name: 'Principal' })).getAllByRole('link').map((a) => a.textContent?.replace(/^\S+ /, ''))
const sugestoes = () => within(screen.getByRole('region', { name: 'Chat com a IA' })).getAllByRole('button').map((b) => b.textContent)

describe('GGVP-78 · a Central do Financeiro, como no Figma (59:863)', () => {
  it('GGVP-147 · o Financeiro, que não vê o caso, nem pede a fila do setor (o servidor diria 403)', async () => {
    render(comSessao(<CentralFinanceiro />))
    expect(await screen.findByText('Nada na sua fila agora.')).toBeTruthy()
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url))
    expect(urls).toContain('/api/tarefas')
    expect(urls).not.toContain('/api/setor/minhas')
  })

  it('o topo com os Resultados (GGVP-96) e o painel Financeiro; sem o resto da Gestão, Clientes nem Processos; a busca, o chat e o Suporte', () => {
    render(comSessao(<CentralFinanceiro />))
    expect(screen.getByRole('heading', { level: 1, name: 'Início do Financeiro' })).toBeTruthy()
    expect(topo()).toEqual(['Início', 'Agenda', 'Resultados', 'Financeiro'])
    expect(screen.getByRole('link', { name: 'Financeiro' }).getAttribute('href')).toBe('/financeiro')
    expect(screen.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' })).toBeTruthy()
    expect(sugestoes()).toEqual(expect.arrayContaining(['Prestações recebidas', 'Documento novo', 'Resumo do cliente']))
    expect(screen.getByRole('button', { name: '✦ Suporte' })).toBeTruthy()
  })

  it('a fila: receber a prestação e avisar o cliente, cada uma abrindo a tela do passo; sem abas do setor', async () => {
    servidor([
      tarefa('11111111-1111-4111-8111-111111111111', 'D2.06r', 'Receber a prestação de contas', `/casos/${CASO}/prestacao/recebimento`),
      tarefa('44444444-4444-4444-8444-444444444444', 'D2.06b', 'Avisar resultado e agendar a ida ao banco', `/casos/${CASO}/banco`),
    ])
    render(comSessao(<CentralFinanceiro />))
    expect((await screen.findByRole('link', { name: 'Vera Lúcia (exemplo) · Receber a prestação de contas' })).getAttribute('href')).toBe(`/casos/${CASO}/prestacao/recebimento`)
    expect(screen.getByRole('link', { name: 'Vera Lúcia (exemplo) · Avisar resultado e agendar a ida ao banco' }).getAttribute('href')).toBe(`/casos/${CASO}/banco`)
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('fila vazia: o atalho para o painel Financeiro, e não o de buscar cliente', async () => {
    render(comSessao(<CentralFinanceiro />))
    expect(await screen.findByText('Nada na sua fila agora.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir o painel Financeiro' }).getAttribute('href')).toBe('/financeiro')
    expect(screen.queryByRole('button', { name: 'Buscar um cliente' })).toBeNull()
  })
})
