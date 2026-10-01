import type { Tarefa } from '../dados/tipos.ts'
import styles from './TarefaLinha.module.css'

type Props = { tarefa: Tarefa }

/**
 * Uma tarefa da fila. A linha inteira abre o passo do caso; o nome do cliente abre a ficha dele.
 * Os dois links são irmãos (nunca um dentro do outro): o da ação se estica por cima da linha com ::after.
 * As rotas são provisórias até as telas de passo e de cliente existirem.
 */
export function TarefaLinha({ tarefa }: Props) {
  const { codigo, cliente, contexto, acao, detalhe, prazo, urgente } = tarefa
  const quem = cliente?.nome ?? contexto ?? ''

  return (
    <li className={`${styles.linha} ${urgente ? styles.urgente : ''}`}>
      <span className={styles.ponto} aria-hidden="true" />
      <div className={styles.corpo}>
        <div className={styles.titulo}>
          <span className={styles.codigo}>{codigo}</span>
          <span className={styles.texto}>
            {cliente ? (
              <a className={`${styles.quem} ${styles.cliente}`} href={`/clientes/${cliente.id}`}>
                {cliente.nome}
              </a>
            ) : (
              <strong className={styles.quem}>{contexto}</strong>
            )}
            <a className={styles.acao} href={`/tarefas/${tarefa.id}`} aria-label={`${quem} · ${acao}`}>
              {' · '}
              {acao}
            </a>
          </span>
        </div>
        <p className={styles.detalhe}>{detalhe}</p>
      </div>
      {prazo && (
        <span className={styles.prazo}>
          {urgente && <span className="so-leitor">Urgente: </span>}
          {prazo}
        </span>
      )}
      <span className={styles.seta} aria-hidden="true">
        ›
      </span>
    </li>
  )
}
