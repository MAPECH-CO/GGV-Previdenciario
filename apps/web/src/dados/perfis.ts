// Quem está agindo nas telas da documentação médica: o perfil ativo e o nome da sessão (GGVP-96).
// Antes era o seletor de exemplo ("Trocar perfil"); ele saiu (um menu só, o "Entrar como…") e a assinatura de
// `usePerfil(padrao)` ficou, para as telas não mudarem uma por uma. Quem protege é o servidor; aqui a tela só esconde.
import { useMemo } from 'react'
import { ROTULO_PERFIL, ehPerfil } from '@ggv/contratos'
import { useSessao } from '../sessao.ts'

export type IdPerfil = 'atendimento' | 'atendimento-lider' | 'documentacao' | 'advogada' | 'senior' | 'juridico-adm' | 'financeiro' | 'socio'

export type Perfil = {
  id: IdPerfil
  /** O nome da função, como na barra do topo. */
  rotulo: string
  /** Quem está agindo: o nome da sessão. */
  usuario: string
  /** A tela inicial: com sessão, sempre "/", e o App abre a Central do perfil ativo. */
  inicio: string
}

/** Sem sessão (testes de uma tela sozinha), a tela fica como foi desenhada: a função do `padrao`. */
const PADRAO: Record<string, Perfil> = {
  Atendimento: { id: 'atendimento', rotulo: 'Atendimento', usuario: 'Ana (exemplo)', inicio: '/' },
  Documentação: { id: 'documentacao', rotulo: 'Documentação', usuario: 'Jéssica (exemplo)', inicio: '/' },
  Advogada: { id: 'advogada', rotulo: 'Advogada', usuario: 'Dra. Paula (exemplo)', inicio: '/advogada' },
  Sênior: { id: 'senior', rotulo: 'Sênior', usuario: 'Dra. Renata (exemplo)', inicio: '/' },
  // Quem cuida da perícia desde 29/09 (Lucas): o nome é o do usuário de exemplo do servidor (juridico_adm).
  'Jurídico administrativo': { id: 'juridico-adm', rotulo: 'Jurídico administrativo', usuario: 'Igor (exemplo)', inicio: '/' },
}

/**
 * O perfil da sessão; sem sessão, o da função da tela (`padrao`, o rótulo). O mesmo objeto enquanto a sessão não muda:
 * telas que põem o perfil num efeito (`useEffect(..., [perfil])`) não entram em laço.
 */
export function usePerfil(padrao?: string): Perfil | undefined {
  const sessao = useSessao()
  const temSessao = sessao !== null
  const ativo = sessao?.perfilAtivo
  const nome = sessao?.nome
  return useMemo(() => {
    if (!temSessao) return padrao ? PADRAO[padrao] : undefined
    if (!ehPerfil(ativo)) return undefined
    return { id: ativo.replace('_', '-') as IdPerfil, rotulo: ROTULO_PERFIL[ativo], usuario: nome ?? '', inicio: '/' }
  }, [temSessao, ativo, nome, padrao])
}
