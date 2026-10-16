import { useEffect, useState } from 'react'
import { destinoDaTarefa, resumirTarefa } from '../dados/tarefas.ts'
import type { Tarefa } from '../dados/tipos.ts'
import { usePode } from '../sessao.ts'
import { Previa } from './Previa.tsx'
import estilo from './Previa.module.css'
import { ConteudoDoCliente } from './PreviaDoCliente.tsx'
import styles from './TarefaLinha.module.css'

type Props = { tarefa: Tarefa }

/** O resumo da IA chega depois de abrir o balão; enquanto isso, duas linhas guardam o lugar. */
function ResumoDaIa({ tarefa }: Props) {
  const [resumo, setResumo] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    let valendo = true
    resumirTarefa(tarefa).then(
      (r) => valendo && setResumo(r),
      () => valendo && setResumo(null),
    )
    return () => {
      valendo = false
    }
  }, [tarefa])

  return (
    <p className={estilo.ia} aria-live="polite">
      <span className={estilo.marca}>✦ Resumo da IA</span>
      {resumo === undefined ? (
        <>
          <span className="so-leitor">Resumindo a tarefa…</span>
          <span className={estilo.esperando} aria-hidden="true" />
          <span className={estilo.esperando} aria-hidden="true" />
        </>
      ) : resumo ? (
        <span>{resumo}</span>
      ) : (
        <span className={estilo.linha}>A IA não resumiu agora. Abra a tarefa para ver os detalhes.</span>
      )}
    </p>
  )
}

/**
 * O balão da tarefa (Pedro, 16/10): o que a tarefa pede, explicado pela IA, e os dados do cliente e do processo, para a
 * pessoa saber se entra sem precisar entrar. Os dados do cliente só para quem vê o caso.
 */
function BalaoDaTarefa({ tarefa }: Props) {
  const veCaso = usePode('caso.ver')
  return (
    <>
      <ResumoDaIa tarefa={tarefa} />
      {tarefa.cliente && veCaso && <ConteudoDoCliente id={tarefa.cliente.id} />}
    </>
  )
}

/**
 * Uma tarefa da fila. A linha inteira abre o passo do caso; o nome do cliente abre a ficha dele. Sem tela própria, a linha
 * abre a ficha; sem cliente, não é link (GGVP-120 CA4). Com o mouse parado na linha, o balão ao lado explica a tarefa.
 * Os dois links são irmãos (nunca um dentro do outro): o da ação se estica por cima da linha com ::after.
 */
export function TarefaLinha({ tarefa }: Props) {
  const { cliente, contexto, acao, detalhe, prazo, urgente } = tarefa
  const quem = cliente?.nome ?? contexto ?? ''
  const destino = destinoDaTarefa(tarefa)

  return (
    <Previa lado="direita" rotulo={quem ? `${quem} · ${acao}` : acao} conteudo={() => <BalaoDaTarefa tarefa={tarefa} />}>
      <li className={`${styles.linha} ${urgente ? styles.urgente : ''}`}>
        <span className={styles.ponto} aria-hidden="true" />
        <div className={styles.corpo}>
          <div className={styles.titulo}>
            <span className={styles.texto}>
              {cliente ? (
                <a className={`${styles.quem} ${styles.cliente}`} href={`/clientes/${cliente.id}`}>
                  {cliente.nome}
                </a>
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
    </Previa>
  )
}
