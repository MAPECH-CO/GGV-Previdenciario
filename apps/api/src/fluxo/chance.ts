// Chance de êxito (GGVP-131, primeiro recorte): número é código com teste (G19). Favoráveis sobre decididos, entre os
// desfechos conferidos do acervo com o mesmo benefício (proposta até o Lucas responder quais fatores contam).
// Desistência não é decisão e não conta. Sem caso decidido, não há número (G22: toda amostra conta, mas zero não é amostra).

export const REGRA_DA_CHANCE = 'Desfechos conferidos do acervo com o mesmo benefício: favoráveis sobre decididos; desistência não conta'
const FAVORAVEIS = new Set(['deferido', 'procedente_total', 'procedente_parcial'])
const DESFAVORAVEIS = new Set(['improcedente', 'extinto_sem_merito'])

export function calcularChance(desfechos: (string | null)[]) {
  const favoraveis = desfechos.filter((d) => d !== null && FAVORAVEIS.has(d)).length
  const casos = favoraveis + desfechos.filter((d) => d !== null && DESFAVORAVEIS.has(d)).length
  return { casos, favoraveis, porcentagem: casos ? Math.round((favoraveis / casos) * 100) : null }
}

export const REGRA_DA_CHANCE_DO_RECURSO = 'Recursos julgados no acervo conferido, do mesmo benefício: providos (no todo ou em parte) sobre julgados'

/** GGVP-161 CA2: a chance do recurso; o caso sem recurso julgado não entra (G22: toda amostra conta, zero não é amostra). */
export function calcularChanceDoRecurso(resultados: (string | null)[]) {
  const julgados = resultados.filter((r): r is string => r !== null)
  const favoraveis = julgados.filter((r) => r === 'provido' || r === 'provido_parcial').length
  return { casos: julgados.length, favoraveis, porcentagem: julgados.length ? Math.round((favoraveis / julgados.length) * 100) : null }
}

/** GGVP-150 CA2 (Lucas, 07/10): pela porcentagem mostrada; 15 e 50 ficam no amarelo. */
export function corDaChance(porcentagem: number | null) {
  if (porcentagem === null) return null
  return porcentagem < 15 ? 'vermelho' : porcentagem <= 50 ? 'amarelo' : 'verde'
}

/** GGVP-150 CA4: o que o caso ainda não sabe e deixa a chance menos certa. */
export function oQueFaltaSaber(c: { peritoConhecido: boolean; juizoConhecido: boolean; temParecer: boolean; faltamNoChecklist: string[] }) {
  return [
    !c.peritoConhecido && 'o perito',
    !c.juizoConhecido && 'o juízo',
    !c.temParecer && 'o parecer médico',
    c.faltamNoChecklist.length > 0 && `os documentos que faltam no checklist: ${c.faltamNoChecklist.join(', ')}`,
  ].filter((t): t is string => !!t)
}
