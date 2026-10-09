import { useState, type ReactNode } from 'react'
import styles from '../paginas/Balcao.module.css'
import { ParecerMedico } from './ParecerMedico.tsx'

type Props = {
  beneficio: string
  de: string
  fichaId: string
  children: ReactNode
  /** Com o caso, "Parecer médico" abre a janela do parecer (GGVP-20), na visão do perfil. */
  processoId?: string
  /** A função da tela (rótulo do perfil), até a pessoa escolher outro. */
  funcao?: string
}

/** "O que você deve fazer" das telas de passo (Figma step_D1.18, D1.21, D1.23 e D1.24): texto, atalhos e a nota da IA. */
export function InstrucoesPasso({ beneficio, de, fichaId, children, processoId, funcao = 'Documentação' }: Props) {
  const [parecer, setParecer] = useState(false)
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
        {/* A entrevista é de outra história (GGVP-102). */}
        <button type="button" className={styles.atalho} aria-disabled="true">
          ▶ Entrevista e transcrições
        </button>
        {processoId ? (
          <button type="button" className={styles.atalho} onClick={() => setParecer(true)}>
            Parecer médico
          </button>
        ) : (
          <button type="button" className={styles.atalho} aria-disabled="true">
            Parecer médico
          </button>
        )}
      </div>
      <p className={styles.nota}>Montado pela IA a partir da entrevista, do benefício e do caso. Confira antes de agir.</p>
      {parecer && processoId && <ParecerMedico processoId={processoId} funcao={funcao} aoFechar={() => setParecer(false)} />}
    </section>
  )
}
