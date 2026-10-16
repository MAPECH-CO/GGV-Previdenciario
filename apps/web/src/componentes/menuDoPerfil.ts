import { pode } from '@ggv/contratos'
import type { ItemNavegacao } from './Topbar.tsx'

const ITEM = {
  inicio: { id: 'inicio', rotulo: 'Início', href: '/' },
  balcao: { id: 'balcao', rotulo: 'Balcão', href: '/balcao' },
  agenda: { id: 'agenda', rotulo: 'Agenda', href: '/agenda' },
  clientes: { id: 'clientes', rotulo: 'Clientes', href: '/clientes' },
  processos: { id: 'processos', rotulo: 'Processos', href: '/processos' },
  estudos: { id: 'estudos', rotulo: 'Estudos de caso', href: '/estudos' },
  roteiros: { id: 'roteiros', rotulo: 'Roteiros de laudos', href: '/roteiros' },
  vigilia: { id: 'vigilia', rotulo: 'Vigília', href: '/vigilia' },
  financeiro: { id: 'financeiro', rotulo: 'Financeiro', href: '/financeiro' },
  custas: { id: 'custas', rotulo: 'Custas', href: '/custas' },
  tentativas: { id: 'tentativas', rotulo: 'Tentativas bloqueadas', href: '/gestao/tentativas' },
  prazos: { id: 'prazos', rotulo: 'Prazos', href: '/gestao/prazos' },
  cofre: { id: 'cofre', rotulo: 'Uso do cofre', href: '/gestao/cofre' },
  resultados: { id: 'resultados', rotulo: 'Resultados', href: '/gestao/resultados' },
  configuracao: { id: 'configuracao', rotulo: 'Configuração', href: '/configuracao' },
  importar: { id: 'importar', rotulo: 'Importar planilha', href: '/gestao/importar' },
} satisfies Record<string, ItemNavegacao>

/**
 * No Figma, Clientes e Processos são do líder do Atendimento, da Advogada, da Sênior e do Financeiro; o Atendimento só tem
 * a Agenda. A matriz manda: o Financeiro não vê o caso e fica sem os dois, e Processos é só de quem abre o processo
 * (GGVP-162). O Sócio lê tudo (Lucas, 07/10).
 */
const COM_AS_BASES = ['atendimento_lider', 'advogada', 'senior', 'financeiro', 'socio']

/**
 * O Balcão, onde se recebe quem chegou, é do Atendimento e do líder (Pedro, 16/10): era uma tarefa fixa na fila, que não
 * era tarefa, e ninguém achava o caminho para a tela.
 */
const NO_BALCAO = ['atendimento', 'atendimento_lider']

/**
 * As telas de consulta no topo: a Sênior chega aos estudos de caso (GGVP-19) e aos roteiros que ela edita (GGVP-135); o
 * Sócio, que só lê, a essas duas e à vigília (GGVP-162 CA9). Os outros perfis chegam a elas pela tarefa.
 */
const DE_CONSULTA: Record<string, (keyof typeof ITEM)[]> = { senior: ['estudos', 'roteiros'], socio: ['estudos', 'roteiros', 'vigilia'] }

/**
 * O topo pelo perfil da sessão, igual em toda tela (GGVP-78): antes cada tela mandava a sua lista e o topo mudava de uma
 * tela para outra. A Gestão vem à parte, num menu só (no Figma é um item), porque é consulta de quem gere e não o dia a
 * dia; o Financeiro, que tem só os Resultados, fica com eles soltos.
 */
export function menuDoPerfil(perfil: string | null | undefined): { principais: ItemNavegacao[]; gestao: ItemNavegacao[] } {
  const p = (acao: Parameters<typeof pode>[1]) => pode(perfil, acao)
  const bases = COM_AS_BASES.includes(perfil ?? '') && p('caso.ver')
  const principais = [
    ITEM.inicio,
    ...(NO_BALCAO.includes(perfil ?? '') ? [ITEM.balcao] : []),
    // A agenda lê os casos: sem ver o caso, a tela só daria erro.
    ...(p('caso.ver') ? [ITEM.agenda] : []),
    ...(bases ? [ITEM.clientes] : []),
    ...(bases && p('processo.abrir') ? [ITEM.processos] : []),
    ...(DE_CONSULTA[perfil ?? ''] ?? []).map((id) => ITEM[id]),
    ...(p('valores.ver_totais') ? [ITEM.financeiro] : []),
    // GGVP-157: as custas dos processos, ao lado do painel Financeiro, para quem vê valores (o Financeiro e o Sócio).
    ...(p('valores.ver') ? [ITEM.custas] : []),
  ]
  const gestao = [
    ...(p('gestao.ver') ? [ITEM.tentativas, ITEM.prazos, ITEM.cofre] : []),
    ...(p('resultados.ver') ? [ITEM.resultados] : []),
    ...(p('gestao.ver') ? [ITEM.configuracao] : []),
    ...(p('configuracao.editar') ? [ITEM.importar] : []),
  ]
  return { principais, gestao }
}
