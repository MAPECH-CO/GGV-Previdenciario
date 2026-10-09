import styles from '../paginas/Balcao.module.css'

export type Resultado = 'confirmou' | 'sem-resposta'

type Props = {
  resultado: Resultado | null
  aoResultado: (r: Resultado) => void
  ficha: boolean | null
  aoFicha: (preencheu: boolean) => void
  /** Linha de "Travas e estados": a tentativa de agora ou a sênior. */
  estado: string
  /** "Sem resposta" ainda não vale: a próxima tentativa é em outro dia (CA6). */
  semRespostaBloqueada: boolean
  travado: boolean
}

/** Painel "Antes de concluir" do passo D1.04 (Figma 10:33): as decisões se respondem aqui, como no desenho. */
export function AntesDeConcluirConfirmacao({ resultado, aoResultado, ficha, aoFicha, estado, semRespostaBloqueada, travado }: Props) {
  const fichaVale = resultado === 'confirmou' && !travado
  return (
    <aside className={styles.lado} aria-labelledby="antes-de-concluir">
      <h2 id="antes-de-concluir" className={styles.ladoTitulo}>
        Antes de concluir
      </h2>
      <p className={styles.ladoSub}>O que o BPMN (Miro) pede no passo D1.04.</p>
      <h3 className={styles.ladoSecao}>Decisões</h3>
      <div className={styles.decisao}>
        <p id="resultado-de-hoje">Resultado do contato de hoje</p>
        <div className={styles.ladoOpcoes} role="radiogroup" aria-labelledby="resultado-de-hoje">
          <button type="button" role="radio" className={styles.chip} aria-checked={resultado === 'confirmou'} disabled={travado} onClick={() => aoResultado('confirmou')}>
            Confirmou a entrevista
          </button>
          <button
            type="button"
            role="radio"
            className={styles.chip}
            aria-checked={resultado === 'sem-resposta'}
            disabled={travado || semRespostaBloqueada}
            onClick={() => aoResultado('sem-resposta')}
          >
            Sem resposta
          </button>
        </div>
      </div>
      <div className={styles.decisao}>
        <p id="ja-preencheu">Se «Confirmou a entrevista»: Já preencheu a ficha de atendimento?</p>
        <div className={styles.ladoOpcoes} role="radiogroup" aria-labelledby="ja-preencheu">
          <button type="button" role="radio" className={styles.chip} aria-checked={ficha === true} disabled={!fichaVale} onClick={() => aoFicha(true)}>
            Sim, a doutora prepara a conversa
          </button>
          <button type="button" role="radio" className={styles.chip} aria-checked={ficha === false} disabled={!fichaVale} onClick={() => aoFicha(false)}>
            Não, enviar a ficha à cliente
          </button>
        </div>
      </div>
      <h3 className={styles.ladoSecao}>Travas e estados</h3>
      <p>{estado}</p>
      <p className={styles.ladoSub}>«Confirmar entrevista» só habilita com as decisões respondidas.</p>
    </aside>
  )
}
