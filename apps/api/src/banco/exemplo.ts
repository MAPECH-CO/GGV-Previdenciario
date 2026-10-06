// DADOS DE EXEMPLO, só para o banco local da máquina do dev. Nenhuma pessoa é real.
// Senha de todos: SENHA_DE_EXEMPLO. Nunca rodar contra homologação nem produção.
import bcrypt from 'bcryptjs'
import { count } from 'drizzle-orm'
import type { Banco } from './conexao.ts'
import { usuario } from './esquema.ts'

export const SENHA_DE_EXEMPLO = 'exemplo-ggv-2026'

export const usuariosDeExemplo = [
  { email: 'atendimento@exemplo.ggv', nome: 'Ana (exemplo)', perfil: 'atendimento', trocarSenha: false },
  { email: 'provisoria@exemplo.ggv', nome: 'Bia (exemplo, senha provisória)', perfil: 'atendimento', trocarSenha: true },
  { email: 'semperfil@exemplo.ggv', nome: 'Caio (exemplo, sem perfil)', perfil: null, trocarSenha: false },
  { email: 'trava@exemplo.ggv', nome: 'Davi (exemplo, para testar a trava)', perfil: 'atendimento', trocarSenha: false },
]

/** Só semeia banco vazio: não mexe em quem já existe. */
export async function semearExemplos(banco: Banco) {
  const [{ total }] = await banco.select({ total: count() }).from(usuario)
  if (total > 0) return
  const senhaHash = await bcrypt.hash(SENHA_DE_EXEMPLO, 10)
  await banco.insert(usuario).values(usuariosDeExemplo.map((u) => ({ ...u, senhaHash })))
}
