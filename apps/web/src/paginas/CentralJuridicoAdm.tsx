import { useState } from 'react'
import { Abas } from '../componentes/Abas.tsx'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CampoBusca } from '../componentes/CampoBusca.tsx'
import { ChatDaPericia } from '../componentes/ChatDaPericia.tsx'
import { ListaTarefas } from '../componentes/ListaTarefas.tsx'
import { tarefasCriadasPeloChat } from '../dados/chat.ts'
import { usePerfil } from '../dados/perfis.ts'
import { Topbar } from '../componentes/Topbar.tsx'
import type { ItemNavegacao } from '../componentes/Topbar.tsx'
import { tarefasDoJuridicoAdm } from '../dados/pericia.ts'
import { useTarefasDoServidor } from '../dados/tarefas.ts'
import styles from './CentralAtendimento.module.css'

// Figma: "Central de trabalho · Estagiário (Jurídico administrativo)" (2051:173). Mantida porque a perícia passou ao
// Jurídico administrativo (Lucas, 29/09). As tarefas nascem da perícia (dados/pericia.ts); as do protocolo no INSS (D2.02)
// vêm do servidor e ficam no topo (junção de 08/10). É a tela inicial de quem entra como Jurídico administrativo.
const navegacao: ItemNavegacao[] = [
  { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/juridico-administrativo' },
  { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
]

/** Quantas tarefas a aba "Tarefas do setor" mostra no protótipo. */
const TOTAL_DO_SETOR = 9

const exemploChatJuridicoAdm = 'Ex.: “qual é a próxima tarefa da Maria Exemplo?”'
const sugestoesChatJuridicoAdm = ['Perícias para marcar', 'O cliente me ligou', 'Subir comprovante do INSS', 'Dica para a perícia']

export function CentralJuridicoAdm() {
  const [aba, setAba] = useState('minhas')
  const perfil = usePerfil('Jurídico administrativo')
  // GGVP-82: e as tarefas que o chat criou para a pessoa.
  const [deExemplo] = useState(() => [...tarefasDoJuridicoAdm(), ...tarefasCriadasPeloChat(perfil?.usuario)])
  // GGVP-137: a tarefa "Marcar perícia" que o sistema abriu (DP.01) e a que a perícia calcula levam à mesma tela: fica uma.
  const doServidor = (useTarefasDoServidor() ?? []).filter((s) => s.codigo !== 'DP.01' || !deExemplo.some((t) => t.href === s.href))
  const tarefas = [...doServidor, ...deExemplo]

  return (
    <>
      <title>Início do Jurídico administrativo · GGV Previdenciário</title>
      <Topbar itens={navegacao} ativo="inicio" funcao="Jurídico administrativo" />
      <main className={styles.pagina}>
        <div className={styles.coluna}>
          <h1 className="so-leitor">Início do Jurídico administrativo</h1>
          <CampoBusca />
          <ChatDaPericia exemplo={exemploChatJuridicoAdm} sugestoes={sugestoesChatJuridicoAdm} />
          <Abas
            rotulo="Filas de tarefas"
            ativa={aba}
            onMudar={setAba}
            abas={[
              { id: 'minhas', rotulo: `Minhas tarefas (${tarefas.length})` },
              { id: 'setor', rotulo: `Tarefas do setor (${TOTAL_DO_SETOR})` },
            ]}
          />
          <section role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} className={styles.painel}>
            {aba === 'minhas' ? (
              <>
                <div className={styles.titulo}>
                  <h2 className={styles.tituloTexto}>O que você tem que fazer</h2>
                  <span className={styles.contagem}>{tarefas.length}</span>
                </div>
                <ListaTarefas tarefas={tarefas} />
              </>
            ) : (
              <p className={styles.emConstrucao}>Tarefas do setor: tela ainda não construída.</p>
            )}
          </section>
        </div>
      </main>
      <AbaSuporte />
    </>
  )
}
