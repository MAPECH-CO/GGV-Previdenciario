import type { ReactNode } from 'react'
import styles from './Passo.module.css'

/**
 * A moldura de uma tela de passo: a tela inteira (título da aba, volta ao início e cabeçalho) ou, quando o passo segue
 * dentro de outra tela, um cartão com o título (ajuste do Mateus, 06/10: a resposta do INSS e o passo seguinte numa
 * tela só, se quem registrou quiser).
 */
export function Moldura({ titulo, cabecalho, embutida = false, children }: { titulo: string; cabecalho?: ReactNode; embutida?: boolean; children: ReactNode }) {
  if (embutida)
    return (
      <section className={styles.cartao} aria-label={titulo}>
        <h2 className={styles.cartaoTitulo}>{titulo}</h2>
        {children}
      </section>
    )
  return (
    <main className={styles.pagina}>
      <title>{`${titulo} · GGV Previdenciário`}</title>
      {cabecalho}
      {children}
    </main>
  )
}
