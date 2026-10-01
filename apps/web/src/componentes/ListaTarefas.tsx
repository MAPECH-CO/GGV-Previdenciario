import type { Tarefa } from '../dados/tipos.ts'
import { TarefaLinha } from './TarefaLinha.tsx'
import styles from './ListaTarefas.module.css'

/** A ordem vem pronta de quem chama: vencidas no topo, depois as de hoje (GGVP-78, CA2 e CA8). */
export function ListaTarefas({ tarefas }: { tarefas: Tarefa[] }) {
  return (
    <ul className={styles.lista}>
      {tarefas.map((tarefa) => (
        <TarefaLinha key={tarefa.id} tarefa={tarefa} />
      ))}
    </ul>
  )
}
