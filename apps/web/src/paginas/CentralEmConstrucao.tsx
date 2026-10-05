import { Topbar } from '../componentes/Topbar.tsx'
import styles from './NaoConstruida.module.css'

/** Início dos perfis cuja Central ainda não virou código (GGVP-78): barra do topo com "Entrar como…" e "Sair". */
export function CentralEmConstrucao({ rotulo }: { rotulo: string }) {
  return (
    <>
      <title>Início · GGV Previdenciário</title>
      <Topbar itens={[{ id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' }]} ativo="inicio" funcao={rotulo} />
      <main className={styles.pagina}>
        <h1 className={styles.titulo}>Central · {rotulo}</h1>
        <p className={styles.texto}>A tela inicial deste perfil ainda está sendo construída. Troque de perfil no topo, se tiver outro.</p>
      </main>
    </>
  )
}
