import styles from './AbaSuporte.module.css'

/** Aba "✦ Suporte" na borda direita. Vai abrir o chat do escritório (Chatwoot, ADR-015); ainda não abre nada. */
export function AbaSuporte() {
  return (
    <button type="button" className={styles.aba} aria-haspopup="dialog" aria-expanded="false">
      <span className={styles.texto}>✦ Suporte</span>
    </button>
  )
}
