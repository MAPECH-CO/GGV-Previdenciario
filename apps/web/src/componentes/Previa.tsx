import { cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import styles from './Previa.module.css'

type Props = { rotulo: string; conteudo: () => ReactNode; children: ReactNode }
type Evento = SyntheticEvent<HTMLElement>
type Gancho = (e: Evento) => void

const ATRASO_ABRIR = 400
const ATRASO_FECHAR = 150
const LARGURA = 300
const FOLGA = 8

/** Só aparelho com mouse abre a prévia: no toque, o toque já navega. */
export function temMouse(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function encadear(meu: Gancho, doFilho: unknown): Gancho {
  return (e) => {
    meu(e)
    if (typeof doFilho === 'function') (doFilho as Gancho)(e)
  }
}

/** Um cartão que só informa, ao lado do gatilho: abre com o mouse parado ou com o foco pelo teclado; fecha com Esc. */
export function Previa({ rotulo, conteudo, children }: Props) {
  const id = useId()
  const [aberta, setAberta] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const gatilho = useRef<HTMLElement | null>(null)
  const cartao = useRef<HTMLDivElement | null>(null)
  const relogio = useRef<number | undefined>(undefined)
  // O foco que vem do clique não abre a prévia (o clique já vai navegar); o do teclado abre.
  const doClique = useRef(false)

  const cancelar = () => window.clearTimeout(relogio.current)
  const depois = (ms: number, acao: () => void) => {
    cancelar()
    relogio.current = window.setTimeout(acao, ms)
  }

  useEffect(() => () => window.clearTimeout(relogio.current), [])

  useEffect(() => {
    if (!aberta) return
    const sair = () => {
      cancelar()
      setAberta(false)
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') sair()
    }
    document.addEventListener('keydown', tecla)
    window.addEventListener('scroll', sair, true)
    window.addEventListener('resize', sair)
    return () => {
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('scroll', sair, true)
      window.removeEventListener('resize', sair)
    }
  }, [aberta])

  // Embaixo do gatilho; em cima quando embaixo não cabe. Refaz quando o cartão muda de tamanho (a ficha chega).
  useLayoutEffect(() => {
    if (!aberta) return
    const posicionar = () => {
      const g = gatilho.current
      const c = cartao.current
      if (!g || !c) return
      const r = g.getBoundingClientRect()
      const altura = c.offsetHeight
      const embaixo = r.bottom + FOLGA + altura <= window.innerHeight || r.top - FOLGA - altura < 0
      const left = Math.min(Math.max(r.left, FOLGA), window.innerWidth - LARGURA - FOLGA)
      setPos({ top: embaixo ? r.bottom + FOLGA : r.top - FOLGA - altura, left })
    }
    posicionar()
    if (!cartao.current || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(posicionar)
    observador.observe(cartao.current)
    return () => observador.disconnect()
  }, [aberta])

  const aoEntrarNoMouse: Gancho = (e) => {
    if (!temMouse()) return
    gatilho.current = e.currentTarget
    depois(ATRASO_ABRIR, () => setAberta(true))
  }
  const aoSairDoMouse = () => depois(ATRASO_FECHAR, () => setAberta(false))
  const aoApertar: Gancho = () => {
    doClique.current = true
  }
  const aoFocar: Gancho = (e) => {
    if (!temMouse() || doClique.current) return
    gatilho.current = e.currentTarget
    cancelar()
    setAberta(true)
  }
  const aoPerderFoco = () => {
    doClique.current = false
    cancelar()
    setAberta(false)
  }

  const props: Record<string, unknown> = isValidElement<Record<string, unknown>>(children) ? children.props : {}
  const descrito = aberta ? id : undefined
  const gatilhoFinal = isValidElement<Record<string, unknown>>(children) ? (
    cloneElement(children as ReactElement<Record<string, unknown>>, {
      onMouseEnter: encadear(aoEntrarNoMouse, props.onMouseEnter),
      onMouseLeave: encadear(aoSairDoMouse, props.onMouseLeave),
      onPointerDown: encadear(aoApertar, props.onPointerDown),
      onFocus: encadear(aoFocar, props.onFocus),
      onBlur: encadear(aoPerderFoco, props.onBlur),
      'aria-describedby': descrito,
    })
  ) : (
    <span onMouseEnter={aoEntrarNoMouse} onMouseLeave={aoSairDoMouse} onPointerDown={aoApertar} onFocus={aoFocar} onBlur={aoPerderFoco} aria-describedby={descrito}>
      {children}
    </span>
  )

  return (
    <>
      {gatilhoFinal}
      {aberta &&
        createPortal(
          <div
            ref={cartao}
            id={id}
            role="tooltip"
            aria-label={rotulo}
            className={styles.cartao}
            style={pos}
            onMouseEnter={cancelar}
            onMouseLeave={aoSairDoMouse}
          >
            <strong className={styles.rotulo}>{rotulo}</strong>
            {conteudo()}
          </div>,
          document.body,
        )}
    </>
  )
}
