// Perfis de exemplo do "Trocar perfil" do Figma (overlay 59:979), para ver cada tela como cada função.
// Só na tela: o login e as permissões de verdade são do Mateus. A escolha fica no navegador.
import { useSyncExternalStore } from 'react'

export type IdPerfil = 'atendimento' | 'atendimento-lider' | 'advogada' | 'senior' | 'financeiro' | 'documentacao'

export type Perfil = {
  id: IdPerfil
  /** O nome da função, como na barra do topo. */
  rotulo: string
  /** Pessoa de exemplo com essa função. */
  usuario: string
}

export const PERFIS: Perfil[] = [
  { id: 'atendimento', rotulo: 'Atendimento', usuario: 'Bruna (exemplo)' },
  { id: 'atendimento-lider', rotulo: 'Atendimento · líder', usuario: 'Carla (exemplo)' },
  { id: 'advogada', rotulo: 'Advogada', usuario: 'Dra. Paula (exemplo)' },
  { id: 'senior', rotulo: 'Sênior', usuario: 'Dra. Renata (exemplo)' },
  { id: 'financeiro', rotulo: 'Financeiro', usuario: 'Marcos (exemplo)' },
  { id: 'documentacao', rotulo: 'Documentação', usuario: 'Jéssica (exemplo)' },
]

const CHAVE = 'ggv.perfil'
const porId = (id: unknown) => PERFIS.find((p) => p.id === id)

/** Ordem de prioridade: endereço (?perfil=advogada, útil para conferir telas) > escolhido > nenhum. */
export function lerPerfil(busca: string = window.location.search): Perfil | undefined {
  let salvo: string | null = null
  try {
    salvo = window.localStorage.getItem(CHAVE)
  } catch {
    // armazenamento bloqueado: vale a função da tela
  }
  return porId(new URLSearchParams(busca).get('perfil')) ?? porId(salvo)
}

let atual = lerPerfil()
const ouvintes = new Set<() => void>()

/** Lê de novo o endereço e o navegador. A partida já lê sozinha; o teste usa para começar do zero. */
export function iniciarPerfil(busca?: string) {
  atual = lerPerfil(busca)
}

export function trocarPerfil(id: IdPerfil) {
  atual = porId(id)
  try {
    window.localStorage.setItem(CHAVE, id)
  } catch {
    // sem armazenamento: a escolha vale só nesta aba
  }
  ouvintes.forEach((avisar) => avisar())
}

/** O perfil escolhido; sem escolha, o da função da tela (`padrao`, o rótulo). */
export function usePerfil(padrao?: string): Perfil | undefined {
  const escolhido = useSyncExternalStore(
    (avisar) => {
      ouvintes.add(avisar)
      return () => ouvintes.delete(avisar)
    },
    () => atual,
  )
  return escolhido ?? PERFIS.find((p) => p.rotulo === padrao)
}
