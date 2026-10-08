// Quem está na sessão, para qualquer tela saber o perfil ativo sem buscar de novo (GGVP-96).
import { createContext, useContext } from 'react'
import { pode, type Acao, type UsuarioDaSessao } from '@ggv/contratos'
import { chamarApi } from './api.ts'

export const SessaoContexto = createContext<UsuarioDaSessao | null>(null)

export function useSessao() {
  return useContext(SessaoContexto)
}

/** A tela esconde o que o perfil ativo não pode (CA9). Quem protege é o servidor. */
export function usePode(acao: Acao) {
  return pode(useSessao()?.perfilAtivo, acao)
}

/** "Entrar como…" (CA10): o servidor só aceita perfil atribuído; a tela volta ao início do novo perfil. */
export async function trocarPerfil(perfil: string) {
  const r = await chamarApi<UsuarioDaSessao>('/sessao/perfil', { method: 'POST', corpo: { perfil } })
  if (r.ok) window.location.assign('/')
  return r
}
