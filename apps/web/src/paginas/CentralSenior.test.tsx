import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tarefasDeDecidirCobranca } from '../dados/cobranca.ts'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { CentralSenior } from './CentralSenior.tsx'

/** Uma tarefa do servidor (GET /api/tarefas): a conferência antes do INSS (D2.01). */
const conferencia = {
  id: '11111111-1111-4111-8111-111111111111',
  casoId: '22222222-2222-4222-8222-222222222222',
  passo: 'D2.01',
  cliente: { id: '33333333-3333-4333-8333-333333333333', nome: 'Luiz Carvalho (exemplo)' },
  contexto: null,
  titulo: 'Aprovar pedido',
  detalhe: 'aposentadoria por idade',
  tela: '/casos/22222222-2222-4222-8222-222222222222/conferencia',
  prazo: null,
  urgente: true,
}

function servidor(tarefas: object[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/tarefas' ? tarefas : []), { status: 200 })))
}

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 8, 14, 32), latencia: 0 })
  zerarExemplo()
  entrarComo('senior')
  servidor([])
})
afterEach(() => {
  vi.unstubAllGlobals()
  entrarComo()
})

const topo = () => within(screen.getByRole('navigation', { name: 'Principal' })).getAllByRole('link').map((a) => a.textContent?.replace(/^\S+ /, ''))
const sugestoes = () => within(screen.getByRole('region', { name: 'Chat com a IA' })).getAllByRole('button').map((b) => b.textContent)

describe('GGVP-78 · a Central da Sênior, como no Figma (59:609)', () => {
  it('o topo com os atalhos de hoje, a busca e o chat com as sugestões do Figma, e a aba Suporte', () => {
    render(comSessao(<CentralSenior />))
    expect(screen.getByRole('heading', { level: 1, name: 'Início da Sênior' })).toBeTruthy()
    expect(topo()).toEqual([
      'Início',
      'Agenda',
      'Clientes',
      'Processos',
      'Estudos de caso',
      'Roteiros de laudos',
      'Tentativas bloqueadas',
      'Prazos',
      'Uso do cofre',
      'Resultados',
      'Configuração',
      'Importar planilha',
    ])
    expect(screen.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' })).toBeTruthy()
    expect(sugestoes()).toEqual(expect.arrayContaining(['O que estourou o limite?', 'Criar tarefa', 'Casos para conferir', 'Subir no acervo']))
    expect(screen.getByRole('button', { name: '✦ Suporte' })).toBeTruthy()
  })

  it('a fila: as tarefas do servidor no topo e as de exemplo que o App passa; a Sênior líder tem as abas do setor', async () => {
    servidor([conferencia])
    render(comSessao(<CentralSenior deExemplo={tarefasDeDecidirCobranca()} />))
    const aprovar = await screen.findByRole('link', { name: 'Luiz Carvalho (exemplo) · Aprovar pedido' })
    expect(aprovar.getAttribute('href')).toBe('/casos/22222222-2222-4222-8222-222222222222/conferencia')
    expect(screen.getByRole('link', { name: 'Antônio Exemplo · Decidir cobrança' }).getAttribute('href')).toBe('/casos/antonio-exemplo-1/cobranca/decidir')
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('aria-label'))
    expect(links.indexOf('Luiz Carvalho (exemplo) · Aprovar pedido')).toBeLessThan(links.indexOf('Antônio Exemplo · Decidir cobrança'))
    expect(screen.getByRole('tab', { name: /^Minhas tarefas \(\d+\)$/ })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /^Tarefas do setor/ })).toBeTruthy()
  })

  it('CA4 · fila vazia: o atalho leva à busca de cliente', async () => {
    render(comSessao(<CentralSenior />))
    fireEvent.click(await screen.findByRole('button', { name: 'Buscar um cliente' }))
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' }))
  })
})
