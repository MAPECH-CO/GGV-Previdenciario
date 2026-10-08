import type { ReactNode } from 'react'
import { ROTULO_PERFIL, ehPerfil, type Acao } from '@ggv/contratos'
import { usePode, useSessao } from '../sessao.ts'
import styles from './NaoConstruida.module.css'

/** Tela de outro perfil (GGVP-96 CA11): avisa e não carrega nada do caso. */
export function SemPermissao() {
  const perfil = useSessao()?.perfilAtivo ?? null
  return (
    <main className={styles.pagina}>
      <title>Sem permissão · GGV Previdenciário</title>
      <h1 className={styles.titulo}>Sem permissão</h1>
      <p className={styles.texto}>
        Esta tela não é do perfil {ehPerfil(perfil) ? ROTULO_PERFIL[perfil] : 'atual'}. Se ela é do seu trabalho, troque de perfil no topo ou fale com a gestão.
      </p>
      <a className={styles.voltar} href="/">
        Voltar ao início
      </a>
    </main>
  )
}

/**
 * Envolve a tela de um passo: sem a permissão, mostra "Sem permissão" e a tela nem monta (nenhum dado é pedido).
 * `<Exige acao="caso.aprovar_para_inss"><ConferenciaSenior /></Exige>`
 */
export function Exige({ acao, children }: { acao: Acao; children: ReactNode }) {
  return usePode(acao) ? children : <SemPermissao />
}
