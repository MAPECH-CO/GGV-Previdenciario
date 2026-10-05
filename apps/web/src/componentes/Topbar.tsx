import { sair } from '../api.ts'
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
      {/* Troca de função ainda não está ligada (overlay "Trocar perfil" do Figma, GGVP-78): avisa que está indisponível. */}
      <button type="button" className={styles.funcao} aria-disabled="true">
        <span className={styles.avatar} aria-hidden="true" />
        <span className={styles.funcaoNome}>{funcao}</span>
        <span className={styles.seta} aria-hidden="true">
          ⌄
        </span>
      </button>
      <button type="button" className={styles.sair} onClick={() => void sair()}>
        Sair
      </button>
    </header>
  )
}
