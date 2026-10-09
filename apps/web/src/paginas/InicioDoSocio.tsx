import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CampoBusca } from '../componentes/CampoBusca.tsx'
import { ChatDoPortal } from '../componentes/ChatDoPortal.tsx'
import { FilasDeTarefas } from '../componentes/FilasDeTarefas.tsx'
import { ITENS_DA_GESTAO } from '../componentes/itensDaGestao.ts'
import { Topbar, type ItemNavegacao } from '../componentes/Topbar.tsx'
import { juntarMinhas, useMinhasDoSetor } from '../dados/setor.ts'
import { useTarefasDoServidor } from '../dados/tarefas.ts'
import { usePode } from '../sessao.ts'
import { Resultados } from './Resultados.tsx'

// O Figma não desenhou uma Central do Sócio: a tela inicial dele é o painel de resultado (GGVP-75; perfis.md), com a busca
// e o chat da "Gestão · Sócio" (2456:10128). O painel Financeiro entra no topo pelo perfil (itensDaGestao.ts).
const navegacao: ItemNavegacao[] = [
  { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' },
  { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
]

const CHAT = { exemplo: 'Ex.: “por que perdemos os processos de BPC deficiente?”', sugestoes: ['Por que perdemos em 2025?', 'Êxito por benefício', 'Faltas à perícia dobraram'] }

export function InicioDoSocio() {
  const doServidor = useTarefasDoServidor()
  const minhasDoSetor = useMinhasDoSetor()
  // O que é do Sócio na fila (ex.: autorizar a exportação do histórico, GGVP-99 CA12) aparece só quando há.
  const tarefas = doServidor && juntarMinhas(doServidor, minhasDoSetor)
  // Os atalhos de hoje, como na Central da Sênior: a Gestão e a importação da planilha (GGVP-146).
  const gestao = usePode('gestao.ver')
  const importar = usePode('configuracao.editar')
  const itens: ItemNavegacao[] = [
    ...navegacao,
    ...(gestao ? ITENS_DA_GESTAO : []),
    ...(importar ? [{ id: 'importar', glifo: '⇪', rotulo: 'Importar planilha', href: '/gestao/importar' }] : []),
  ]
  return (
    <>
      <Topbar itens={itens} ativo="inicio" funcao="Sócio" />
      <Resultados
        topo={
          <>
            <CampoBusca tarefas={tarefas ?? []} />
            <ChatDoPortal exemplo={CHAT.exemplo} sugestoes={CHAT.sugestoes} funcao="Sócio" />
            {tarefas && tarefas.length > 0 && <FilasDeTarefas tarefas={tarefas} />}
          </>
        }
      />
      <AbaSuporte />
    </>
  )
}
