// Comandos da gestão até existir a tela de gestão (GGVP-117, respostas do PO de 01/10):
//   pnpm --filter @ggv/api usuario:criar <email> "<nome>" <perfil|sem-perfil>
//     Gera uma senha provisória, mostra uma vez para a gestão entregar em mãos; a pessoa troca no primeiro acesso.
//   pnpm --filter @ggv/api usuario:destravar <email> <quem-destravou>
//     Destrava na hora, sem esperar os 15 minutos, e registra no histórico.
// Usa o banco do DATABASE_URL; sem ele, o banco local.
import { randomBytes } from 'node:crypto'
import { validarEmail } from '@ggv/campos'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { abrirBanco, type Banco } from './conexao.ts'
import { eventoAuditoria, usuario } from './esquema.ts'

export async function criarUsuario(banco: Banco, email: string, nome: string, perfil: string | null) {
  if (!validarEmail(email)) throw new Error(`E-mail inválido: ${email}`)
  const senhaProvisoria = randomBytes(9).toString('base64url')
  const senhaHash = await bcrypt.hash(senhaProvisoria, 10)
  await banco.insert(usuario).values({ email: email.toLowerCase(), nome, perfil, senhaHash, trocarSenha: true })
  return senhaProvisoria
}

export async function destravarUsuario(banco: Banco, email: string, quem: string) {
  const [u] = await banco
    .update(usuario)
    .set({ tentativasErradas: 0, travadoAte: null })
    .where(eq(usuario.email, email.toLowerCase()))
    .returning({ id: usuario.id })
  if (!u) throw new Error(`Usuário não encontrado: ${email}`)
  await banco.insert(eventoAuditoria).values({ quem, acao: 'destravar', alvo: `usuario:${u.id}`, detalhe: {} })
}

const [comando, email, a, b] = process.argv.slice(2)
if (comando === 'criar' || comando === 'destravar') {
  const { banco, fechar } = await abrirBanco()
  try {
    if (comando === 'criar') {
      if (!email || !a || !b) throw new Error('Uso: usuario:criar <email> "<nome>" <perfil|sem-perfil>')
      const senha = await criarUsuario(banco, email, a, b === 'sem-perfil' ? null : b)
      console.log(`Usuário criado. Senha provisória (entregar em mãos; troca obrigatória no primeiro acesso): ${senha}`)
    } else {
      if (!email || !a) throw new Error('Uso: usuario:destravar <email> <quem-destravou>')
      await destravarUsuario(banco, email, a)
      console.log(`Conta destravada: ${email}`)
    }
  } catch (erro) {
    console.error((erro as Error).message)
    process.exitCode = 1
  } finally {
    await fechar()
  }
}
