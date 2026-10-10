import { render, screen, within } from '@testing-library/react'
import type { PainelDeResultados } from '@ggv/contratos'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { InicioDoSocio } from './InicioDoSocio.tsx'

const semDados = (chave: string, rotulo: string) => ({ chave, rotulo, casos: 0, valor: null, unidade: 'taxa' as const, situacao: 'sem_dados' as const })
const painel: PainelDeResultados = {
  periodo: { de: '2026-01-01', ate: '2026-10-09' },
  indicadores: [semDados('deferimento_inss', 'Deferimento no INSS')],
  recorte: null,
  extincoes: { casos: 0, decididos: 0, porCausa: [] },
  pareceres: { dispensados: 0, exitoComDispensa: semDados('exito_com_dispensa', 'Êxito com parecer dispensado'), exitoComSuficiente: semDados('exito_com_suficiente', 'Êxito com parecer suficiente') },
  motivos: { indeferimento: [], derrota: [] },
  totais: null,
  operacao: 'sem_dados',
  baseDoAcervo: { situacao: 'sem_dados' },
}
const autorizar = {
  id: '11111111-1111-4111-8111-111111111111',
  casoId: '22222222-2222-4222-8222-222222222222',
  passo: 'historico',
  cliente: { id: '33333333-3333-4333-8333-333333333333', nome: 'Vera Lúcia (exemplo)' },
  contexto: null,
  titulo: 'Autorizar a exportação do histórico',
  detalhe: 'bpc loas idoso',
  tela: '/casos/22222222-2222-4222-8222-222222222222/historico',
  prazo: null,
  urgente: false,
}

function servidor(tarefas: object[]) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.startsWith('/api/gestao/resultados') ? painel : url === '/api/tarefas' ? tarefas : []), { status: 200 })))
}

beforeEach(() => {
  entrarComo('socio')
  servidor([])
})
afterEach(() => {
  vi.unstubAllGlobals()
  entrarComo()
})

const topo = () => within(screen.getByRole('navigation', { name: 'Principal' })).getAllByRole('link').map((a) => a.textContent?.replace(/^\S+ /, ''))

describe('GGVP-78 · a tela inicial do Sócio é o painel de resultado (GGVP-75, perfis.md)', () => {
  it('o painel com a busca e o chat da Gestão do Sócio (Figma 2456:10128), a Gestão, a importação e o Financeiro no topo, sem o "Voltar ao início"', async () => {
    render(comSessao(<InicioDoSocio />))
    expect(await screen.findByRole('heading', { level: 1, name: 'Resultados do escritório' })).toBeTruthy()
    expect(await screen.findByText('Sem dados ainda: nenhum caso decidido no período.')).toBeTruthy()
    expect(screen.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' })).toBeTruthy()
    const chat = screen.getByRole('region', { name: 'Chat com a IA' })
    expect(within(chat).getAllByRole('button').map((b) => b.textContent)).toEqual(expect.arrayContaining(['Por que perdemos em 2025?', 'Êxito por benefício', 'Faltas à perícia dobraram']))
    // Os atalhos de hoje ficam: a Gestão e a importação da planilha (configuracao.editar, GGVP-146).
    expect(topo()).toEqual(['Início', 'Agenda', 'Tentativas bloqueadas', 'Prazos', 'Uso do cofre', 'Resultados', 'Configuração', 'Importar planilha', 'Financeiro'])
    expect(screen.getByRole('link', { name: /Importar planilha/ }).getAttribute('href')).toBe('/gestao/importar')
    expect(screen.queryByRole('link', { name: '← Voltar ao início' })).toBeNull()
    // Sem tarefa do Sócio, a fila não ocupa a tela.
    expect(screen.queryByRole('heading', { name: 'O que você tem que fazer' })).toBeNull()
  })

  it('com tarefa do Sócio (autorizar a exportação, GGVP-99 CA12), a fila aparece acima do painel', async () => {
    servidor([autorizar])
    render(comSessao(<InicioDoSocio />))
    const link = await screen.findByRole('link', { name: 'Vera Lúcia (exemplo) · Autorizar a exportação do histórico' })
    expect(link.getAttribute('href')).toBe('/casos/22222222-2222-4222-8222-222222222222/historico')
    expect(screen.getByRole('heading', { name: 'O que você tem que fazer' })).toBeTruthy()
  })
})
