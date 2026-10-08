import { useEffect, useId, useRef, useState } from 'react'
import { ROTULO_PERFIL, ehPerfil, type UsuarioDaSessao } from '@ggv/contratos'
import { trocarPerfil } from '../sessao.ts'
import styles from './Topbar.module.css'

const rotulo = (perfil: string | null) => (ehPerfil(perfil) ? ROTULO_PERFIL[perfil] : 'Sem perfil')

/** "Entrar como…" (GGVP-96 CA10): só os perfis atribuídos à pessoa. Figma: overlay "Trocar perfil". */
export function EntrarComo({ usuario }: { usuario: UsuarioDaSessao }) {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState('')
  const idMenu = useId()
  const caixa = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => caixa.current?.contains(e.target as Node) || setAberto(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [aberto])

  async function escolher(perfil: string) {
    if (perfil === usuario.perfilAtivo) return setAberto(false)
    const r = await trocarPerfil(perfil)
    if (!r.ok) setErro(r.erro)
  }

  return (
    <div className={styles.entrarComo} ref={caixa}>
      <button
        type="button"
        className={styles.funcao}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={idMenu}
        onClick={() => setAberto((a) => !a)}
      >
        <span className={styles.avatar} aria-hidden="true" />
        <span className={styles.funcaoNome}>{rotulo(usuario.perfilAtivo)}</span>
        <span className={styles.seta} aria-hidden="true">
          ⌄
        </span>
      </button>
      {aberto && (
        <div id={idMenu} className={styles.menu} role="menu" aria-label="Entrar como">
          <p className={styles.menuTitulo}>Entrar como…</p>
          {usuario.perfis.map((perfil) => (
            <button
              key={perfil}
              type="button"
              role="menuitemradio"
              aria-checked={perfil === usuario.perfilAtivo}
              className={styles.menuItem}
              onClick={() => void escolher(perfil)}
            >
              {rotulo(perfil)}
            </button>
          ))}
          {erro && (
            <p className={styles.menuErro} role="alert">
              {erro}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
