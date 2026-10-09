import { CampoBusca, ID_DA_BUSCA } from '../componentes/CampoBusca.tsx'
import { ChatDoPortal } from '../componentes/ChatDoPortal.tsx'
import { FilasDeTarefas } from '../componentes/FilasDeTarefas.tsx'
import { ITENS_DA_GESTAO } from '../componentes/itensDaGestao.ts'
import { Topbar } from '../componentes/Topbar.tsx'
import { usePerfil } from '../dados/perfis.ts'
import { editaRoteiro } from '../dados/roteiro.ts'
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
  // GGVP-109 CA9 e GGVP-75: a gestão chega às tentativas bloqueadas e aos resultados pelo topo; o Financeiro, só aos
  // Resultados, como no Figma (GGVP-96).
  const gestao = usePode('gestao.ver')
  const resultados = usePode('resultados.ver')
  // GGVP-146, parte 2: a importação da planilha do escritório.
  const importar = usePode('configuracao.editar')
  // GGVP-19: o Jurídico chega aos estudos de caso feitos pela IA pelo topo.
  const estudos = usePode('estudo.ver')
  // GGVP-135 (P13): a Sênior edita os roteiros de laudos; antes, só pelo endereço.
  const perfil = usePerfil()
  const roteiros = editaRoteiro(perfil?.id)
  // GGVP-135 (P11): a busca e o chat, como nas outras Centrais; no estado vazio, o atalho para buscar um cliente (CA4).
  const veCaso = usePode('caso.ver')

  return (
    <>
      <title>Início · GGV Previdenciário</title>
      <Topbar
        itens={[
          { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' },
          // GGVP-78: a Agenda depois do Início, como no Figma da Sênior (1927:14) e do Financeiro (1933:29).
          { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
          ...(estudos ? [{ id: 'estudos', glifo: '📚', rotulo: 'Estudos de caso', href: '/estudos' }] : []),
          ...(roteiros ? [{ id: 'roteiros', glifo: '☰', rotulo: 'Roteiros de laudos', href: '/roteiros' }] : []),
          ...(gestao ? ITENS_DA_GESTAO : ITENS_DA_GESTAO.filter((i) => resultados && i.id === 'resultados')),
          ...(importar ? [{ id: 'importar', glifo: '⇪', rotulo: 'Importar planilha', href: '/gestao/importar' }] : []),
        ]}
        ativo="inicio"
        funcao={rotulo}
      />
      <main className={centralStyles.pagina}>
        <div className={centralStyles.coluna}>
          <h1 className={styles.titulo}>Central · {rotulo}</h1>
          <CampoBusca tarefas={tarefas ?? []} />
          <ChatDoPortal exemplo="Ex.: “qual é a próxima tarefa da Maria Exemplo?”" sugestoes={[]} funcao={rotulo} />
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
