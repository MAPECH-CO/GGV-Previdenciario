// Preferências de aparência da pessoa: tema (claro/escuro) e tamanho da fonte (padrão/grande).
// No Figma são os modos das coleções Tema e Acessibilidade. Aqui viram atributos no <html>,
// que ligam os blocos de tokens.css. Por enquanto ficam no navegador; no portal real vão para o perfil.
import { useSyncExternalStore } from 'react'

export type Tema = 'claro' | 'escuro'
export type TamanhoFonte = 'padrao' | 'grande'
export type Preferencias = { tema: Tema; fonte: TamanhoFonte }

const PADRAO: Preferencias = { tema: 'claro', fonte: 'padrao' }
const CHAVE = 'ggv.preferencias'

const ehTema = (v: unknown): v is Tema => v === 'claro' || v === 'escuro'
const ehFonte = (v: unknown): v is TamanhoFonte => v === 'padrao' || v === 'grande'

function lerSalvas(): Partial<Preferencias> {
  try {
    const bruto = window.localStorage.getItem(CHAVE)
    return bruto ? (JSON.parse(bruto) as Partial<Preferencias>) : {}
  } catch {
    return {} // armazenamento bloqueado ou conteúdo corrompido: segue com o padrão
  }
}

/** Ordem de prioridade: endereço (?tema=escuro&fonte=grande, útil para conferir telas) > salvas > padrão. */
export function lerPreferencias(busca: string = window.location.search): Preferencias {
  const url = new URLSearchParams(busca)
  const salvas = lerSalvas()
  const tema = [url.get('tema'), salvas.tema].find(ehTema) ?? PADRAO.tema
  const fonte = [url.get('fonte'), salvas.fonte].find(ehFonte) ?? PADRAO.fonte
  return { tema, fonte }
}

let atual: Preferencias = PADRAO
const ouvintes = new Set<() => void>()

function aplicar(p: Preferencias) {
  atual = p
  document.documentElement.dataset.tema = p.tema
  document.documentElement.dataset.fonte = p.fonte
  ouvintes.forEach((avisar) => avisar())
}

/** Chamar uma vez na partida, antes de desenhar a tela. */
export function iniciarPreferencias(busca?: string) {
  aplicar(lerPreferencias(busca))
}

export function mudarPreferencias(parcial: Partial<Preferencias>) {
  const proximas = { ...atual, ...parcial }
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
