import { useId, useState, type ReactNode } from 'react'
import { useQuadroDoSetor } from '../dados/setor.ts'
import type { Tarefa } from '../dados/tipos.ts'
import { usePode } from '../sessao.ts'
import styles from '../paginas/CentralAtendimento.module.css'
import { Abas } from './Abas.tsx'
import { ListaTarefas } from './ListaTarefas.tsx'
import { TarefasDoSetor } from './TarefasDoSetor.tsx'

/**
 * A fila da tela inicial (GGVP-78): "O que você tem que fazer". O líder do setor (a matriz dá `tarefa.atribuir` ao
 * líder do Atendimento e à Sênior) vê também a aba "Tarefas do setor"; quem não é líder não vê a aba (GGVP-147 CA3).
 */
export function FilasDeTarefas({ tarefas, vazio }: { tarefas: Tarefa[]; /** O que aparece com a fila vazia. */ vazio?: ReactNode }) {
  const lider = usePode('tarefa.atribuir')
  const setor = useQuadroDoSetor(lider)
  const [aba, setAba] = useState('minhas')
  const idTitulo = useId()
  const minhas = (
    <>
      <div className={styles.titulo}>
        <h2 id={idTitulo} className={styles.tituloTexto}>
          O que você tem que fazer
        </h2>
        <span className={styles.contagem}>{tarefas.length}</span>
      </div>
      {tarefas.length === 0 && vazio ? vazio : <ListaTarefas tarefas={tarefas} />}
    </>
  )
  if (!lider)
    return (
      <section className={styles.painel} aria-labelledby={idTitulo}>
        {minhas}
      </section>
    )
  return (
    <>
      <Abas
        rotulo="Filas de tarefas"
        ativa={aba}
        onMudar={setAba}
        abas={[
          { id: 'minhas', rotulo: `Minhas tarefas (${tarefas.length})` },
          { id: 'setor', rotulo: `Tarefas do setor (${setor.quadro?.tarefas.length ?? '…'})` },
        ]}
      />
      <section role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} className={styles.painel}>
        {aba === 'minhas' ? minhas : <TarefasDoSetor {...setor} />}
      </section>
    </>
  )
}
