import { useState } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { CampoBusca } from '../componentes/CampoBusca.tsx'
import { ChatDoPortal } from '../componentes/ChatDoPortal.tsx'
import { FilasDeTarefas } from '../componentes/FilasDeTarefas.tsx'
import { Topbar, type ItemNavegacao } from '../componentes/Topbar.tsx'
import { tarefasCriadasPeloChat } from '../dados/chat.ts'
import { usePerfil } from '../dados/perfis.ts'
import { juntarMinhas, useMinhasDoSetor } from '../dados/setor.ts'
import { useTarefasDoServidor } from '../dados/tarefas.ts'
import styles from './CentralAtendimento.module.css'
import naoConstruida from './NaoConstruida.module.css'

// Figma: "Central de trabalho · Financeiro" (59:863; v2 da GGVP-44, 2456:1350). É a tela inicial de quem entra como
// Financeiro (App.tsx). A Gestão e o painel Financeiro entram no topo pelo perfil (itensDaGestao.ts).
const navegacao: ItemNavegacao[] = [
  { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' },
  { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
]

const CHAT = { exemplo: 'Ex.: “o que chegou de prestação de contas hoje?”', sugestoes: ['Prestações recebidas', 'Documento novo', 'Resumo do cliente'] }

/**
 * A fila do Financeiro vem toda do servidor (GGVP-44, GGVP-98): receber e lançar a prestação de contas, avisar o cliente e
 * marcar a ida ao banco, e confirmar o recebimento depois da ida. Cada linha abre a tela do passo.
 */
export function CentralFinanceiro() {
  const perfil = usePerfil('Financeiro')
  // GGVP-82: e as tarefas que o chat criou para a pessoa.
  const [doChat] = useState(() => tarefasCriadasPeloChat(perfil?.usuario))
  const doServidor = useTarefasDoServidor()
  // GGVP-147: o que o líder deu a outra pessoa sai da fila; o que deu a esta pessoa entra no topo.
  const minhasDoSetor = useMinhasDoSetor()
  const tarefas = doServidor && juntarMinhas([...doServidor, ...doChat], minhasDoSetor)

  return (
    <>
      <title>Início do Financeiro · GGV Previdenciário</title>
      <Topbar itens={navegacao} ativo="inicio" funcao="Financeiro" />
      <main className={styles.pagina}>
        <div className={styles.coluna}>
          <h1 className="so-leitor">Início do Financeiro</h1>
          <CampoBusca tarefas={tarefas ?? []} />
          <ChatDoPortal exemplo={CHAT.exemplo} sugestoes={CHAT.sugestoes} funcao="Financeiro" />
          {tarefas && (
            <FilasDeTarefas
              tarefas={tarefas}
              vazio={
                <>
                  <p className={naoConstruida.texto}>Nada na sua fila agora.</p>
                  <a className={styles.atalhoDaBusca} href="/financeiro">
                    Abrir o painel Financeiro
                  </a>
                </>
              }
            />
          )}
        </div>
      </main>
      <AbaSuporte />
    </>
  )
}
