import styles from './Carregando.module.css'

/**
 * Enquanto o portal confere a sessão, a tela não fica em branco: a marca e o "Carregando…". Se o servidor não responde,
 * diz isso e oferece tentar de novo (a sessão vencida já leva ao login antes de chegar aqui).
 */
export function Carregando({ falhou = false }: { falhou?: boolean }) {
  return (
    <main className={styles.tela}>
      <span className={styles.logo} aria-hidden="true">
        §
      </span>
      {falhou ? (
        <div className={styles.falha} role="alert">
          <p>Não deu para abrir o portal agora. Confira a internet e tente de novo.</p>
          <button type="button" className={styles.botao} onClick={() => window.location.reload()}>
            Tentar de novo
          </button>
        </div>
      ) : (
        <p className={styles.texto} role="status">
          Carregando o portal…
        </p>
      )}
    </main>
  )
}
