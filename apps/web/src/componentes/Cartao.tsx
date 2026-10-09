import { useId, type ReactNode } from 'react'
import styles from './Cartao.module.css'

type Props = {
  /** Título do bloco. Sem ele, o bloco se apresenta pelo `rotulo`. */
  titulo?: string
  rotulo?: string
  children: ReactNode
}

/** Bloco branco com borda das telas de cliente (Figma 73:199 e 73:371). */
export function Cartao({ titulo, rotulo, children }: Props) {
  const id = useId()
  return (
    <section className={styles.cartao} aria-labelledby={titulo ? id : undefined} aria-label={titulo ? undefined : rotulo}>
      {titulo && (
        <h2 id={id} className={styles.titulo}>
          {titulo}
        </h2>
      )}
      {children}
    </section>
  )
}
