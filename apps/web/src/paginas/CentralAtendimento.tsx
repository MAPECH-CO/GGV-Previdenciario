import { useState } from 'react'
import { Abas } from '../componentes/Abas.tsx'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CampoBusca } from '../componentes/CampoBusca.tsx'
import { ChatIA } from '../componentes/ChatIA.tsx'
import { ListaTarefas } from '../componentes/ListaTarefas.tsx'
import { Topbar } from '../componentes/Topbar.tsx'
import type { ItemNavegacao } from '../componentes/Topbar.tsx'
import { useTarefasDoServidor } from '../dados/tarefas.ts'
import {
  exemploChatAtendimento,
  sugestoesChatAtendimento,
  tarefasAtendimento,
  totalTarefasSetorAtendimento,
} from '../dados/atendimento.ts'
import styles from './CentralAtendimento.module.css'

// Figma: "Central de trabalho · Atendimento" (11:2), arquivo nHOPzl005CpWDXUWyVZIo6.
const navegacao: ItemNavegacao[] = [
  { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' },
  { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
]

export function CentralAtendimento() {
  const [aba, setAba] = useState('minhas')
  // As tarefas reais do servidor vêm no topo (ex.: o ajuste pedido pela Sênior, GGVP-23 CA3); as de exemplo
  // continuam embaixo até a história desta Central ligar a fila inteira no servidor (GGVP-78).
  const doServidor = useTarefasDoServidor() ?? []
  const tarefas = [...doServidor, ...tarefasAtendimento]

  return (
    <>
      <title>Início · GGV Previdenciário</title>
      <Topbar
        itens={navegacao}
        ativo="inicio"
        funcao="Atendimento"
        acao={{ rotulo: '+ Novo cliente', href: '/clientes/novo' }}
      />
      <main className={styles.pagina}>
        <div className={styles.coluna}>
          <h1 className="so-leitor">Início do Atendimento</h1>
          <CampoBusca />
          <ChatIA exemplo={exemploChatAtendimento} sugestoes={sugestoesChatAtendimento} />
          <Abas
            rotulo="Filas de tarefas"
            ativa={aba}
            onMudar={setAba}
            abas={[
              { id: 'minhas', rotulo: `Minhas tarefas (${tarefas.length})` },
              { id: 'setor', rotulo: `Tarefas do setor (${totalTarefasSetorAtendimento})` },
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
