// Acervo (GGVP-55 CA7): os processos com desfecho lido e sem conferência. Só o conferido entra nas contas da jurimetria.
import { ConferenciaDoAcervo } from '@ggv/contratos'
import { and, asc, count, isNotNull, isNull } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { processoAcervo } from '../banco/esquema.ts'

/** O item "Conferir desfechos do lote" da Central tem id fixo: não é linha de `tarefa` e não aponta para um processo. */
export const ID_CONFERIR_DESFECHOS = '00000000-0000-4000-8000-000000000055'

export async function conferenciaDoAcervo(banco: Banco): Promise<ConferenciaDoAcervo> {
  const pendentes = await banco
    .select({ id: processoAcervo.id, numeroCnj: processoAcervo.numeroCnj, beneficio: processoAcervo.beneficio, desfechoLido: processoAcervo.desfecho, fonte: processoAcervo.fonte })
    .from(processoAcervo)
    .where(and(isNotNull(processoAcervo.desfecho), isNull(processoAcervo.desfechoConferidoPor)))
    .orderBy(asc(processoAcervo.criadoEm), asc(processoAcervo.numeroCnj))
  const [{ conferidos }] = await banco.select({ conferidos: count() }).from(processoAcervo).where(isNotNull(processoAcervo.desfechoConferidoPor))
  return ConferenciaDoAcervo.parse({ pendentes, conferidos })
}
