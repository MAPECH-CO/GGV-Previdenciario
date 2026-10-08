// Datas como a tela lê. Regra numérica (idade) é código com teste, nunca resposta de modelo.

const doisDigitos = (n: number) => String(n).padStart(2, '0')

/** Data local de hoje: "2026-10-05". */
export function hojeIso(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${doisDigitos(agora.getMonth() + 1)}-${doisDigitos(agora.getDate())}`
}

/** Anos completos entre o nascimento e hoje, os dois em aaaa-mm-dd. */
export function idadeEm(nascimento: string, hoje: string): number {
  const [an, mn, dn] = nascimento.split('-').map(Number)
  const [ah, mh, dh] = hoje.split('-').map(Number)
  const fezAniversario = mh > mn || (mh === mn && dh >= dn)
  return ah - an - (fezAniversario ? 0 : 1)
}

/** "2026-09-27" → "27/09" no mesmo ano de hoje, "20/09/2025" em outro ano. */
export function dataCurta(iso: string, hoje: string): string {
  const [a, m, d] = iso.split('-')
  return a === hoje.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${a}`
}

/** Data e hora local: "05/10/2026 14:32". */
export function dataHora(isoDataHora: string): string {
  const d = new Date(isoDataHora)
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()} ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`
}

/** "05/10/2026 14:32" → "14:32". */
export function hora(isoDataHora: string): string {
  return dataHora(isoDataHora).slice(-5)
}
