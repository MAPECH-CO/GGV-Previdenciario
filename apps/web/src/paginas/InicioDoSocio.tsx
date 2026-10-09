import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CampoBusca } from '../componentes/CampoBusca.tsx'
import { ChatDoPortal } from '../componentes/ChatDoPortal.tsx'
import { FilasDeTarefas } from '../componentes/FilasDeTarefas.tsx'
import { Topbar, type ItemNavegacao } from '../componentes/Topbar.tsx'
import { juntarMinhas, useMinhasDoSetor } from '../dados/setor.ts'
import { useTarefasDoServidor } from '../dados/tarefas.ts'
import { Resultados } from './Resultados.tsx'

// O Figma não desenhou uma Central do Sócio: a tela inicial dele é o painel de resultado (GGVP-75; perfis.md), com a busca
// e o chat da "Gestão · Sócio" (2456:10128). A Gestão e o painel Financeiro entram no topo pelo perfil (itensDaGestao.ts).
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
  return (
    <>
      <Topbar itens={navegacao} ativo="inicio" funcao="Sócio" />
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
