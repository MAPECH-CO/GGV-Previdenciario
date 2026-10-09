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
  tarefasAtendimento,
  tarefasDocumentacao,
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
import type { Tarefa } from '../dados/tipos.ts'
import { usePode, useSessao } from '../sessao.ts'
import { grupoDoPerfil, SUGESTOES_DO_PERFIL } from '../regras/chat.ts'

// Figma: "Central de trabalho · Atendimento" (11:2), arquivo nHOPzl005CpWDXUWyVZIo6.
const navegacao: ItemNavegacao[] = [
  { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' },
  { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
]

type Funcao = 'Atendimento' | 'Documentação'

/**
 * GGVP-130: a Documentação é função e perfil próprios, mas não tem Central (Pedro, 30/09 e 07/10): trabalha nesta e vê
 * só o que é dela, pelo BPMN. Dela: o documento que o balcão encaminha (D1.02), a conferência do que o scanner e a IA
 * leram, com a quarentena (D1.18), o checklist (D1.21), "Liberar ao Jurídico" (D1.24, Lucas 28/09), as exigências que
 * pedem documento (D2.05, D3a.03) e os documentos da perícia, com a cobrança deles (DP.03). O resto é do Atendimento:
 * agenda e confirmação, fichas, contrato e assinatura, a cobrança dos documentos do caso (D1.23), boas-vindas,
 * fechamento, nova demanda, pedir documento legível (GGVP-95 CA3) e o complemento ao médico. Sem sessão (a tela sozinha,
 * nos testes), as duas, como foi desenhada.
 */
function tarefasDeExemplo(funcao: Funcao | null): Tarefa[] {
  const fontes: [Funcao, Tarefa[]][] = [
    ['Documentação', tarefasDoSetor('Documentação · ADM')],
    // As pendências do próprio Atendimento (GGVP-21), as entrevistas que passaram sem registro (GGVP-123, CA8), as que
    // falta confirmar com o lead (GGVP-21) e as fichas que o scanner criou sem telefone (GGVP-17, CA15).
    ['Atendimento', tarefasDoSetor('Atendimento')],
    ['Atendimento', tarefasDeConfirmar()],
    ['Atendimento', tarefasDeConfirmarAgendamento()],
    ['Atendimento', tarefasDeCompletarTelefone()],
    ['Atendimento', tarefasAtendimento],
    ['Documentação', tarefasDocumentacao],
    ['Atendimento', tarefasDoContrato()],
    ['Documentação', tarefasDeConferirDocumento()],
    ['Documentação', tarefasDeConferirChecklist()],
    ['Atendimento', tarefasDeReenviarBoasVindas()],
    ['Atendimento', tarefasDeCobrar()],
    ['Documentação', tarefasDeLiberar()],
    ['Atendimento', tarefasDeFechamento()],
    ['Atendimento', tarefasDeNovaDemanda()],
    ['Atendimento', tarefasDePedirLegivel()],
    ['Atendimento', tarefasDeComplemento()],
    // A Documentação reúne e cobra o que a perícia pede (épico GGVP-10, GGVP-56).
    ['Documentação', tarefasDaDocumentacaoNaPericia()],
  ]
  return fontes.filter(([dono]) => !funcao || dono === funcao).flatMap(([, tarefas]) => tarefas)
}

export function CentralAtendimento() {
  // A conversa com o cliente é da pessoa que a abriu (GGVP-76): o nome vem da sessão.
  const perfil = usePerfil('Atendimento')
  const sessao = useSessao()
  const funcao: Funcao | null = !sessao ? null : sessao.perfilAtivo === 'documentacao' ? 'Documentação' : 'Atendimento'
  // GGVP-82: e as tarefas que o chat criou para a pessoa.
  const [deExemplo] = useState(() => [...tarefasDeExemplo(funcao), ...tarefasCriadasPeloChat(perfil?.usuario)])
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
          <h1 className="so-leitor">{funcao === 'Documentação' ? 'Início da Documentação' : 'Início do Atendimento'}</h1>
          <CampoBusca tarefas={tarefas} />
          {/* GGVP-96: a Documentação e o líder, que também abrem esta Central, com as sugestões do perfil deles. */}
          <LaudoPeloChat exemplo={exemploChatAtendimento} sugestoes={SUGESTOES_DO_PERFIL[grupoDoPerfil(perfil?.id)]} />
          <FilasDeTarefas tarefas={tarefas} />
        </div>
      </main>
      <AbaSuporte />
    </>
  )
}
