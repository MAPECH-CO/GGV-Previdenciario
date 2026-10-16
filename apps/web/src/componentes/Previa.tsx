import { cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import styles from './Previa.module.css'

/** `direita`: o balão ao lado do gatilho, com a ponta apontando para ele (a linha da tarefa). */
type Lado = 'embaixo' | 'direita'
type Props = { rotulo: string; conteudo: () => ReactNode; children: ReactNode; lado?: Lado }
type Evento = SyntheticEvent<HTMLElement>
type Gancho = (e: Evento) => void
type Posicao = { top: number; left: number; seta: number | null; largura: number; altura: number }

const ATRASO_ABRIR = 400
/** Com outra prévia aberta, a pessoa está correndo a lista: a próxima abre quase na hora. */
const ATRASO_TROCAR = 80
const ATRASO_FECHAR = 150
const FOLGA = 8
/** Quanto a ponta do balão sai da caixa, a meia altura dela e o raio dos cantos (o --raio-12). */
const SETA = 8
const MEIA_SETA = 7
const RAIO = 12
const DISTANCIA = SETA + 6

/** A prévia aberta agora, para a próxima fechar esta: uma de cada vez. */
const emTela: { fechar: (() => void) | null } = { fechar: null }

/** Só aparelho com mouse abre a prévia: no toque, o toque já navega. */
export function temMouse(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

/** O tamanho do portal (preferencias.ts) é zoom no <html>: a tela mede em pixels da tela, e o cartão anda em pixels do portal. */
const zoomDaPagina = () => Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1
const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

/**
 * O contorno do balão de largura `w` e altura `h`, com a ponta na altura `y`. Começa na ponta, sobe pelo lado da ponta e dá
 * a volta (Pedro, 16/10): o traço se desenha nessa ordem. A caixa começa em x = SETA; antes dela, só a ponta.
 */
function contornoDoBalao(w: number, h: number, y: number): string {
  const x = SETA
  return [
    `M0 ${y}`,
    `L${x} ${y - MEIA_SETA}`,
    `L${x} ${RAIO}`,
    `Q${x} 0 ${x + RAIO} 0`,
    `L${x + w - RAIO} 0`,
    `Q${x + w} 0 ${x + w} ${RAIO}`,
    `L${x + w} ${h - RAIO}`,
    `Q${x + w} ${h} ${x + w - RAIO} ${h}`,
    `L${x + RAIO} ${h}`,
    `Q${x} ${h} ${x} ${h - RAIO}`,
    `L${x} ${y + MEIA_SETA}`,
    'Z',
  ].join(' ')
}

function encadear(meu: Gancho, doFilho: unknown): Gancho {
  return (e) => {
    meu(e)
    if (typeof doFilho === 'function') (doFilho as Gancho)(e)
  }
}

/** Um cartão que só informa, ao lado do gatilho: abre com o mouse parado ou com o foco pelo teclado; fecha com Esc. */
export function Previa({ rotulo, conteudo, children, lado = 'embaixo' }: Props) {
  const id = useId()
  const [aberta, setAberta] = useState(false)
  const [pos, setPos] = useState<Posicao>({ top: 0, left: 0, seta: null, largura: 0, altura: 0 })
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
    emTela.fechar?.()
    emTela.fechar = sair
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') sair()
    }
    document.addEventListener('keydown', tecla)
    window.addEventListener('scroll', sair, true)
    window.addEventListener('resize', sair)
    return () => {
      if (emTela.fechar === sair) emTela.fechar = null
      document.removeEventListener('keydown', tecla)
      window.removeEventListener('scroll', sair, true)
      window.removeEventListener('resize', sair)
    }
  }, [aberta])

  // Embaixo do gatilho, ou em cima quando embaixo não cabe; o balão, ao lado, centrado na linha. Refaz quando o cartão
  // muda de tamanho (o resumo e a ficha chegam).
  useLayoutEffect(() => {
    if (!aberta) return
    const posicionar = () => {
      const g = gatilho.current
      const c = cartao.current
      if (!g || !c) return
      const z = zoomDaPagina()
      const b = g.getBoundingClientRect()
      const r = { top: b.top / z, bottom: b.bottom / z, left: b.left / z, right: b.right / z }
      const vw = window.innerWidth / z
      const vh = window.innerHeight / z
      const largura = c.offsetWidth
      const altura = c.offsetHeight
      // O balão fica à direita da linha; sem espaço, encosta na borda da tela, por cima do fim da linha.
      if (lado === 'direita' && vw - largura - 2 * FOLGA >= 0) {
        const meio = (r.top + r.bottom) / 2
        const top = limitar(meio - altura / 2, FOLGA, vh - altura - FOLGA)
        const left = Math.min(r.right + DISTANCIA, vw - FOLGA - largura)
        setPos({ top, left, seta: limitar(meio - top, RAIO + MEIA_SETA, altura - RAIO - MEIA_SETA), largura, altura })
        return
      }
      const embaixo = r.bottom + FOLGA + altura <= vh || r.top - FOLGA - altura < 0
      const left = limitar(r.left, FOLGA, vw - largura - FOLGA)
      setPos({ top: embaixo ? r.bottom + FOLGA : r.top - FOLGA - altura, left, seta: null, largura, altura })
    }
    posicionar()
    if (!cartao.current || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(posicionar)
    observador.observe(cartao.current)
    return () => observador.disconnect()
  }, [aberta, lado])

  const aoEntrarNoMouse: Gancho = (e) => {
    if (!temMouse()) return
    gatilho.current = e.currentTarget
    depois(emTela.fechar ? ATRASO_TROCAR : ATRASO_ABRIR, () => setAberta(true))
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

  const balao = lado === 'direita' && pos.seta !== null
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
            className={balao ? `${styles.cartao} ${styles.balao}` : lado === 'direita' ? `${styles.cartao} ${styles.largo}` : styles.cartao}
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={cancelar}
            onMouseLeave={aoSairDoMouse}
          >
            {balao && (
              <svg className={styles.contorno} width={pos.largura + SETA} height={pos.altura} aria-hidden="true">
                <path d={contornoDoBalao(pos.largura, pos.altura, pos.seta!)} pathLength={1} />
              </svg>
            )}
            <strong className={styles.rotulo}>{rotulo}</strong>
            {conteudo()}
          </div>,
          document.body,
        )}
    </>
  )
}
