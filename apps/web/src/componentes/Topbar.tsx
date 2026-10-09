import { sair } from '../api.ts'
import { useSessao } from '../sessao.ts'
import { EntrarComo } from './EntrarComo.tsx'
import { BotoesPreferencias } from './BotoesPreferencias.tsx'
import styles from './Topbar.module.css'

export type ItemNavegacao = {
  id: string
  /** Símbolo antes do rótulo, só enfeite (⌂, ▦). */
  glifo?: string
  rotulo: string
  href: string
}

type Props = {
  itens: ItemNavegacao[]
  /** id do item da página atual. */
  ativo: string
  /** Nome da função de quem está logado. */
  funcao: string
  acao?: { rotulo: string; href: string }
}

export function Topbar({ itens, ativo, funcao, acao }: Props) {
  // Com sessão, o botão da função vira o "Entrar como…" (GGVP-96); sem ela (testes, /tokens), segue indisponível.
  const usuario = useSessao()
  return (
    <header className={styles.topbar}>
      <a className={styles.marca} href="/" aria-label="GGV Previdenciário, início">
        <span className={styles.logo} aria-hidden="true">
          §
        </span>
        <span className={styles.nome}>GGV Previdenciário</span>
      </a>

      <nav className={styles.nav} aria-label="Principal">
        {itens.map((item) => (
          <a
            key={item.id}
            className={styles.item}
            href={item.href}
            aria-current={item.id === ativo ? 'page' : undefined}
          >
            {item.glifo && <span aria-hidden="true">{item.glifo} </span>}
            {item.rotulo}
          </a>
        ))}
      </nav>

      <div className={styles.espaco} />

      {acao && (
        <a className={styles.acao} href={acao.href}>
          {acao.rotulo}
        </a>
      )}
      <BotoesPreferencias />
      {usuario ? (
        <EntrarComo usuario={usuario} />
      ) : (
        <button type="button" className={styles.funcao} aria-disabled="true">
          <span className={styles.avatar} aria-hidden="true" />
          <span className={styles.funcaoNome}>{funcao}</span>
          <span className={styles.seta} aria-hidden="true">
            ⌄
          </span>
        </button>
      )}
      {/* A cópia do navegador fica ao sair (09/10): o roteiro troca de pessoa na mesma aba e segue o caso de exemplo. Limpar
          aqui volta quando o exemplo sair da homologação (ver trocarPerfil, em sessao.ts). */}
      <button type="button" className={styles.sair} onClick={() => void sair()}>
        Sair
      </button>
    </header>
  )
}
