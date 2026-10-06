import { useState } from 'react'
import { Abas } from '../componentes/Abas.tsx'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CampoBusca } from '../componentes/CampoBusca.tsx'
import { ChatIA } from '../componentes/ChatIA.tsx'
import { ListaTarefas } from '../componentes/ListaTarefas.tsx'
import { Topbar } from '../componentes/Topbar.tsx'
import type { ItemNavegacao } from '../componentes/Topbar.tsx'
import { exemploChatAdvogada, sugestoesChatAdvogada, totalTarefasSetorAdvogada } from '../dados/advogada.ts'
import { tarefasDaAdvogada } from '../dados/preparacao.ts'
import { tarefasDeDecidirCobranca } from '../dados/cobranca.ts'
import { tarefasDaFilaDaSenior } from '../dados/liberacao.ts'
import styles from './CentralAtendimento.module.css'

// Figma: "Central de trabalho · Advogada" (59:449). Sem cartão próprio: entra com a GGVP-32, porque a preparação da
// conversa pede "minha fila". A troca de perfil no topo é da GGVP-78; esta Central abre por /advogada.
const navegacao: ItemNavegacao[] = [
  { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/advogada' },
  { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
]

export function CentralAdvogada() {
  const [aba, setAba] = useState('minhas')
  // A cobrança que passou do limite chega à sênior (GGVP-101, CA7), e o caso liberado pela Documentação também (GGVP-18, CA1).
  const [tarefas] = useState(() => [...tarefasDaAdvogada(), ...tarefasDeDecidirCobranca(), ...tarefasDaFilaDaSenior()])

  return (
    <>
      <title>Início da Advogada · GGV Previdenciário</title>
      <Topbar itens={navegacao} ativo="inicio" funcao="Advogada" />
      <main className={styles.pagina}>
        <div className={styles.coluna}>
          <h1 className="so-leitor">Início da Advogada</h1>
          <CampoBusca />
          <ChatIA exemplo={exemploChatAdvogada} sugestoes={sugestoesChatAdvogada} />
          <Abas
            rotulo="Filas de tarefas"
            ativa={aba}
            onMudar={setAba}
            abas={[
              { id: 'minhas', rotulo: `Minhas tarefas (${tarefas.length})` },
              { id: 'setor', rotulo: `Tarefas do setor (${totalTarefasSetorAdvogada})` },
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
