import { useState } from 'react'
import { Abas } from '../componentes/Abas.tsx'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CampoBusca } from '../componentes/CampoBusca.tsx'
import { LaudoPeloChat } from '../componentes/LaudoPeloChat.tsx'
import { ListaTarefas } from '../componentes/ListaTarefas.tsx'
import { Topbar } from '../componentes/Topbar.tsx'
import type { ItemNavegacao } from '../componentes/Topbar.tsx'
import {
  exemploChatAtendimento,
  sugestoesChatAtendimento,
  tarefasAtendimento,
  totalTarefasSetorAtendimento,
} from '../dados/atendimento.ts'
import { tarefasDeConfirmar } from '../dados/agenda.ts'
import { tarefasDeConfirmarAgendamento } from '../dados/confirmacao.ts'
import { tarefasDeCompletarTelefone } from '../dados/documentos.ts'
import { tarefasDoSetor } from '../dados/servidor.ts'
import { tarefasDeConferirDocumento } from '../dados/leitura.ts'
import { tarefasDeConferirChecklist } from '../dados/checklist.ts'
import { tarefasDeReenviarBoasVindas } from '../dados/boasVindas.ts'
import { tarefasDeCobrar } from '../dados/cobranca.ts'
import { tarefasDeLiberar } from '../dados/liberacao.ts'
import styles from './CentralAtendimento.module.css'
import { tarefasDoContrato } from '../dados/contrato.ts'
import { tarefasDeFechamento } from '../dados/fechamento.ts'
import { tarefasDeNovaDemanda } from '../dados/novaDemanda.ts'
import { tarefasDePedirLegivel } from '../dados/leitura.ts'
import { tarefasDeComplemento } from '../dados/complemento.ts'

// Figma: "Central de trabalho · Atendimento" (11:2), arquivo nHOPzl005CpWDXUWyVZIo6.
const navegacao: ItemNavegacao[] = [
  { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' },
  { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
]

export function CentralAtendimento() {
  const [aba, setAba] = useState('minhas')
  // A Documentação não tem Central própria: o que o balcão encaminha a ela aparece aqui, no topo, com as pendências do
  // Atendimento (GGVP-21), as fichas que o scanner criou sem telefone (GGVP-17, CA15), as entrevistas que passaram sem
  // registro (GGVP-123, CA8) e as que falta confirmar com o lead (GGVP-21).
  const [tarefas] = useState(() => [
    ...tarefasDoSetor('Documentação · ADM'),
    ...tarefasDoSetor('Atendimento'),
    ...tarefasDeConfirmar(),
    ...tarefasDeConfirmarAgendamento(),
    ...tarefasDeCompletarTelefone(),
    ...tarefasAtendimento,
    ...tarefasDoContrato(),
    ...tarefasDeConferirDocumento(),
    ...tarefasDeConferirChecklist(),
    ...tarefasDeReenviarBoasVindas(),
    ...tarefasDeCobrar(),
    ...tarefasDeLiberar(),
    ...tarefasDeFechamento(),
    ...tarefasDeNovaDemanda(),
    ...tarefasDePedirLegivel(),
    ...tarefasDeComplemento(),
  ])

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
          <LaudoPeloChat exemplo={exemploChatAtendimento} sugestoes={sugestoesChatAtendimento} />
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
