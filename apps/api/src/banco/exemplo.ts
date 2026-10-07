// DADOS DE EXEMPLO, só para o banco local da máquina do dev. Nenhuma pessoa é real.
// Senha de todos: SENHA_DE_EXEMPLO. Nunca rodar contra homologação nem produção.
import bcrypt from 'bcryptjs'
import { count, eq } from 'drizzle-orm'
import type { Banco } from './conexao.ts'
import { usuario } from './esquema.ts'

export const SENHA_DE_EXEMPLO = 'exemplo-ggv-2026'

export const usuariosDeExemplo = [
  { email: 'atendimento@exemplo.ggv', nome: 'Ana (exemplo)', perfis: ['atendimento'], trocarSenha: false },
  { email: 'provisoria@exemplo.ggv', nome: 'Bia (exemplo, senha provisória)', perfis: ['atendimento'], trocarSenha: true },
  { email: 'semperfil@exemplo.ggv', nome: 'Caio (exemplo, sem perfil)', perfis: [], trocarSenha: false },
  { email: 'trava@exemplo.ggv', nome: 'Davi (exemplo, para testar a trava)', perfis: ['atendimento'], trocarSenha: false },
  { email: 'lider@exemplo.ggv', nome: 'Eva (exemplo, líder e atendimento)', perfis: ['atendimento_lider', 'atendimento'], trocarSenha: false },
  { email: 'documentacao@exemplo.ggv', nome: 'Fábio (exemplo)', perfis: ['documentacao'], trocarSenha: false },
  { email: 'advogada@exemplo.ggv', nome: 'Gabi (exemplo)', perfis: ['advogada'], trocarSenha: false },
  { email: 'senior@exemplo.ggv', nome: 'Helena (exemplo)', perfis: ['senior'], trocarSenha: false },
  { email: 'juridico@exemplo.ggv', nome: 'Igor (exemplo)', perfis: ['juridico_adm'], trocarSenha: false },
  { email: 'financeiro@exemplo.ggv', nome: 'Júlia (exemplo)', perfis: ['financeiro'], trocarSenha: false },
  { email: 'socio@exemplo.ggv', nome: 'Lauro (exemplo)', perfis: ['socio'], trocarSenha: false },
]

/** Só semeia banco vazio: não mexe em quem já existe. */
export async function semearExemplos(banco: Banco) {
  // GGVP-126 CA4: "vazio" é sem os usuários de exemplo; a homologação já tem o usuário de quem cuida dela.
  const [{ total }] = await banco.select({ total: count() }).from(usuario).where(eq(usuario.email, usuariosDeExemplo[0].email))
  if (total > 0) return
  const senhaHash = await bcrypt.hash(SENHA_DE_EXEMPLO, 10)
  await banco.insert(usuario).values(usuariosDeExemplo.map((u) => ({ ...u, senhaHash })))
}
