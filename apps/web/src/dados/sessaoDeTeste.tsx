// Só para os testes de unidade: a tela renderiza com a sessão de uma pessoa de exemplo, no lugar do antigo
// `?perfil=` do seletor de exemplo. Os nomes são os que os testes das telas já esperavam.
import type { ReactElement } from 'react'
import type { UsuarioDaSessao } from '@ggv/contratos'
import { SessaoContexto } from '../sessao.ts'

const NOMES: Record<string, string> = {
  atendimento: 'Bruna (exemplo)',
  documentacao: 'Jéssica (exemplo)',
  advogada: 'Dra. Paula (exemplo)',
  senior: 'Dra. Renata (exemplo)',
  // A segunda sênior: a dispensa do parecer pede duas sêniores diferentes (GGVP-33, Q14).
  'senior-2': 'Dr. Otávio (exemplo)',
  juridico_adm: 'Igor (exemplo)',
}

let perfilDoTeste: string | undefined

/** Escolhe quem está logado nos próximos `render(comSessao(...))`; sem perfil, nenhuma sessão. */
export function entrarComo(perfil?: string) {
  perfilDoTeste = perfil
}

export function usuarioDeTeste(perfil: string): UsuarioDaSessao {
  const ativo = perfil === 'senior-2' ? 'senior' : perfil
  return { nome: NOMES[perfil] ?? perfil, email: `${perfil}@exemplo.ggv`, perfis: [ativo], perfilAtivo: ativo, trocarSenha: false }
}

export function comSessao(ui: ReactElement) {
  return perfilDoTeste ? <SessaoContexto value={usuarioDeTeste(perfilDoTeste)}>{ui}</SessaoContexto> : ui
}
