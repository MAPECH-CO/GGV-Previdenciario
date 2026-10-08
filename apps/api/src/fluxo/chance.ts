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
