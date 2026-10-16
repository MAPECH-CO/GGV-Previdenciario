import { cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import styles from './Previa.module.css'

/**
 * `balao`: o balão do "i" da tarefa (Pedro, 16/10). Abre embaixo do gatilho, com a ponta apontando para ele, e em cima
 * só quando embaixo não cabe; abre também no clique, para o toque, que não tem mouse.
 */
type Props = { rotulo: string; conteudo: () => ReactNode; children: ReactNode; balao?: boolean }
type Evento = SyntheticEvent<HTMLElement>
type Gancho = (e: Evento) => void
type Posicao = { top: number; left: number; seta: number | null; acima: boolean; largura: number; altura: number }

const ATRASO_ABRIR = 400
/** O "i" a pessoa procura de propósito: abre logo. */
const ATRASO_DO_BALAO = 150
/** Com outra prévia aberta, a pessoa está correndo a lista: a próxima abre quase na hora. */
const ATRASO_TROCAR = 80
const ATRASO_FECHAR = 150
const FOLGA = 8
/** Quanto a ponta do balão sai da caixa, a meia largura dela e o raio dos cantos (o --raio-12). */
const SETA = 8
const MEIA_SETA = 7
const RAIO = 12
const DISTANCIA = SETA + 4
/** A ponta fica perto do canto direito do balão: o "i" está no fim da linha, e o balão abre para a esquerda dele. */
const PONTA_DO_CANTO = 28

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
 * O contorno do balão de largura `w` e altura `h`, com a ponta em cima, na posição `x`. Começa na ponta, desce para a
 * caixa e dá a volta (Pedro, 16/10): o traço se desenha nessa ordem. A caixa começa em y = SETA; acima dela, só a ponta.
 * Aberto em cima do gatilho, o desenho vira de cabeça para baixo (CSS), e a ponta fica embaixo.
 */
function contornoDoBalao(w: number, h: number, x: number): string {
  const y = SETA
  return [
    `M${x} 0`,
    `L${x - MEIA_SETA} ${y}`,
    `L${RAIO} ${y}`,
    `Q0 ${y} 0 ${y + RAIO}`,
    `L0 ${y + h - RAIO}`,
    `Q0 ${y + h} ${RAIO} ${y + h}`,
    `L${w - RAIO} ${y + h}`,
    `Q${w} ${y + h} ${w} ${y + h - RAIO}`,
    `L${w} ${y + RAIO}`,
    `Q${w} ${y} ${w - RAIO} ${y}`,
    `L${x + MEIA_SETA} ${y}`,
    'Z',
  ].join(' ')
}

function encadear(meu: Gancho, doFilho: unknown): Gancho {
  return (e) => {
    meu(e)
    if (typeof doFilho === 'function') (doFilho as Gancho)(e)
  }
}

/** Um cartão que só informa, junto do gatilho: abre com o mouse parado ou com o foco pelo teclado; fecha com Esc. */
export function Previa({ rotulo, conteudo, children, balao = false }: Props) {
  const id = useId()
  const [aberta, setAberta] = useState(false)
  const [pos, setPos] = useState<Posicao>({ top: 0, left: 0, seta: null, acima: false, largura: 0, altura: 0 })
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
    // No toque não há "tirar o mouse": tocar fora fecha.
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node
      if (!cartao.current?.contains(alvo) && !gatilho.current?.contains(alvo)) sair()
    }
    document.addEventListener('keydown', tecla)
    document.addEventListener('pointerdown', fora)
    window.addEventListener('scroll', sair, true)
    window.addEventListener('resize', sair)
    return () => {
      if (emTela.fechar === sair) emTela.fechar = null
      document.removeEventListener('keydown', tecla)
      document.removeEventListener('pointerdown', fora)
      window.removeEventListener('scroll', sair, true)
      window.removeEventListener('resize', sair)
    }
  }, [aberta])

  // Embaixo do gatilho, ou em cima quando embaixo não cabe. Refaz quando o cartão muda de tamanho (o resumo e a ficha chegam).
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
      const distancia = balao ? DISTANCIA : FOLGA
      const acima = r.bottom + distancia + altura > vh - FOLGA && r.top - distancia - altura >= FOLGA
      const top = acima ? r.top - distancia - altura : r.bottom + distancia
      if (!balao) return setPos({ top, left: limitar(r.left, FOLGA, vw - largura - FOLGA), seta: null, acima, largura, altura })
      const meio = (r.left + r.right) / 2
      const left = limitar(meio - largura + PONTA_DO_CANTO, FOLGA, vw - largura - FOLGA)
      setPos({ top, left, seta: limitar(meio - left, RAIO + MEIA_SETA, largura - RAIO - MEIA_SETA), acima, largura, altura })
    }
    posicionar()
    if (!cartao.current || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(posicionar)
    observador.observe(cartao.current)
    return () => observador.disconnect()
  }, [aberta, balao])

  const aoEntrarNoMouse: Gancho = (e) => {
    if (!temMouse()) return
    gatilho.current = e.currentTarget
    depois(emTela.fechar ? ATRASO_TROCAR : balao ? ATRASO_DO_BALAO : ATRASO_ABRIR, () => setAberta(true))
  }
  const aoSairDoMouse = () => depois(ATRASO_FECHAR, () => setAberta(false))
  const aoApertar: Gancho = () => {
    doClique.current = true
  }
  const aoClicar: Gancho = (e) => {
    if (!balao) return
    gatilho.current = e.currentTarget
    cancelar()
    setAberta(true)
  }
  const aoFocar: Gancho = (e) => {
    if (!temMouse() || doClique.current) return
    gatilho.current = e.currentTarget
    cancelar()
    setAberta(true)
  }
  const aoPerderFoco = () => {
    doClique.current = false
    // O balão aberto pelo toque fica até tocar fora; o resto fecha ao perder o foco.
    if (balao && !temMouse()) return
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
      onClick: encadear(aoClicar, props.onClick),
      onFocus: encadear(aoFocar, props.onFocus),
      onBlur: encadear(aoPerderFoco, props.onBlur),
      'aria-describedby': descrito,
    })
  ) : (
    <span onMouseEnter={aoEntrarNoMouse} onMouseLeave={aoSairDoMouse} onPointerDown={aoApertar} onFocus={aoFocar} onBlur={aoPerderFoco} aria-describedby={descrito}>
      {children}
    </span>
  )

  const comPonta = balao && pos.seta !== null
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
            className={comPonta ? `${styles.cartao} ${styles.balao}` : balao ? `${styles.cartao} ${styles.largo}` : styles.cartao}
            data-acima={comPonta && pos.acima ? '' : undefined}
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={cancelar}
            onMouseLeave={aoSairDoMouse}
          >
            {comPonta && (
              <svg className={styles.contorno} width={pos.largura} height={pos.altura + SETA} aria-hidden="true">
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
