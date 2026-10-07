// Prazo da exigência do INSS (GGVP-39 CA7; regra da GGVP-34 CA11): dias corridos a partir do dia seguinte ao da
// exigência; o fim em sábado, domingo ou feriado vai para o próximo dia útil (Lei 9.784, art. 66). Regra numérica é código.
import { isNull } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { feriado } from '../banco/esquema.ts'

export const REGRA_PRAZO_INSS = 'Dias corridos a partir do dia seguinte; fim sem expediente vai ao próximo dia útil (Lei 9.784, art. 66)'

const UM_DIA = 86_400_000
export const somarDias = (iso: string, dias: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + dias * UM_DIA).toISOString().slice(0, 10)

export function ehDiaUtil(iso: string, feriados: ReadonlySet<string>): boolean {
  const semana = new Date(`${iso}T00:00:00Z`).getUTCDay()
  return semana !== 0 && semana !== 6 && !feriados.has(iso)
}

/** Último dia para cumprir. `dias` vem da comunicação do INSS. */
export function prazoInss(dataExigencia: string, dias: number, feriados: ReadonlySet<string>): string {
  let fim = somarDias(dataExigencia, dias)
  while (!ehDiaUtil(fim, feriados)) fim = somarDias(fim, 1)
  return fim
}

/** Dias úteis de amanhã até o prazo, inclusive. Prazo hoje: 0. Vencido: negativo (dias corridos de atraso). */
export function diasUteisAte(hoje: string, prazo: string, feriados: ReadonlySet<string>): number {
  if (prazo < hoje) return -Math.round((Date.parse(hoje) - Date.parse(prazo)) / UM_DIA)
  let n = 0
  for (let d = somarDias(hoje, 1); d <= prazo; d = somarDias(d, 1)) if (ehDiaUtil(d, feriados)) n++
  return n
}

/** Feriados nacionais (sem tribunal) cadastrados. Tabela vazia: só o fim de semana conta, e a tela avisa. */
export async function feriadosNacionais(banco: Banco): Promise<Set<string>> {
  const linhas = await banco.select({ data: feriado.data }).from(feriado).where(isNull(feriado.tribunal))
  return new Set(linhas.map((l) => l.data))
}
