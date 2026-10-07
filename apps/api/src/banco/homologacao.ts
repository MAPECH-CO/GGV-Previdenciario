// Homologação com usuários e dados de teste (GGVP-126), no terminal do app de homologação no Coolify:
//   pnpm --filter @ggv/api homologacao:preparar
// Roda a mesma semente dos testes no banco do DATABASE_URL, uma vez só, e dá a cada usuário de exemplo uma senha
// provisória aleatória, com troca no primeiro acesso. A lista aparece uma vez, para quem rodou, e é entregue ao Lucas
// fora do repositório, do Jira e do chat. Só roda com AMBIENTE=homologacao; fora dela, recusa sem gravar nada (CA5).
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { eq, inArray } from 'drizzle-orm'
import { abrirBanco, type Banco } from './conexao.ts'
import { configuracao, usuario } from './esquema.ts'
import { semearExemplos, usuariosDeExemplo } from './exemplo.ts'
import { LIMITES_PADRAO } from '../fluxo/exigencia.ts'

/** CA2: os limites de cobrança do Lucas (05/10 e 07/10), os mesmos que o servidor usa sem configuração (G15). */
const LIMITES_DO_LUCAS = [
  { chave: 'cobranca.limite', valor: LIMITES_PADRAO.limite },
  { chave: 'cobranca.intervalo_dias', valor: LIMITES_PADRAO.intervaloDias },
]

export type Credencial = { nome: string; email: string; perfis: string[]; senha: string }

/** Prepara a homologação e devolve as senhas provisórias criadas agora; já preparada, devolve lista vazia (CA4). */
export async function prepararHomologacao(banco: Banco, ambiente: Record<string, string | undefined> = process.env): Promise<Credencial[]> {
  if (ambiente.AMBIENTE !== 'homologacao') throw new Error('Recusado: os dados de teste só entram com AMBIENTE=homologacao, nunca em produção.')
  // Semente e senhas na mesma transação: a senha pública dos exemplos nunca chega a valer na homologação (CA1).
  return banco.transaction(async (tx) => {
    const emails = usuariosDeExemplo.map((u) => u.email)
    const [jaPreparada] = await tx.select({ id: usuario.id }).from(usuario).where(inArray(usuario.email, emails)).limit(1)
    if (!jaPreparada) {
      // A semente grava a configuração de exemplo; o que o escritório já tinha configurado volta por cima dela (CA2).
      const configurado = await tx.select().from(configuracao)
      await tx.delete(configuracao)
      await semearExemplos(tx)
      for (const c of configurado)
        await tx.insert(configuracao).values(c).onConflictDoUpdate({ target: configuracao.chave, set: { valor: c.valor, alteradoPor: c.alteradoPor, atualizadoEm: c.atualizadoEm } })
    }
    await tx.insert(configuracao).values(LIMITES_DO_LUCAS).onConflictDoNothing()
    if (jaPreparada) return []
    const credenciais: Credencial[] = []
    for (const u of usuariosDeExemplo) {
      const senha = randomBytes(9).toString('base64url')
      await tx
        .update(usuario)
        .set({ senhaHash: await bcrypt.hash(senha, 10), trocarSenha: true })
        .where(eq(usuario.email, u.email))
      credenciais.push({ nome: u.nome, email: u.email, perfis: [...u.perfis], senha })
    }
    return credenciais
  })
}

if (process.argv[2] === 'preparar') {
  try {
    if (!process.env.DATABASE_URL) throw new Error('Sem DATABASE_URL: o comando roda no app de homologação, com o banco dele.')
    const { banco, fechar } = await abrirBanco()
    try {
      const credenciais = await prepararHomologacao(banco)
      if (credenciais.length === 0) console.log('Homologação já preparada: nada foi gravado de novo, e nenhuma senha mudou.')
      else {
        console.log('Senhas provisórias. Aparecem só agora: entregue ao Lucas fora do repositório, do Jira e do chat.')
        for (const c of credenciais) console.log(`${c.email} · ${c.perfis.join(', ') || 'sem perfil'} · ${c.senha}`)
      }
    } finally {
      await fechar()
    }
  } catch (erro) {
    console.error((erro as Error).message)
    process.exitCode = 1
  }
}
