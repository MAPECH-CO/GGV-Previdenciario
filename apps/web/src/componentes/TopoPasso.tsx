import { ROTULO_PERFIL, ehPerfil } from '@ggv/contratos'
import { useSessao } from '../sessao.ts'
import styles from './TopoPasso.module.css'

/** Barra do topo das telas de passo (Figma step_*): "‹ Voltar", Início, Agenda e o contexto à direita. */
export function TopoPasso({ contexto, inicio = '/' }: { contexto: string; /** A Central de quem está na tela. */ inicio?: string }) {
  // Com sessão, o topo é de quem entrou: Início é "/" (o App abre a Central do perfil ativo) e o "Você · ..." desenhado
  // para uma função mostra a função da sessão. Sem sessão (teste de uma tela sozinha), fica como foi desenhado.
  const sessao = useSessao()
  const ativo = sessao?.perfilAtivo
  const texto = sessao && contexto.startsWith('Você ·') && ehPerfil(ativo) ? `Você · ${ROTULO_PERFIL[ativo]}` : contexto
  return (
    <header className={styles.topo}>
      <button type="button" className={styles.voltar} onClick={() => history.back()}>
        ‹ Voltar
      </button>
      <nav className={styles.nav} aria-label="Principal">
        <a className={styles.item} href={sessao ? '/' : inicio}>
          <span aria-hidden="true">⌂ </span>Início
        </a>
        <a className={styles.item} href="/agenda">
          <span aria-hidden="true">▦ </span>Agenda
        </a>
      </nav>
      <div className={styles.espaco} />
      <p className={styles.contexto}>{texto}</p>
    </header>
  )
}
