import { destinoDaTarefa } from '../dados/tarefas.ts'
import type { Tarefa } from '../dados/tipos.ts'
import { PreviaDoCliente } from './PreviaDoCliente.tsx'
import styles from './TarefaLinha.module.css'

type Props = { tarefa: Tarefa }

/**
 * Uma tarefa da fila. A linha inteira abre o passo do caso; o nome do cliente abre a ficha dele. Sem tela própria, a linha
 * abre a ficha; sem cliente, não é link (GGVP-120 CA4).
 * Os dois links são irmãos (nunca um dentro do outro): o da ação se estica por cima da linha com ::after.
 * As rotas são provisórias até as telas de passo e de cliente existirem.
 */
export function TarefaLinha({ tarefa }: Props) {
  const { cliente, contexto, acao, detalhe, prazo, urgente } = tarefa
  const quem = cliente?.nome ?? contexto ?? ''
  const destino = destinoDaTarefa(tarefa)

  return (
    <li className={`${styles.linha} ${urgente ? styles.urgente : ''}`}>
      <span className={styles.ponto} aria-hidden="true" />
      <div className={styles.corpo}>
        <div className={styles.titulo}>
          <span className={styles.texto}>
            {cliente ? (
              <PreviaDoCliente id={cliente.id} nome={cliente.nome}>
                <a className={`${styles.quem} ${styles.cliente}`} href={`/clientes/${cliente.id}`}>
                  {cliente.nome}
                </a>
              </PreviaDoCliente>
            ) : (
              <strong className={styles.quem}>{contexto}</strong>
            )}
            {destino ? (
              <a className={styles.acao} href={destino} aria-label={`${quem} · ${acao}`}>
                {' · '}
                {acao}
              </a>
            ) : (
              <span>
                {' · '}
                {acao}
              </span>
            )}
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
      {destino && (
        <span className={styles.seta} aria-hidden="true">
          ›
        </span>
      )}
    </li>
  )
}
