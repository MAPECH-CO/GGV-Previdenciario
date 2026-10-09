// Juízo identificado (GGVP-64, parte 1): o juízo pelo número CNJ, a mesma regra do recorte por juízo do painel (GGVP-75),
// e a jurimetria dele, calculada em código a partir do acervo, só com desfecho conferido (GGVP-55 CA7). Toda taxa sai com
// o número de processos e a data da base, sem amostra mínima (G22, regra de 07/10).
import { ROTULO_BENEFICIO, type Beneficio, type FonteDaIa, type JurimetriaDoJuizo } from '@ggv/contratos'
import { and, asc, eq, isNotNull, min } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { identificadorCaso, peticao, peticaoVersao, processoAcervo, protocoloJudicial } from '../banco/esquema.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'

/** Procedência: procedente, total ou em parte, sobre os decididos no mérito (a regra do painel e do juízo). */
export const PROCEDENTES = new Set(['procedente_total', 'procedente_parcial'])
export const DE_MERITO = new Set([...PROCEDENTES, 'improcedente'])
const DIAS_POR_MES = 365.25 / 12

/** O tribunal pelo J.TR do número CNJ; o que não está aqui aparece como "J.TR". */
const TRIBUNAL_DO_JTR: Record<string, string> = { '401': 'TRF1', '402': 'TRF2', '403': 'TRF3', '404': 'TRF4', '405': 'TRF5', '406': 'TRF6', '826': 'TJSP' }

/**
 * O juízo pelo número CNJ: o tribunal (J.TR) e a unidade de origem (os 4 últimos dígitos), como "TRF3 · 6301".
 * ponytail: a unidade de origem não é a vara; onde a unidade tem várias varas, a conta junta as varas. O nome da vara
 * entra na parte 2 da GGVP-64.
 */
export function juizoDoCnj(cnj: string): string | null {
  const n = cnj.replace(/\D/g, '')
  if (n.length !== 20) return null
  const jtr = n.slice(13, 16)
  return `${TRIBUNAL_DO_JTR[jtr] ?? `${jtr[0]}.${jtr.slice(1)}`} · ${n.slice(16)}`
}

/** O juízo do caso pelo primeiro número CNJ dele (CA1), ou nulo quando o caso ainda não tem número de processo. */
export async function juizoDoCaso(banco: Banco, casoId: string): Promise<string | null> {
  const [i] = await banco
    .select({ valor: identificadorCaso.valor })
    .from(identificadorCaso)
    .where(and(eq(identificadorCaso.casoId, casoId), eq(identificadorCaso.tipo, 'cnj')))
    .orderBy(asc(identificadorCaso.criadoEm))
    .limit(1)
  return i ? juizoDoCnj(i.valor) : null
}

/**
 * CA3: a jurimetria do juízo como fonte da advogada: a procedência do benefício do caso e o tempo até a sentença.
 * CA6: vai só às fontes da resposta; o modelo não recebe esses números.
 */
export function fonteDoJuizo(j: JurimetriaDoJuizo, beneficio: string | null): FonteDaIa | null {
  const b = j.porBeneficio.find((x) => x.beneficio === beneficio)
  const t = j.tempoAteASentenca
  const partes = [b && `procedência em ${b.nome}: ${b.texto}`, t && `tempo até a sentença: ${t.meses} meses em média, em ${t.processos} ${t.processos === 1 ? 'processo' : 'processos'}`]
  const texto = partes.filter(Boolean).join('; ')
  return texto ? { tipo: 'acervo', referencia: `juizo:${j.juizo}`, trecho: `Jurimetria do juízo ${j.juizo}, só para a advogada: ${texto}` } : null
}

/** CA4: "58% em 12 processos · base de 08/10". */
const textoDaTaxa = (procedentes: number, decididos: number, base: string) =>
  `${Math.round((procedentes / decididos) * 100)}% em ${decididos} ${decididos === 1 ? 'processo' : 'processos'} · base de ${base.slice(8, 10)}/${base.slice(5, 7)}`

/** O primeiro protocolo da petição inicial de cada caso: o começo do tempo até a sentença, aqui e na Gestão (GGVP-149). */
export async function protocolosDaInicial(banco: Banco) {
  return new Map(
    (
      await banco
        .select({ casoId: peticao.casoId, em: min(protocoloJudicial.protocoladoEm) })
        .from(protocoloJudicial)
        .innerJoin(peticaoVersao, eq(peticaoVersao.id, protocoloJudicial.peticaoVersaoId))
        .innerJoin(peticao, and(eq(peticao.id, peticaoVersao.peticaoId), eq(peticao.tipo, 'inicial')))
        .groupBy(peticao.casoId)
    ).map((r) => [r.casoId, r.em]),
  )
}

/**
 * A jurimetria do juízo (CA2, CA4, CA5): só processos do acervo com desfecho conferido e de mérito. O CNJ vem do acervo
 * ou, quando falta, do caso ligado; processo sem benefício fica fora da taxa, e sem as duas datas, fora do tempo.
 * ponytail: lê o acervo inteiro e filtra em memória, como o painel; com milhares de processos, guardar o juízo numa
 * coluna e filtrar no `where`.
 */
export async function jurimetriaDoJuizo(banco: Banco, juizo: string, agora: Date): Promise<JurimetriaDoJuizo> {
  const base = hojeEmBrasilia(agora)
  const cnjDoCaso = new Map(
    (await banco.select({ casoId: identificadorCaso.casoId, valor: identificadorCaso.valor }).from(identificadorCaso).where(eq(identificadorCaso.tipo, 'cnj'))).map((i) => [
      i.casoId,
      i.valor,
    ]),
  )
  const conferidos = await banco
    .select({ numeroCnj: processoAcervo.numeroCnj, casoId: processoAcervo.casoId, beneficio: processoAcervo.beneficio, desfecho: processoAcervo.desfecho, dataDecisao: processoAcervo.dataDecisao })
    .from(processoAcervo)
    .where(isNotNull(processoAcervo.desfechoConferidoPor))
  const doJuizo = conferidos.flatMap((p) => {
    const cnj = (p.numeroCnj ?? (p.casoId ? cnjDoCaso.get(p.casoId) : undefined))?.replace(/\D/g, '')
    return cnj && p.desfecho && DE_MERITO.has(p.desfecho) && juizoDoCnj(cnj) === juizo ? [{ ...p, numeroCnj: cnj, desfecho: p.desfecho }] : []
  })

  const porBeneficio = new Map<string, { procedentes: number; decididos: number }>()
  for (const p of doJuizo) {
    if (!p.beneficio) continue
    const x = porBeneficio.get(p.beneficio) ?? { procedentes: 0, decididos: 0 }
    x.decididos++
    if (PROCEDENTES.has(p.desfecho)) x.procedentes++
    porBeneficio.set(p.beneficio, x)
  }

  // Do protocolo da inicial (o primeiro, se houver mais de um) à data da decisão.
  const inicial = await protocolosDaInicial(banco)
  const dias = doJuizo.flatMap((p) => {
    const protocolo = p.casoId ? inicial.get(p.casoId) : undefined
    return protocolo && p.dataDecisao ? [(Date.parse(p.dataDecisao) - new Date(protocolo).getTime()) / 86_400_000] : []
  })

  return {
    juizo,
    base,
    porBeneficio: [...porBeneficio].map(([beneficio, x]) => ({ beneficio, nome: ROTULO_BENEFICIO[beneficio as Beneficio] ?? beneficio, ...x, texto: textoDaTaxa(x.procedentes, x.decididos, base) })),
    tempoAteASentenca: dias.length ? { meses: Math.round(dias.reduce((s, d) => s + d, 0) / dias.length / DIAS_POR_MES), processos: dias.length } : null,
    processos: doJuizo.map((p) => ({ numeroCnj: p.numeroCnj, desfecho: p.desfecho })).sort((a, b) => a.numeroCnj.localeCompare(b.numeroCnj)),
  }
}
