import { useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CampoBusca } from '../componentes/CampoBusca.tsx'
import { LaudoPeloChat } from '../componentes/LaudoPeloChat.tsx'
import { FilasDeTarefas } from '../componentes/FilasDeTarefas.tsx'
import { tarefasCriadasPeloChat } from '../dados/chat.ts'
import { ITENS_DA_GESTAO } from '../componentes/itensDaGestao.ts'
import { Topbar } from '../componentes/Topbar.tsx'
import type { ItemNavegacao } from '../componentes/Topbar.tsx'
import { useTarefasDoServidor } from '../dados/tarefas.ts'
import { juntarMinhas, useMinhasDoSetor } from '../dados/setor.ts'
import {
  exemploChatAtendimento,
  sugestoesChatAtendimento,
  tarefasAtendimento,
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
import { tarefasDaDocumentacaoNaPericia } from '../dados/pericia.ts'
import { useTarefasDaConversa } from '../dados/conversa.ts'
import { usePerfil } from '../dados/perfis.ts'
import { usePode } from '../sessao.ts'

// Figma: "Central de trabalho · Atendimento" (11:2), arquivo nHOPzl005CpWDXUWyVZIo6.
const navegacao: ItemNavegacao[] = [
  { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' },
  { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
]

export function CentralAtendimento() {
  // A Documentação não tem Central própria: o que o balcão encaminha a ela aparece aqui, no topo, com as pendências do
  // Atendimento (GGVP-21), as fichas que o scanner criou sem telefone (GGVP-17, CA15), as entrevistas que passaram sem
  // registro (GGVP-123, CA8) e as que falta confirmar com o lead (GGVP-21).
  // A conversa com o cliente é da pessoa que a abriu (GGVP-76): o nome vem da sessão.
  const perfil = usePerfil('Atendimento')
  const [deExemplo] = useState(() => [
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
    // A Documentação reúne e cobra o que a perícia pede (épico GGVP-10, GGVP-56).
    ...tarefasDaDocumentacaoNaPericia(),
    // GGVP-82: as tarefas que o chat criou para a pessoa.
    ...tarefasCriadasPeloChat(perfil?.usuario),
  ])
  // As tarefas reais do servidor vêm no topo (ex.: o ajuste pedido pela Sênior, GGVP-23 CA3); as de exemplo
  // continuam embaixo até a Recepção e a Abertura gravarem no servidor (GGVP-125).
  const doServidor = useTarefasDoServidor() ?? []
  // A conversa com o cliente e a pendência dela, do servidor, para quem está no login (GGVP-138).
  const daConversa = useTarefasDaConversa() ?? []
  // GGVP-147: o que o líder deu a outra pessoa sai da fila; o que deu a esta pessoa entra no topo.
  const tarefas = juntarMinhas([...doServidor, ...daConversa, ...deExemplo], useMinhasDoSetor())
  // O líder do Atendimento vê a Gestão no topo, como a matriz dá a ele (GGVP-135, P14).
  const gestao = usePode('gestao.ver')

  return (
    <>
      <title>Início · GGV Previdenciário</title>
      <Topbar
        itens={gestao ? [...navegacao, ...ITENS_DA_GESTAO] : navegacao}
        ativo="inicio"
        funcao="Atendimento"
        acao={{ rotulo: '+ Novo cliente', href: '/clientes/novo' }}
      />
      <main className={styles.pagina}>
        <div className={styles.coluna}>
          <h1 className="so-leitor">Início do Atendimento</h1>
          <CampoBusca tarefas={tarefas} />
          <LaudoPeloChat exemplo={exemploChatAtendimento} sugestoes={sugestoesChatAtendimento} />
          <FilasDeTarefas tarefas={tarefas} />
        </div>
      </main>
      <AbaSuporte />
    </>
  )
}
