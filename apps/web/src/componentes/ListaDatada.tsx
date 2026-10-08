import styles from './ListaDatada.module.css'

export type ItemDatado = { chave: string; quando: string; rotulo: string; texto: string }

/** Linhas de "Últimos contatos" e "Histórico" (Figma 73:331): a data à esquerda, o rótulo e o texto. */
export function ListaDatada({ itens, vazio, nome }: { itens: ItemDatado[]; vazio: string; nome: string }) {
  if (itens.length === 0) return <p className={styles.vazio}>{vazio}</p>
  return (
    <ul className={styles.lista} aria-label={nome}>
      {itens.map((item) => (
        <li key={item.chave} className={styles.item}>
          <span className={styles.quando}>{item.quando}</span>
          <span className={styles.textos}>
            <span className={styles.rotulo}>{item.rotulo}</span>
            <span className={styles.texto}>{item.texto}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
