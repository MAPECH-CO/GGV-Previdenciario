// Juízo identificado (GGVP-64, parte 1): o juízo pelo número CNJ, a mesma regra do recorte por juízo do painel (GGVP-75),
// e a jurimetria dele, calculada em código a partir do acervo, só com desfecho conferido (GGVP-55 CA7). Toda taxa sai com
// o número de processos e a data da base, sem amostra mínima (G22, regra de 07/10). Parte 2: a vara e o juiz do caso e os
// entendimentos recorrentes, que a IA tira das decisões de mérito do juízo.
import { EntendimentosDoJuizo, ROTULO_BENEFICIO, type Beneficio, type EntendimentoDoJuizo, type FonteDaIa, type JurimetriaDoJuizo } from '@ggv/contratos'
import { and, asc, desc, eq, isNotNull, min } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { caso, identificadorCaso, juizo as tabelaDoJuizo, pericia, perito, pessoa, peticao, peticaoVersao, processoAcervo, protocoloJudicial, publicacao } from '../banco/esquema.ts'
import { anonimizar } from '../ia/acervo.ts'
import { lerJson, type ComoSugerir, type Ia } from '../ia/ia.ts'
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
 * coluna e filtrar no `where`. Parte 2: a vara e o juiz vêm do caso de quem pergunta; os entendimentos, do juízo.
 */
export async function jurimetriaDoJuizo(
  banco: Banco,
  juizo: string,
  agora: Date,
  doCaso: { vara: string | null; juiz: string | null; casoId?: string } = { vara: null, juiz: null },
): Promise<JurimetriaDoJuizo> {
  const base = hojeEmBrasilia(agora)
  const [lido] = await banco.select({ entendimentos: tabelaDoJuizo.entendimentos }).from(tabelaDoJuizo).where(eq(tabelaDoJuizo.nome, juizo)).limit(1)
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
    vara: doCaso.vara,
    juiz: doCaso.juiz,
    casosDoJuiz: doCaso.juiz ? await casosDoJuiz(banco, doCaso.juiz) : null,
    perito: doCaso.casoId ? await peritoDoCaso(banco, doCaso.casoId) : null,
    entendimentos: (lido?.entendimentos as EntendimentoDoJuizo[] | null) ?? [],
    base,
    porBeneficio: [...porBeneficio].map(([beneficio, x]) => ({ beneficio, nome: ROTULO_BENEFICIO[beneficio as Beneficio] ?? beneficio, ...x, texto: textoDaTaxa(x.procedentes, x.decididos, base) })),
    tempoAteASentenca: dias.length ? { meses: Math.round(dias.reduce((s, d) => s + d, 0) / dias.length / DIAS_POR_MES), processos: dias.length } : null,
    processos: doJuizo.map((p) => ({ numeroCnj: p.numeroCnj, desfecho: p.desfecho })).sort((a, b) => a.numeroCnj.localeCompare(b.numeroCnj)),
  }
}

/** "Dra. Maria Souza" e "maria souza" são o mesmo juiz: sem acento, sem caixa, sem pontuação e sem o título. */
const nomeComparavel = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^dra? /, '')

/** GGVP-158 P5.14: os casos do escritório com o mesmo juiz, contados no código. */
async function casosDoJuiz(banco: Banco, juiz: string) {
  const alvo = nomeComparavel(juiz)
  return (await banco.select({ juiz: caso.juiz }).from(caso).where(isNotNull(caso.juiz))).filter((c) => nomeComparavel(c.juiz!) === alvo).length
}

/** GGVP-158 P5.14: o perito da perícia mais nova do caso que tem perito, e os casos distintos em que ele está. */
async function peritoDoCaso(banco: Banco, casoId: string) {
  const [l] = await banco
    .select({ id: perito.id, nome: perito.nome })
    .from(pericia)
    .innerJoin(perito, eq(pericia.peritoId, perito.id))
    .where(eq(pericia.casoId, casoId))
    .orderBy(desc(pericia.criadoEm))
    .limit(1)
  if (!l) return null
  const casos = new Set((await banco.select({ casoId: pericia.casoId }).from(pericia).where(eq(pericia.peritoId, l.id))).map((x) => x.casoId))
  return { id: l.id, nome: l.nome, casos: casos.size }
}

// ponytail: as 10 decisões mais novas do juízo; mais que isso, o pedido à IA cresce sem ganho para o resumo.
const DECISOES_LIDAS = 10

/** As publicações de mérito com número CNJ, do juízo pedido (ou de todos), das mais novas às mais antigas. */
async function decisoesDeMerito(banco: Banco, juizo?: string) {
  const linhas = await banco
    .select({ numeroCnj: publicacao.numeroCnj, texto: publicacao.texto, criadoEm: publicacao.criadoEm, cliente: pessoa.nome })
    .from(publicacao)
    .leftJoin(caso, eq(publicacao.casoId, caso.id))
    .leftJoin(pessoa, eq(caso.pessoaId, pessoa.id))
    .where(and(eq(publicacao.classe, 'merito'), isNotNull(publicacao.numeroCnj)))
    .orderBy(desc(publicacao.disponibilizadaEm), desc(publicacao.criadoEm))
  return linhas.flatMap((l) => {
    const cnj = l.numeroCnj?.replace(/\D/g, '') ?? ''
    const de = juizoDoCnj(cnj)
    return de && (!juizo || de === juizo) ? [{ juizo: de, numeroCnj: cnj, texto: l.texto, criadoEm: l.criadoEm, cliente: l.cliente }] : []
  })
}

/** CA2: os juízos com decisão de mérito mais nova que a última leitura da IA (ou nunca lidos); a rodada lê de novo. */
export async function juizosParaLer(banco: Banco) {
  const maisNova = new Map<string, Date>()
  for (const d of await decisoesDeMerito(banco)) if (!maisNova.has(d.juizo) || d.criadoEm > maisNova.get(d.juizo)!) maisNova.set(d.juizo, d.criadoEm)
  const lidoEm = new Map((await banco.select({ nome: tabelaDoJuizo.nome, em: tabelaDoJuizo.entendimentosEm }).from(tabelaDoJuizo)).map((j) => [j.nome, j.em]))
  return [...maisNova].filter(([j, d]) => !lidoEm.get(j) || d > lidoEm.get(j)!).map(([j]) => j)
}

/**
 * CA2, CA5: a IA lê as decisões de mérito do juízo, cada uma sem dado pessoal do cliente, e devolve até 5 entendimentos
 * com os processos de exemplo. O código só aceita processo que estava no conteúdo; entendimento sem nenhum fica fora.
 */
export async function entendimentosDoJuizo(banco: Banco, ia: Ia, juizo: string, agora: Date, como: ComoSugerir = {}) {
  const decisoes = (await decisoesDeMerito(banco, juizo)).slice(0, DECISOES_LIDAS)
  if (!decisoes.length) return null
  const conteudo = [`Juízo: ${juizo}`, ...decisoes.map((d) => `Processo ${d.numeroCnj}:\n${anonimizar(d.texto, d.cliente)}`)].join('\n\n')
  const fontes: FonteDaIa[] = decisoes.map((d) => ({ tipo: 'publicacao', referencia: `processo:${d.numeroCnj}` }))
  const validar = (texto: string) => EntendimentosDoJuizo.safeParse(lerJson(texto)).success
  const s = await ia.sugerir('entendimentos_do_juizo', { casoId: null, quem: null, conteudo, fontes }, { ...como, validar })
  if (!s) return null
  const lidos = new Set(decisoes.map((d) => d.numeroCnj))
  const entendimentos = EntendimentosDoJuizo.parse(lerJson(s.texto))
    .entendimentos.map((e) => ({ texto: e.texto, processos: [...new Set(e.processos.map((p) => p.replace(/\D/g, '')))].filter((p) => lidos.has(p)) }))
    .filter((e) => e.processos.length)
  await banco
    .insert(tabelaDoJuizo)
    .values({ tribunal: juizo.split(' · ')[0], nome: juizo, entendimentos, entendimentosEm: agora })
    .onConflictDoUpdate({ target: [tabelaDoJuizo.tribunal, tabelaDoJuizo.nome], set: { entendimentos, entendimentosEm: agora } })
  return entendimentos
}
