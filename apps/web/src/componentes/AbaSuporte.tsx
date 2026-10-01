import styles from './AbaSuporte.module.css'

/** Aba "✦ Suporte" na borda direita. Vai abrir o chat do escritório (Chatwoot, ADR-015); até lá, avisa que está indisponível. */
export function AbaSuporte() {
  return (
    <button type="button" className={styles.aba} aria-disabled="true">
      <span className={styles.texto}>✦ Suporte</span>
    </button>
  )
}
