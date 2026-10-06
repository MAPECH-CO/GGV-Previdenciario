// Conferência da Sênior (D2.01): o que o servidor sabe sobre ela. Usado pela conferência (GGVP-23) e pelo protocolo (GGVP-27, G2).
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { decisao, tarefa, usuario } from '../banco/esquema.ts'

/** G2: o OK é só a última decisão D2.01 da Sênior, nunca uma marcação de outro perfil; reprovar depois apaga o OK (CA9). */
export async function okDaSenior(banco: Banco, casoId: string) {
  const [d] = await banco
    .select({ resultado: decisao.resultado, por: usuario.nome, em: decisao.decididoEm })
    .from(decisao)
    .innerJoin(usuario, eq(decisao.decididoPor, usuario.id))
    .where(and(eq(decisao.casoId, casoId), eq(decisao.passo, 'D2.01'), eq(decisao.tipo, 'aprovacao_inss')))
    .orderBy(desc(decisao.decididoEm))
    .limit(1)
  return d ? { resultado: d.resultado, por: d.por, em: d.em } : null
}

/** O caso está na fila da Sênior: há tarefa D2.01 aberta (nova liberação depois de um ajuste cria outra). */
export async function esperandoConferencia(banco: Banco, casoId: string) {
  const [t] = await banco
    .select({ id: tarefa.id })
    .from(tarefa)
    .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D2.01'), isNull(tarefa.concluidaEm)))
    .limit(1)
  return Boolean(t)
}
