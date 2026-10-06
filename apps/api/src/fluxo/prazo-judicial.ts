// Prazo judicial (GGVP-34 CA2, CA6, CA9; G12, G19). Regra numérica é código, e o mesmo insumo dá sempre o mesmo prazo.
// Publicação = 1º dia útil depois da disponibilização; o prazo começa no dia útil seguinte (Lei 11.419, art. 4º, §§ 3º e 4º)
// e corre em dias úteis (CPC, art. 219; no JEF, Lei 9.099, art. 12-A). Sem prazo na decisão, 5 dias (CPC, art. 218, §3º).
import { inArray, isNull, or } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { feriado } from '../banco/esquema.ts'
import { ehDiaUtil, somarDias } from './prazo-inss.ts'

export const REGRA_PRAZO_JUDICIAL = {
  versao: 1,
  texto: 'Publicação no 1º dia útil após a disponibilização; início no dia útil seguinte; dias úteis (Lei 11.419, art. 4º; CPC, art. 219)',
}

const proximoDiaUtil = (iso: string, feriados: ReadonlySet<string>) => {
  let d = somarDias(iso, 1)
  while (!ehDiaUtil(d, feriados)) d = somarDias(d, 1)
  return d
}

/** `dias` é o que a publicação dá (ou 5, sem prazo na decisão). `feriados`: nacionais e do tribunal, inclusive suspensões. */
export function prazoJudicial(disponibilizadaEm: string, dias: number, feriados: ReadonlySet<string>) {
  const publicacao = proximoDiaUtil(disponibilizadaEm, feriados)
  const inicio = proximoDiaUtil(publicacao, feriados)
  let fim = inicio
  for (let n = 1; n < dias; n++) fim = proximoDiaUtil(fim, feriados)
  return { publicacao, inicio, fim, regra: REGRA_PRAZO_JUDICIAL.texto, versao: REGRA_PRAZO_JUDICIAL.versao }
}

/** Tribunal no formato "J.TR" (ex.: "4.03", TRF3), tirado do número CNJ de 20 dígitos. */
export const tribunalDoCnj = (cnj: string | null) => (cnj && /^\d{20}$/.test(cnj) ? `${cnj[13]}.${cnj.slice(14, 16)}` : null)

/** Feriados nacionais e os do tribunal do processo (CA9). Vazio: só o fim de semana conta, e a tela avisa. */
export async function feriadosDoProcesso(banco: Pick<Banco, 'select'>, cnj: string | null): Promise<Set<string>> {
  const tribunal = tribunalDoCnj(cnj)
  const linhas = await banco
    .select({ data: feriado.data })
    .from(feriado)
    .where(tribunal ? or(isNull(feriado.tribunal), inArray(feriado.tribunal, [tribunal])) : isNull(feriado.tribunal))
  return new Set(linhas.map((l) => l.data))
}
