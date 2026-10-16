import { useSessao } from '../sessao.ts'
import { Topbar } from './Topbar.tsx'

/**
 * O topo das telas de passo (Figma step_*): desde 11/10 é o topo de toda tela, com o "Voltar" antes dos botões e, à
 * direita, de quem é a tela. Com sessão, Início é "/" (o App abre a Central do perfil ativo) e a pessoa aparece no topo,
 * então o "Você · ..." desenhado para uma função deixa de ser repetido. Sem sessão (teste de uma tela sozinha), fica como
 * foi desenhado.
 */
export function TopoPasso({
  contexto,
  inicio = '/',
  ativo = '',
}: {
  contexto: string
  /** A Central de quem está na tela. */
  inicio?: string
  /** O botão do topo que fica aceso: o Balcão, que é tela do topo e também passo. */
  ativo?: string
}) {
  const sessao = useSessao()
  const itens = [
    { id: 'inicio', rotulo: 'Início', href: sessao ? '/' : inicio },
    { id: 'agenda', rotulo: 'Agenda', href: '/agenda' },
  ]
  const deQuem = sessao && contexto.startsWith('Você ·') ? undefined : contexto
  return <Topbar itens={itens} ativo={ativo} funcao="" voltar contexto={deQuem} />
}
