import styles from './CampoBusca.module.css'

const ROTULO = 'Buscar processo, cliente ou tarefa'

/** A busca ainda não consulta nada. O resultado respeita as permissões do perfil (GGVP-78, CA9). */
export function CampoBusca() {
  return (
    <form className={styles.campo} role="search" onSubmit={(e) => e.preventDefault()}>
      <span className={styles.lupa} aria-hidden="true">
        ⌕
      </span>
      <input className={styles.entrada} type="search" placeholder={ROTULO} aria-label={ROTULO} />
    </form>
  )
}
