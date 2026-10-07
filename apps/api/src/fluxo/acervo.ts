// Acervo (GGVP-55 CA7): os processos com desfecho lido e sem conferência. Só o conferido entra nas contas da jurimetria.
import { ConferenciaDoAcervo } from '@ggv/contratos'
import { and, asc, count, isNotNull, isNull } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { processoAcervo } from '../banco/esquema.ts'

export async function conferenciaDoAcervo(banco: Banco): Promise<ConferenciaDoAcervo> {
  const pendentes = await banco
    .select({ id: processoAcervo.id, numeroCnj: processoAcervo.numeroCnj, beneficio: processoAcervo.beneficio, desfechoLido: processoAcervo.desfecho, fonte: processoAcervo.fonte })
    .from(processoAcervo)
    .where(and(isNotNull(processoAcervo.desfecho), isNull(processoAcervo.desfechoConferidoPor)))
    .orderBy(asc(processoAcervo.criadoEm), asc(processoAcervo.numeroCnj))
  const [{ conferidos }] = await banco.select({ conferidos: count() }).from(processoAcervo).where(isNotNull(processoAcervo.desfechoConferidoPor))
  return ConferenciaDoAcervo.parse({ pendentes, conferidos })
}
