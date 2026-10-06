import { sair } from '../api.ts'
import styles from './Entrar.module.css'

/** Entrou, mas a gestão ainda não atribuiu perfil (GGVP-96): nenhuma tela de caso (GGVP-117, CA4). */
export function SemPerfil({ nome }: { nome: string }) {
  return (
    <main className={styles.pagina}>
      <title>Sem perfil · GGV Previdenciário</title>
      <section className={styles.cartao}>
        <h1 className={styles.titulo}>Sem perfil, fale com a gestão.</h1>
        <p className={styles.texto}>
          {nome}, você entrou, mas ainda não tem um perfil no portal. Assim que a gestão atribuir, as suas tarefas aparecem aqui.
        </p>
        <button type="button" className={styles.botao} onClick={() => void sair()}>
          Sair
        </button>
      </section>
    </main>
  )
}
