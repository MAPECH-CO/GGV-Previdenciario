import { useEffect, useId, useRef, useState } from 'react'
import { ROTULO_PERFIL, ehPerfil, type UsuarioDaSessao } from '@ggv/contratos'
import { sair } from '../api.ts'
import { trocarPerfil } from '../sessao.ts'
import { Icone } from './Icone.tsx'
import styles from './Topbar.module.css'

const rotuloDoPerfil = (perfil: string | null) => (ehPerfil(perfil) ? ROTULO_PERFIL[perfil] : 'Sem perfil')

/** As iniciais do nome, sem o que vem entre parênteses: "Helena (exemplo)" → "H"; "Ana Paula Souza" → "AS". */
function iniciais(nome: string | undefined) {
  const partes = (nome ?? '').replace(/\(.*?\)/g, ' ').trim().split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? (partes.at(-1)?.[0] ?? '') : '')).toUpperCase() || '?'
}

/** O círculo com as iniciais da pessoa. */
export function Avatar({ nome, grande = false }: { nome: string; grande?: boolean }) {
  return (
    <span className={grande ? `${styles.avatar} ${styles.avatarGrande}` : styles.avatar} aria-hidden="true">
      {iniciais(nome)}
    </span>
  )
}

/**
 * Os perfis da pessoa (GGVP-96 CA10): só os atribuídos; o servidor recusa outro. Escolher troca a Central.
 * Vale no menu do computador e no menu do celular.
 */
export function PerfisDaPessoa({ usuario }: { usuario: UsuarioDaSessao }) {
  const [erro, setErro] = useState('')
  async function escolher(perfil: string) {
    if (perfil === usuario.perfilAtivo) return
    const r = await trocarPerfil(perfil)
    if (!r.ok) setErro(r.erro)
  }
  return (
    <>
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
          {rotuloDoPerfil(perfil)}
          {perfil === usuario.perfilAtivo && <Icone nome="feito" className={styles.menuMarca} />}
        </button>
      ))}
      {erro && (
        <p className={styles.menuErro} role="alert">
          {erro}
        </p>
      )}
    </>
  )
}

/** O botão de sair também limpa a cópia do navegador. */
export function BotaoSair({ className }: { className: string }) {
  return (
    <button type="button" role="menuitem" className={className} onClick={() => void sair()}>
      <Icone nome="sair" />
      Sair
    </button>
  )
}

/**
 * A pessoa no topo (11/10, no lugar do seletor de função): as iniciais, o nome e, menor, o perfil ativo. Aberto, o
 * nome e o e-mail, a troca de perfil ("Entrar como…") e o "Sair".
 */
export function MenuDaPessoa({ usuario }: { usuario: UsuarioDaSessao }) {
  const [aberto, setAberto] = useState(false)
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

  return (
    <div className={styles.pessoa} ref={caixa}>
      <button
        type="button"
        className={styles.pessoaBotao}
        aria-label={`${usuario.nome}, ${rotuloDoPerfil(usuario.perfilAtivo)}`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={idMenu}
        onClick={() => setAberto((a) => !a)}
      >
        <Avatar nome={usuario.nome} />
        <span className={styles.pessoaTexto}>
          <span className={styles.pessoaNome}>{usuario.nome}</span>
          <span className={styles.pessoaPerfil}>{rotuloDoPerfil(usuario.perfilAtivo)}</span>
        </span>
        <Icone nome="abrir" className={styles.seta} />
      </button>
      {aberto && (
        <div id={idMenu} className={styles.menu} role="menu" aria-label="Entrar como">
          <div className={styles.menuCabeca}>
            <Avatar nome={usuario.nome} grande />
            <div>
              <p className={styles.menuNome}>{usuario.nome}</p>
              <p className={styles.menuEmail}>{usuario.email}</p>
            </div>
          </div>
          <PerfisDaPessoa usuario={usuario} />
          <hr className={styles.menuLinha} />
          <BotaoSair className={styles.menuItem} />
        </div>
      )}
    </div>
  )
}
