import type { ReactNode } from 'react'
import styles from '../paginas/Balcao.module.css'

type Props = { beneficio: string; de: string; fichaId: string; children: ReactNode }

/** "O que você deve fazer" das telas de passo (Figma step_D1.18, D1.21, D1.23 e D1.24): texto, atalhos e a nota da IA. */
export function InstrucoesPasso({ beneficio, de, fichaId, children }: Props) {
  return (
    <section className={styles.instrucoes} aria-labelledby="o-que-fazer">
      <div className={styles.instrucoesTopo}>
        <span className={styles.estrela} aria-hidden="true">
          ✦
        </span>
        <h2 id="o-que-fazer" className={styles.instrucoesTitulo}>
          O que você deve fazer
        </h2>
        <span className={styles.beneficio}>◆ {beneficio || 'a definir'}</span>
        <span className={styles.instrucoesDe}>· {de}</span>
      </div>
      <p className={styles.instrucoesTexto}>{children}</p>
      <div className={styles.atalhos}>
        <a className={styles.atalho} href={`/clientes/${fichaId}`}>
          Abrir a ficha do cliente
        </a>
        {/* Entrevista e parecer são de outras histórias (GGVP-102 e GGVP-20). */}
        <button type="button" className={styles.atalho} aria-disabled="true">
          ▶ Entrevista e transcrições
        </button>
        <button type="button" className={styles.atalho} aria-disabled="true">
          Parecer médico
        </button>
      </div>
      <p className={styles.nota}>Montado pela IA a partir da entrevista, do benefício e do caso. Confira antes de agir.</p>
    </section>
  )
}
