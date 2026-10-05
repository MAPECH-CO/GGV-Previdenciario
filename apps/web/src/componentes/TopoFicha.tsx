import type { ReactNode } from 'react'
import styles from './TopoFicha.module.css'

type Props = {
  titulo: string
  chips: { texto: string; tom: 'acento' | 'neutro' }[]
  /** Botão à direita, antes de "Você · Atendimento". */
  acao?: ReactNode
}

/** Barra do topo das telas de cliente (Figma 73:371 e 73:199): "‹ Central", Início, Agenda, título e chips. */
export function TopoFicha({ titulo, chips, acao }: Props) {
  return (
    <header className={styles.topo}>
      <a className={styles.central} href="/">
        ‹&nbsp; Central
      </a>
      <nav className={styles.nav} aria-label="Principal">
        <a className={styles.item} href="/">
          <span aria-hidden="true">⌂ </span>Início
        </a>
        <a className={styles.item} href="/agenda">
          <span aria-hidden="true">▦ </span>Agenda
        </a>
      </nav>
      <div className={styles.titulos}>
        <h1 className={styles.titulo}>{titulo}</h1>
        <p className={styles.chips}>
          {chips.map((c) => (
            <span key={c.texto} className={c.tom === 'acento' ? styles.chipAcento : styles.chipNeutro}>
              {c.texto}
            </span>
          ))}
        </p>
      </div>
      {acao}
      <p className={styles.quem}>Você · Atendimento</p>
    </header>
  )
}
