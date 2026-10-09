// Acervo (GGVP-55 CA7): os processos com desfecho lido e sem conferência. Só o conferido entra nas contas da jurimetria.
// GGVP-41: o desfecho do portal vem com a ficha da IA, nula enquanto ela não leu (CA11).
import { ConferenciaDoAcervo } from '@ggv/contratos'
import { and, asc, count, isNotNull, isNull } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { processoAcervo } from '../banco/esquema.ts'

/** O item "Conferir desfechos do lote" da Central tem id fixo: não é linha de `tarefa` e não aponta para um processo. */
export const ID_CONFERIR_DESFECHOS = '00000000-0000-4000-8000-000000000055'

export async function conferenciaDoAcervo(banco: Banco): Promise<ConferenciaDoAcervo> {
  const linhas = await banco
    .select()
    .from(processoAcervo)
    .where(and(isNotNull(processoAcervo.desfecho), isNull(processoAcervo.desfechoConferidoPor)))
    .orderBy(asc(processoAcervo.criadoEm), asc(processoAcervo.numeroCnj))
  const pendentes = linhas.map((l) => ({
    id: l.id,
    numeroCnj: l.numeroCnj,
    beneficio: l.beneficio,
    desfechoLido: l.desfecho,
    fonte: l.fonte,
    ficha: l.materia ? { materia: l.materia, vara: l.vara, tese: l.tese, resumo: l.resumo, licao: l.licao } : null,
  }))
  const [{ conferidos }] = await banco.select({ conferidos: count() }).from(processoAcervo).where(isNotNull(processoAcervo.desfechoConferidoPor))
  return ConferenciaDoAcervo.parse({ pendentes, conferidos })
}
