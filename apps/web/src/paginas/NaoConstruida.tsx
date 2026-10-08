import styles from './NaoConstruida.module.css'

/** Destino de qualquer link cuja tela ainda não virou código. */
export function NaoConstruida({ caminho }: { caminho: string }) {
  return (
    <main className={styles.pagina}>
      <title>Tela não construída · GGV Previdenciário</title>
      <h1 className={styles.titulo}>Esta tela ainda não foi construída</h1>
      <p className={styles.texto}>
        <code>{caminho}</code>
      </p>
      <a className={styles.voltar} href="/">
        Voltar ao início
      </a>
    </main>
  )
}
