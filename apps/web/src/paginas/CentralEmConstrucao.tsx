import { ID_DA_BUSCA } from '../componentes/BuscaGlobal.tsx'
import { ChatDoPortal } from '../componentes/ChatDoPortal.tsx'
import { FilasDeTarefas } from '../componentes/FilasDeTarefas.tsx'
import { Topbar } from '../componentes/Topbar.tsx'
import { useTarefasDoServidor } from '../dados/tarefas.ts'
import { juntarMinhas, useMinhasDoSetor } from '../dados/setor.ts'
import type { Tarefa } from '../dados/tipos.ts'
import { usePode } from '../sessao.ts'
import centralStyles from './CentralAtendimento.module.css'
import styles from './NaoConstruida.module.css'

/**
 * Início do perfil que não tem Central (GGVP-78): desde as Centrais da Sênior e do Financeiro e o início do Sócio, só um
 * perfil novo, antes da tela dele, cai aqui. A fila "O que você tem que fazer" vem do servidor (GGVP-8), com a barra do
 * topo, o "Entrar como…" e o "Sair".
 */
export function CentralEmConstrucao({ rotulo, deExemplo = [] }: { rotulo: string; /** Do servidor de exemplo, até a GGVP-125. */ deExemplo?: Tarefa[] }) {
  const doServidor = useTarefasDoServidor()
  // GGVP-147: o que o líder deu a outra pessoa sai da fila; o que deu a esta pessoa entra no topo.
  const minhasDoSetor = useMinhasDoSetor()
  const tarefas = doServidor && juntarMinhas([...doServidor, ...deExemplo], minhasDoSetor)
  // GGVP-135 (P11): a busca (no topo) e o chat, como nas outras Centrais; na fila vazia, o atalho para buscar um cliente (CA4).
  const veCaso = usePode('caso.ver')

  return (
    <>
      <title>Início · GGV Previdenciário</title>
      <Topbar
        itens={[
          { id: 'inicio', rotulo: 'Início', href: '/' },
          { id: 'agenda', rotulo: 'Agenda', href: '/agenda' },
        ]}
        ativo="inicio"
        funcao={rotulo}
        tarefas={tarefas ?? []}
      />
      <main className={centralStyles.pagina}>
        <div className={centralStyles.coluna}>
          <h1 className={styles.titulo}>Central · {rotulo}</h1>
          <ChatDoPortal exemplo="Ex.: “qual é a próxima tarefa da Maria Exemplo?”" sugestoes={[]} funcao={rotulo} tarefas={tarefas} />
          {tarefas && (
            <FilasDeTarefas
              tarefas={tarefas}
              vazio={
                <>
                  <p className={styles.texto}>Nada na sua fila agora.</p>
                  {veCaso && (
                    <button type="button" className={centralStyles.atalhoDaBusca} onClick={() => document.getElementById(ID_DA_BUSCA)?.focus()}>
                      Buscar um cliente
                    </button>
                  )}
                </>
              }
            />
          )}
        </div>
      </main>
    </>
  )
}
