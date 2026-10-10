// Acervo (GGVP-55 CA7): os processos com desfecho lido e sem conferência. Só o conferido entra nas contas da jurimetria.
// GGVP-41: o desfecho do portal vem com a ficha da IA, nula enquanto ela não leu (CA11).
import { ConferenciaDoAcervo } from '@ggv/contratos'
import { and, asc, count, eq, isNotNull, isNull } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { caso, processoAcervo } from '../banco/esquema.ts'

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
  // GGVP-153 CA1: o conferido ligado a um caso sem vara, juiz ou tese fica fora daquele recorte até alguém completar.
  const ligados = await banco
    .select({ id: processoAcervo.id, numeroCnj: processoAcervo.numeroCnj, beneficio: processoAcervo.beneficio, desfecho: processoAcervo.desfecho, tese: processoAcervo.tese, vara: caso.vara, juiz: caso.juiz })
    .from(processoAcervo)
    .innerJoin(caso, eq(processoAcervo.casoId, caso.id))
    .where(isNotNull(processoAcervo.desfechoConferidoPor))
    .orderBy(asc(processoAcervo.criadoEm))
  const incompletos = ligados.flatMap((l) => {
    const falta = ([['vara', l.vara], ['juiz', l.juiz], ['tese', l.tese]] as const).filter(([, v]) => !v?.trim()).map(([campo]) => campo)
    return falta.length ? [{ id: l.id, numeroCnj: l.numeroCnj, beneficio: l.beneficio, desfecho: l.desfecho as string, falta }] : []
  })
  const casos = await banco.select({ vara: caso.vara, juiz: caso.juiz }).from(caso)
  const teses = await banco.select({ tese: processoAcervo.tese }).from(processoAcervo).where(isNotNull(processoAcervo.desfechoConferidoPor))
  const opcoes = (valores: (string | null)[]) => [...new Set(valores.flatMap((v) => (v?.trim() ? [v.trim()] : [])))].sort((x, y) => x.localeCompare(y, 'pt-BR'))
  const conhecidos = { vara: opcoes(casos.map((c) => c.vara)), juiz: opcoes(casos.map((c) => c.juiz)), tese: opcoes(teses.map((t) => t.tese)) }
  return ConferenciaDoAcervo.parse({ pendentes, conferidos, incompletos, conhecidos })
}
