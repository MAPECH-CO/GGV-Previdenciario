import { ListaTarefas } from '../componentes/ListaTarefas.tsx'
import { Topbar } from '../componentes/Topbar.tsx'
import { useTarefasDoServidor } from '../dados/tarefas.ts'
import centralStyles from './CentralAtendimento.module.css'
import styles from './NaoConstruida.module.css'

/**
 * Início dos perfis que ainda não têm a Central desenhada em código (GGVP-78): a fila "O que você tem que fazer"
 * vem do servidor (GGVP-8), com a barra do topo, o "Entrar como…" e o "Sair".
 */
export function CentralEmConstrucao({ rotulo }: { rotulo: string }) {
  const tarefas = useTarefasDoServidor()

  return (
    <>
      <title>Início · GGV Previdenciário</title>
      <Topbar itens={[{ id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' }]} ativo="inicio" funcao={rotulo} />
      <main className={centralStyles.pagina}>
        <div className={centralStyles.coluna}>
          <h1 className={styles.titulo}>Central · {rotulo}</h1>
          <div className={centralStyles.titulo}>
            <h2 className={centralStyles.tituloTexto}>O que você tem que fazer</h2>
            <span className={centralStyles.contagem}>{tarefas?.length ?? '…'}</span>
          </div>
          {tarefas && tarefas.length === 0 && <p className={styles.texto}>Nada na sua fila agora.</p>}
          {tarefas && tarefas.length > 0 && <ListaTarefas tarefas={tarefas} />}
        </div>
      </main>
    </>
  )
}
