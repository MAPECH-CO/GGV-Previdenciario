// Preferências de aparência da pessoa: tema (claro/escuro) e tamanho do portal (escala em %).
// O tema liga os blocos de tokens.css pelo atributo no <html>. O tamanho, desde 11/10, é livre: a escala vai de 70% a
// 200% e o portal inteiro acompanha (texto, espaços e ícones), pelo `zoom` no <html>. Antes eram só "padrão" e
// "grande" (+25%, a coleção Acessibilidade do Figma); quem tinha "grande" salvo entra com 125%.
// Por enquanto ficam no navegador; no portal real vão para o perfil.
import { useSyncExternalStore } from 'react'

export type Tema = 'claro' | 'escuro'
export type Preferencias = { tema: Tema; escala: number }

export const ESCALA = { minima: 70, maxima: 200, passo: 10, padrao: 100 } as const
const GRANDE = 125

const PADRAO: Preferencias = { tema: 'claro', escala: ESCALA.padrao }
const CHAVE = 'ggv.preferencias'

const ehTema = (v: unknown): v is Tema => v === 'claro' || v === 'escuro'

/** Um número dentro da faixa (a régua de 10 em 10 fica com os botões; o endereço pode pedir qualquer valor). */
function escalaValida(v: unknown): number | undefined {
  if (v === 'grande') return GRANDE
  if (v === 'padrao') return ESCALA.padrao
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) && n >= ESCALA.minima && n <= ESCALA.maxima ? Math.round(n) : undefined
}

function lerSalvas(): Record<string, unknown> {
  try {
    const bruto = window.localStorage.getItem(CHAVE)
    return bruto ? (JSON.parse(bruto) as Record<string, unknown>) : {}
  } catch {
    return {} // armazenamento bloqueado ou conteúdo corrompido: segue com o padrão
  }
}

/** Ordem de prioridade: endereço (?tema=escuro&escala=130, útil para conferir telas) > salvas > padrão. */
export function lerPreferencias(busca: string = window.location.search): Preferencias {
  const url = new URLSearchParams(busca)
  const salvas = lerSalvas()
  const tema = [url.get('tema'), salvas.tema].find(ehTema) ?? PADRAO.tema
  const escala = [url.get('escala'), url.get('fonte'), salvas.escala, salvas.fonte].map(escalaValida).find((e) => e !== undefined) ?? PADRAO.escala
  return { tema, escala }
}

let atual: Preferencias = PADRAO
const ouvintes = new Set<() => void>()

function aplicar(p: Preferencias) {
  atual = p
  const html = document.documentElement
  html.dataset.tema = p.tema
  // O zoom aumenta tudo junto; --zoom deixa os 100vw e 100vh das janelas do tamanho da tela (base.css).
  html.style.zoom = p.escala === ESCALA.padrao ? '' : String(p.escala / 100)
  html.style.setProperty('--zoom', String(p.escala / 100))
  ouvintes.forEach((avisar) => avisar())
}

/** Chamar uma vez na partida, antes de desenhar a tela. */
export function iniciarPreferencias(busca?: string) {
  aplicar(lerPreferencias(busca))
}

export function mudarPreferencias(parcial: Partial<Preferencias>) {
  const escala = parcial.escala === undefined ? atual.escala : Math.min(ESCALA.maxima, Math.max(ESCALA.minima, Math.round(parcial.escala)))
  const proximas = { ...atual, ...parcial, escala }
  aplicar(proximas)
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(proximas))
  } catch {
    // sem armazenamento: a escolha vale só nesta aba
  }
}

export function usePreferencias(): Preferencias {
  return useSyncExternalStore(
    (avisar) => {
      ouvintes.add(avisar)
      return () => ouvintes.delete(avisar)
    },
    () => atual,
  )
}
