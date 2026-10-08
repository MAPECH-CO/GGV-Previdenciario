// Comandos da gestão até existir a tela de gestão (GGVP-117 e GGVP-96):
//   pnpm --filter @ggv/api usuario:criar <email> "<nome>" <perfil,perfil|sem-perfil>
//     Gera uma senha provisória, mostra uma vez para a gestão entregar em mãos; a pessoa troca no primeiro acesso.
//   pnpm --filter @ggv/api usuario:perfis <email> <perfil,perfil|sem-perfil> <email-de-quem-atribui>
//     Só um Sócio atribui perfis; a mudança vai para o histórico com o antes e o depois (GGVP-96 CA3).
//   pnpm --filter @ggv/api usuario:destravar <email> <quem-destravou>
//     Destrava na hora, sem esperar os 15 minutos, e registra no histórico.
// Usa o banco do DATABASE_URL; sem ele, o banco local.
import { randomBytes } from 'node:crypto'
import { validarEmail } from '@ggv/campos'
import { ehPerfil, pode } from '@ggv/contratos'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { abrirBanco, type Banco } from './conexao.ts'
import { eventoAuditoria, usuario } from './esquema.ts'

function lerPerfis(texto: string): string[] {
  if (texto === 'sem-perfil') return []
  const perfis = texto.split(',').map((p) => p.trim())
  const invalidos = perfis.filter((p) => !ehPerfil(p))
  if (invalidos.length) throw new Error(`Perfil que não existe: ${invalidos.join(', ')}`)
  return perfis
}

export async function criarUsuario(banco: Banco, email: string, nome: string, perfis: string[]) {
  if (!validarEmail(email)) throw new Error(`E-mail inválido: ${email}`)
  lerPerfis(perfis.join(',') || 'sem-perfil')
  const senhaProvisoria = randomBytes(9).toString('base64url')
  const senhaHash = await bcrypt.hash(senhaProvisoria, 10)
  await banco.insert(usuario).values({ email: email.toLowerCase(), nome, perfis, senhaHash, trocarSenha: true })
  return senhaProvisoria
}

export async function definirPerfis(banco: Banco, email: string, perfis: string[], porEmail: string) {
  const [por] = await banco.select().from(usuario).where(eq(usuario.email, porEmail.toLowerCase()))
  if (!por || !por.perfis.some((p) => pode(p, 'perfis.atribuir'))) throw new Error('Só um Sócio atribui perfis.')
  lerPerfis(perfis.join(',') || 'sem-perfil')
  const [antes] = await banco.select().from(usuario).where(eq(usuario.email, email.toLowerCase()))
  if (!antes) throw new Error(`Usuário não encontrado: ${email}`)
  await banco.update(usuario).set({ perfis }).where(eq(usuario.id, antes.id))
  await banco
    .insert(eventoAuditoria)
    .values({ quem: por.id, acao: 'perfis_alterados', alvo: `usuario:${antes.id}`, detalhe: { antes: antes.perfis, depois: perfis } })
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
if (comando === 'criar' || comando === 'perfis' || comando === 'destravar') {
  const { banco, fechar } = await abrirBanco()
  try {
    if (comando === 'criar') {
      if (!email || !a || !b) throw new Error('Uso: usuario:criar <email> "<nome>" <perfil,perfil|sem-perfil>')
      const senha = await criarUsuario(banco, email, a, lerPerfis(b))
      console.log(`Usuário criado. Senha provisória (entregar em mãos; troca obrigatória no primeiro acesso): ${senha}`)
    } else if (comando === 'perfis') {
      if (!email || !a || !b) throw new Error('Uso: usuario:perfis <email> <perfil,perfil|sem-perfil> <email-de-quem-atribui>')
      await definirPerfis(banco, email, lerPerfis(a), b)
      console.log(`Perfis de ${email}: ${a}`)
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
