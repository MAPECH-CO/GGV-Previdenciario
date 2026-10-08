import { mudarPreferencias, usePreferencias } from '../design/preferencias.ts'
import styles from './BotoesPreferencias.module.css'

/** Tema claro/escuro e fonte padrão/grande. No Figma: ☾ Escuro / ☀ Claro e A+ / A−. */
export function BotoesPreferencias() {
  const { tema, fonte } = usePreferencias()
  const escuro = tema === 'escuro'
  const grande = fonte === 'grande'

  return (
    <div className={styles.grupo}>
      <button
        type="button"
        className={styles.botao}
        aria-label={escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
        onClick={() => mudarPreferencias({ tema: escuro ? 'claro' : 'escuro' })}
      >
        {escuro ? '☀ Claro' : '☾ Escuro'}
      </button>
      <button
        type="button"
        className={styles.botao}
        aria-label={grande ? 'Diminuir a fonte' : 'Aumentar a fonte'}
        onClick={() => mudarPreferencias({ fonte: grande ? 'padrao' : 'grande' })}
      >
        {grande ? 'A−' : 'A+'}
      </button>
    </div>
  )
}
