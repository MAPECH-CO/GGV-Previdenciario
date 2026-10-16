// Quem está na sessão, para qualquer tela saber o perfil ativo sem buscar de novo (GGVP-96).
import { createContext, useContext } from 'react'
import { pode, type Acao, type UsuarioDaSessao } from '@ggv/contratos'
import { chamarApi } from './api.ts'
import { limparCopiaDaSessao } from './dados/copiaDaSessao.ts'
import { podeAbrir } from './regras/acesso.ts'

export const SessaoContexto = createContext<UsuarioDaSessao | null>(null)

export function useSessao() {
  return useContext(SessaoContexto)
}

/** A tela esconde o que o perfil ativo não pode (CA9). Quem protege é o servidor. */
export function usePode(acao: Acao) {
  return pode(useSessao()?.perfilAtivo, acao)
}

/** O link para o endereço só aparece se o perfil abre a tela dele: nada de caminho que acaba em "Sem permissão". */
export function usePodeAbrir(href: string) {
  return podeAbrir(useSessao()?.perfilAtivo, href)
}

/**
 * "Entrar como…" (CA10): o servidor só aceita perfil atribuído. Na troca confirmada, apaga a cópia do perfil anterior
 * antes de navegar; a nova página sincroniza somente o que o novo perfil pode receber.
 */
export async function trocarPerfil(perfil: string) {
  const r = await chamarApi<UsuarioDaSessao>('/sessao/perfil', { method: 'POST', corpo: { perfil } })
  if (r.ok) {
    limparCopiaDaSessao()
    window.location.assign('/')
  }
  return r
}
