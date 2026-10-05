import { useEffect, useRef, useState } from 'react'
import { PERFIS, trocarPerfil, usePerfil } from '../dados/perfis.ts'
import styles from './TrocarPerfil.module.css'

/**
 * Botão da função na barra do topo e o menu "Entrar como…" (overlay "Trocar perfil" do Figma, 59:979).
 * Troca entre perfis de exemplo, só na tela. `funcao` é a função da tela, que vale enquanto ninguém escolhe.
 */
export function TrocarPerfil({ funcao }: { funcao: string }) {
  const perfil = usePerfil(funcao)
  const [aberto, setAberto] = useState(false)
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fecharFora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false)
    }
    const fecharEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fecharFora)
    document.addEventListener('keydown', fecharEsc)
    return () => {
      document.removeEventListener('mousedown', fecharFora)
      document.removeEventListener('keydown', fecharEsc)
    }
  }, [aberto])

  return (
    <div className={styles.caixa} ref={caixa}>
      <button
        type="button"
        className={styles.funcao}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title={perfil?.usuario}
        onClick={() => setAberto(!aberto)}
      >
        <span className={styles.avatar} aria-hidden="true" />
        <span className={styles.funcaoNome}>{perfil?.rotulo ?? funcao}</span>
        <span className={styles.seta} aria-hidden="true">
          ⌄
        </span>
      </button>

      {aberto && (
        <div className={styles.menu} role="menu" aria-label="Entrar como…">
          <p className={styles.titulo} aria-hidden="true">
            Entrar como…
          </p>
          {PERFIS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={p.id === perfil?.id}
              className={styles.item}
              onClick={() => {
                trocarPerfil(p.id)
                setAberto(false)
              }}
            >
              {p.rotulo}{' '}
              <span className={styles.usuario}>{p.usuario}</span>
            </button>
          ))}
          <hr className={styles.linha} />
          {/* De outras histórias: o glossário e o login (Mateus). Avisam que estão indisponíveis. */}
          <button type="button" role="menuitem" className={`${styles.item} ${styles.glossario}`} aria-disabled="true">
            Glossário · códigos e portões
          </button>
          <button type="button" role="menuitem" className={`${styles.item} ${styles.sair}`} aria-disabled="true">
            Sair do portal
          </button>
        </div>
      )}
    </div>
  )
}
