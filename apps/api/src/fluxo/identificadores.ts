// O número que mostra o caso (GGVP-108 CA3): na Justiça, o número CNJ; no INSS, o NB ou, sem ele, o protocolo.
// Sem o número da fase, vale o último que o caso tiver; o caso encerrado aparece pelo último número que ganhou.
export type Identificador = { tipo: string; valor: string; criadoEm: Date }

const PREFERENCIA: Record<string, string[]> = { judicial: ['cnj', 'nb', 'protocolo_inss'] }
const NO_INSS = ['nb', 'protocolo_inss', 'cnj']

export function numeroDoCaso(fase: string, identificadores: Identificador[]): Identificador | null {
  const recentes = [...identificadores].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())
  if (fase === 'encerrado') return recentes[0] ?? null
  for (const tipo of PREFERENCIA[fase] ?? NO_INSS) {
    const achado = recentes.find((i) => i.tipo === tipo)
    if (achado) return achado
  }
  return null
}
