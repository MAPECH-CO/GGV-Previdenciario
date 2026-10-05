import styles from './TopoPasso.module.css'

/** Barra do topo das telas de passo (Figma step_*): "‹ Voltar", Início, Agenda e o contexto à direita. */
export function TopoPasso({ contexto, inicio = '/' }: { contexto: string; /** A Central de quem está na tela. */ inicio?: string }) {
  return (
    <header className={styles.topo}>
      <button type="button" className={styles.voltar} onClick={() => history.back()}>
        ‹ Voltar
      </button>
      <nav className={styles.nav} aria-label="Principal">
        <a className={styles.item} href={inicio}>
          <span aria-hidden="true">⌂ </span>Início
        </a>
        <a className={styles.item} href="/agenda">
          <span aria-hidden="true">▦ </span>Agenda
        </a>
      </nav>
      <div className={styles.espaco} />
      <p className={styles.contexto}>{contexto}</p>
    </header>
  )
}
