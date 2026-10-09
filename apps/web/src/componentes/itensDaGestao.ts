import type { ItemNavegacao } from './Topbar.tsx'

/**
 * A Gestão no topo de quem tem `gestao.ver` (GGVP-96): as mesmas telas da Central provisória da Sênior e do Sócio, para
 * o líder do Atendimento também (GGVP-135, P14). O Financeiro fica só com os Resultados (GGVP-96).
 */
export const ITENS_DA_GESTAO: ItemNavegacao[] = [
  { id: 'tentativas', glifo: '⛔', rotulo: 'Tentativas bloqueadas', href: '/gestao/tentativas' },
  { id: 'prazos', glifo: '⏱', rotulo: 'Prazos', href: '/gestao/prazos' },
  { id: 'cofre', glifo: '🔒', rotulo: 'Uso do cofre', href: '/gestao/cofre' },
  { id: 'resultados', glifo: '📊', rotulo: 'Resultados', href: '/gestao/resultados' },
  { id: 'configuracao', glifo: '⚙', rotulo: 'Configuração', href: '/configuracao' },
]
