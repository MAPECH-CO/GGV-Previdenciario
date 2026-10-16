// A base histórica por benefício (GGVP-163 R5): o texto de cada taxa, sempre com o número de casos e a data da base (G22).
import { isoParaData } from '@ggv/campos'
import type { IndicadorHistorico } from '@ggv/contratos'

/** "4 de 115 (3%) · base de 16/10": toda taxa com o número de casos e a data da base (G22). */
export function textoDoIndicador(i: IndicadorHistorico, dataDaBase: string | null) {
  const base = i.baseEm ?? dataDaBase
  const quando = base ? ` · base de ${(isoParaData(base) ?? base).slice(0, 5)}` : ''
  if (!i.n) return `sem caso${quando}`
  // A porcentagem sai da contagem (G19), não do valor arredondado da vista: 4 de 115 é 3%.
  const porcentagem = i.sim !== null ? Math.round((i.sim / i.n) * 100) : i.valor !== null ? Math.round(i.valor * 100) : null
  const taxa = porcentagem === null ? '' : ` (${porcentagem}%)`
  return `${i.sim ?? '—'} de ${i.n}${taxa}${quando}`
}
