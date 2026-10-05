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
  /** A tela inicial da função. Sem a Central dela, o caminho cai em "Esta tela ainda não foi construída". */
  inicio: string
  /** A ação principal da barra do topo, como na Central da função no Figma. */
  acao?: { rotulo: string; href: string }
}

const novoCliente = { rotulo: '+ Novo cliente', href: '/clientes/novo' }

export const PERFIS: Perfil[] = [
  { id: 'atendimento', rotulo: 'Atendimento', usuario: 'Bruna (exemplo)', inicio: '/', acao: novoCliente },
  { id: 'atendimento-lider', rotulo: 'Atendimento · líder', usuario: 'Carla (exemplo)', inicio: '/atendimento-lider', acao: novoCliente },
  // A Central da Advogada (/advogada) vem com a branch das telas; até as duas se juntarem, cai em "não construída".
  { id: 'advogada', rotulo: 'Advogada', usuario: 'Dra. Paula (exemplo)', inicio: '/advogada' },
  { id: 'senior', rotulo: 'Sênior', usuario: 'Dra. Renata (exemplo)', inicio: '/senior' },
  { id: 'financeiro', rotulo: 'Financeiro', usuario: 'Marcos (exemplo)', inicio: '/financeiro' },
  // Sem Central própria no Figma: a Documentação trabalha na Central do Atendimento.
  { id: 'documentacao', rotulo: 'Documentação', usuario: 'Jéssica (exemplo)', inicio: '/', acao: novoCliente },
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

/** Só o perfil que a pessoa escolheu; sem escolha, nada, e a tela fica como foi desenhada. */
export function usePerfilEscolhido(): Perfil | undefined {
  return useSyncExternalStore(
    (avisar) => {
      ouvintes.add(avisar)
      return () => ouvintes.delete(avisar)
    },
    () => atual,
  )
}

/** O perfil escolhido; sem escolha, o da função da tela (`padrao`, o rótulo). */
export function usePerfil(padrao?: string): Perfil | undefined {
  return usePerfilEscolhido() ?? PERFIS.find((p) => p.rotulo === padrao)
}
