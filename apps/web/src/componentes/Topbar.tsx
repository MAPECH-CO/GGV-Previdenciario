import { BotoesPreferencias } from './BotoesPreferencias.tsx'
import styles from './Topbar.module.css'
import { TrocarPerfil } from './TrocarPerfil.tsx'

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
  /** Função da tela; vale até a pessoa escolher outro perfil no menu. */
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
      <TrocarPerfil funcao={funcao} />
    </header>
  )
}
