import { pode } from '@ggv/contratos'
import type { ItemNavegacao } from './Topbar.tsx'

/**
 * A Gestão no topo de quem tem `gestao.ver` (GGVP-96): as mesmas telas da Central provisória da Sênior, do Financeiro e do
 * Sócio, para o líder do Atendimento também (GGVP-135, P14).
 */
export const ITENS_DA_GESTAO: ItemNavegacao[] = [
  { id: 'tentativas', glifo: '⛔', rotulo: 'Tentativas bloqueadas', href: '/gestao/tentativas' },
  { id: 'prazos', glifo: '⏱', rotulo: 'Prazos', href: '/gestao/prazos' },
  { id: 'cofre', glifo: '🔒', rotulo: 'Uso do cofre', href: '/gestao/cofre' },
  { id: 'resultados', glifo: '📊', rotulo: 'Resultados', href: '/gestao/resultados' },
  { id: 'configuracao', glifo: '⚙', rotulo: 'Configuração', href: '/configuracao' },
]

/** Clientes e Processos (GGVP-78, Figma 1927:605 e 1927:888). */
export const ITENS_DAS_BASES: ItemNavegacao[] = [
  { id: 'clientes', rotulo: 'Clientes', href: '/clientes' },
  { id: 'processos', rotulo: 'Processos', href: '/processos' },
]

/**
 * No Figma, Clientes e Processos são do líder do Atendimento, da Advogada, da Sênior e do Financeiro; o Atendimento só tem
 * a Agenda. A matriz manda: o Financeiro não vê o caso (`caso.ver`) e fica sem os dois até ela mudar.
 */
const COM_AS_BASES = ['atendimento_lider', 'advogada', 'senior', 'financeiro']

/** O painel Financeiro (GGVP-78, Figma 1930:4), para quem vê os totais em dinheiro: o Financeiro e o Sócio. */
export const ITEM_DO_FINANCEIRO: ItemNavegacao = { id: 'financeiro', rotulo: 'Financeiro', href: '/financeiro' }

/**
 * O topo de toda tela pelo perfil da sessão (GGVP-78): Clientes e Processos depois do Início e da Agenda, se a matriz deixa
 * ver o caso; a Gestão no fim, para quem tem `gestao.ver`, e o Financeiro depois dela, para quem vê os totais em dinheiro.
 * O que a tela já trouxe não se repete.
 */
export function itensDoPerfil(itens: ItemNavegacao[], perfil: string | null | undefined): ItemNavegacao[] {
  const tem = (lista: ItemNavegacao[]) => lista.some((i) => itens.some((x) => x.id === i.id))
  const bases = COM_AS_BASES.includes(perfil ?? '') && pode(perfil, 'caso.ver') && !tem(ITENS_DAS_BASES) ? ITENS_DAS_BASES : []
  const gestao = pode(perfil, 'gestao.ver') && !tem(ITENS_DA_GESTAO) ? ITENS_DA_GESTAO : []
  const financeiro = pode(perfil, 'valores.ver_totais') && !tem([ITEM_DO_FINANCEIRO]) ? [ITEM_DO_FINANCEIRO] : []
  const depois = itens.findIndex((i) => i.id !== 'inicio' && i.id !== 'agenda')
  const corte = depois < 0 ? itens.length : depois
  return [...itens.slice(0, corte), ...bases, ...itens.slice(corte), ...gestao, ...financeiro]
}
