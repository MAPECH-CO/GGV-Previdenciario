import { useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CampoBusca } from '../componentes/CampoBusca.tsx'
import { ChatDaPericia } from '../componentes/ChatDaPericia.tsx'
import { FilasDeTarefas } from '../componentes/FilasDeTarefas.tsx'
import { tarefasCriadasPeloChat } from '../dados/chat.ts'
import { usePerfil } from '../dados/perfis.ts'
import { Topbar } from '../componentes/Topbar.tsx'
import type { ItemNavegacao } from '../componentes/Topbar.tsx'
import { tarefasDoJuridicoAdm } from '../dados/pericia.ts'
import { useTarefasDoServidor } from '../dados/tarefas.ts'
import { juntarMinhas, useMinhasDoSetor } from '../dados/setor.ts'
import styles from './CentralAtendimento.module.css'

// Figma: "Central de trabalho · Estagiário (Jurídico administrativo)" (2051:173). Mantida porque a perícia passou ao
// Jurídico administrativo (Lucas, 29/09). As tarefas nascem da perícia (dados/pericia.ts); as do protocolo no INSS (D2.02)
// vêm do servidor e ficam no topo (junção de 08/10). É a tela inicial de quem entra como Jurídico administrativo.
const navegacao: ItemNavegacao[] = [
  { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/juridico-administrativo' },
  { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
]

const exemploChatJuridicoAdm = 'Ex.: “qual é a próxima tarefa da Maria Exemplo?”'
const sugestoesChatJuridicoAdm = ['Perícias para marcar', 'O cliente me ligou', 'Subir comprovante do INSS', 'Dica para a perícia']

export function CentralJuridicoAdm() {
  const perfil = usePerfil('Jurídico administrativo')
  // GGVP-82: e as tarefas que o chat criou para a pessoa.
  const [deExemplo] = useState(() => [...tarefasDoJuridicoAdm(), ...tarefasCriadasPeloChat(perfil?.usuario)])
  const doServidor = useTarefasDoServidor() ?? []
  // GGVP-147: o que o líder deu a outra pessoa sai da fila; o que deu a esta pessoa entra no topo.
  const tarefas = juntarMinhas([...doServidor, ...deExemplo], useMinhasDoSetor())

  return (
    <>
      <title>Início do Jurídico administrativo · GGV Previdenciário</title>
      <Topbar itens={navegacao} ativo="inicio" funcao="Jurídico administrativo" />
      <main className={styles.pagina}>
        <div className={styles.coluna}>
          <h1 className="so-leitor">Início do Jurídico administrativo</h1>
          <CampoBusca />
          <ChatDaPericia exemplo={exemploChatJuridicoAdm} sugestoes={sugestoesChatJuridicoAdm} />
          <FilasDeTarefas tarefas={tarefas} />
        </div>
      </main>
      <AbaSuporte />
    </>
  )
}
