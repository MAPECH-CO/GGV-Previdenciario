import type { ReactNode } from 'react'
import { AbaSuporte } from '../componentes/AbaSuporte.tsx'
import { Topbar } from '../componentes/Topbar.tsx'
import { usePerfil } from '../dados/perfis.ts'
import { useSessao } from '../sessao.ts'
import styles from './Bases.module.css'

// O que Clientes e Processos têm em comum (GGVP-78, Figma 1927:605 e 1927:888): o topo da função, o título, os filtros em
// pílula, a busca com espera, as etiquetas e a página.

const NAVEGACAO = [
  { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' },
  { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
]

/** "+ Novo cliente" só no Atendimento (Figma). */
const DO_ATENDIMENTO = ['atendimento', 'atendimento_lider']

export function MolduraDaBase({ ativo, titulo, subtitulo, novoNaPagina = false, children }: { ativo: string; titulo: string; subtitulo: string; novoNaPagina?: boolean; children: ReactNode }) {
  const perfil = usePerfil()
  const atendimento = DO_ATENDIMENTO.includes(useSessao()?.perfilAtivo ?? '')
  return (
    <>
      <title>{`${titulo} · GGV Previdenciário`}</title>
      <Topbar itens={NAVEGACAO} ativo={ativo} funcao={perfil?.rotulo ?? ''} acao={atendimento ? { rotulo: '+ Novo cliente', href: '/clientes/novo' } : undefined} />
      <main className={styles.pagina}>
        <div className={styles.cabeca}>
          <div>
            <h1 className={styles.titulo}>{titulo}</h1>
            <p className={styles.subtitulo}>{subtitulo}</p>
          </div>
          {atendimento && novoNaPagina && (
            <a className={styles.novo} href="/clientes/novo">
              + Novo cliente
            </a>
          )}
        </div>
        {children}
      </main>
      <AbaSuporte />
    </>
  )
}

/** "Benefício: Todos ⌄": o select nativo dentro da pílula. A primeira opção é a que vale sem filtro. */
export function Filtro({ rotulo, valor, opcoes, aoMudar }: { rotulo: string; valor: string; opcoes: [string, string][]; aoMudar: (v: string) => void }) {
  return (
    <label className={styles.filtro}>
      {rotulo}:
      <select aria-label={rotulo} value={valor} onChange={(e) => aoMudar(e.target.value)}>
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
    </label>
  )
}

export function CampoDaBusca({ valor, aoMudar, rotulo }: { valor: string; aoMudar: (v: string) => void; rotulo: string }) {
  return (
    <div className={styles.busca}>
      <span className={styles.lupa} aria-hidden="true">
        ⌕
      </span>
      <input className={styles.entrada} type="search" aria-label={rotulo} placeholder={rotulo} value={valor} onChange={(e) => aoMudar(e.target.value)} />
    </div>
  )
}

export function Etiqueta({ tipo, children }: { tipo: string; children: ReactNode }) {
  return <span className={`${styles.tag} ${styles[tipo] ?? ''}`}>{children}</span>
}

export function Paginacao({ pagina, paginas, aoMudar }: { pagina: number; paginas: number; aoMudar: (p: number) => void }) {
  if (paginas <= 1) return null
  return (
    <nav className={styles.paginas} aria-label="Páginas">
      <button type="button" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
        ‹ Anterior
      </button>
      <span>
        Página {pagina} de {paginas}
      </span>
      <button type="button" disabled={pagina >= paginas} onClick={() => aoMudar(pagina + 1)}>
        Próxima ›
      </button>
    </nav>
  )
}
