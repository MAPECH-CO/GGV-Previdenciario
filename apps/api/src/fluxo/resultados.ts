// Painel de resultado para os sócios (GGVP-75): cada indicador é calculado em código a partir dos desfechos gravados
// (CA7), pela data do seu evento no período; caso com dado incerto fica fora e nada trava. Não há amostra mínima: toda
// taxa sai com o número de casos (CA8, G22 de 07/10).
import { ROTULO_BENEFICIO, type Beneficio, type Indicador, type PainelDeResultados, type Recorte } from '@ggv/contratos'
import { count, max, sql } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { caso, exigencia, exigenciaItem, identificadorCaso, parecerMedico, pericia, perito, prestacaoContas, processoAcervo, resultadoInss, usuario } from '../banco/esquema.ts'
import { hojeEmBrasilia as diaEmBrasilia } from '../vigilia/fila.ts'

const PROCEDENTES = new Set(['procedente_total', 'procedente_parcial'])
const DE_MERITO = new Set([...PROCEDENTES, 'improcedente'])
const EXTINTO = 'extinto_sem_merito'
/** O tribunal pelo J.TR do número CNJ, para o recorte por juízo; o que não está aqui aparece como "J.TR". */
const TRIBUNAL_DO_JTR: Record<string, string> = { '401': 'TRF1', '402': 'TRF2', '403': 'TRF3', '404': 'TRF4', '405': 'TRF5', '406': 'TRF6', '826': 'TJSP' }
const UM_DIA_MS = 86_400_000

/** Toda taxa sai, com o número de casos (CA8, G22 de 07/10); sem nenhum caso, "sem dados ainda" (CA5). */
export function taxa(chave: string, rotulo: string, exitos: number, casos: number): Indicador {
  const base = { chave, rotulo, casos, unidade: 'taxa' as const }
  return casos === 0 ? { ...base, valor: null, situacao: 'sem_dados' } : { ...base, valor: exitos / casos, situacao: 'ok' }
}

const contagem = (chave: string, rotulo: string, casos: number): Indicador => ({ chave, rotulo, casos, valor: casos, unidade: 'casos', situacao: 'ok' })

function mediana(numeros: number[]): number {
  const o = [...numeros].sort((a, b) => a - b)
  const meio = Math.floor(o.length / 2)
  return o.length % 2 ? o[meio] : (o[meio - 1] + o[meio]) / 2
}

export type PedidoDoCalculo = { de: string; ate: string; recorte: Recorte | null; verTotais: boolean }

export async function painelDeResultados(banco: Banco, { de, ate, recorte, verTotais }: PedidoDoCalculo): Promise<PainelDeResultados> {
  const noPeriodo = (dia: string | null | undefined): dia is string => !!dia && dia >= de && dia <= ate
  const casos = await banco
    .select({ id: caso.id, beneficio: caso.beneficio, advogadaId: caso.advogadaResponsavelId, desfecho: caso.desfecho, causa: caso.causaDesfecho, criadoEm: caso.criadoEm, encerradoEm: caso.encerradoEm })
    .from(caso)
  const casoPorId = new Map(casos.map((c) => [c.id, c]))

  // INSS: a última decisão do caso no período.
  const decisoes = new Map<string, { resultado: string; dia: string }>()
  for (const r of await banco.select({ casoId: resultadoInss.casoId, resultado: resultadoInss.resultado, dia: resultadoInss.dataDecisao }).from(resultadoInss)) {
    if (!noPeriodo(r.dia)) continue
    const atual = decisoes.get(r.casoId)
    if (!atual || r.dia >= atual.dia) decisoes.set(r.casoId, { resultado: r.resultado, dia: r.dia })
  }

  // Justiça: o desfecho do caso encerrado no período; desfecho sem a data de encerramento fica fora (CA7).
  const judiciais = casos.filter((c) => (DE_MERITO.has(c.desfecho ?? '') || c.desfecho === EXTINTO) && c.encerradoEm && noPeriodo(diaEmBrasilia(c.encerradoEm)))

  // Exigências fechadas no período: a cumprida, pelo último item cumprido; a vencida, pelo prazo. Sem data, fica fora.
  const ultimoCumprimento = new Map<string, string>()
  for (const i of await banco.select({ exigenciaId: exigenciaItem.exigenciaId, cumpridoEm: exigenciaItem.cumpridoEm }).from(exigenciaItem)) {
    if (!i.cumpridoEm) continue
    const dia = diaEmBrasilia(i.cumpridoEm)
    if (dia > (ultimoCumprimento.get(i.exigenciaId) ?? '')) ultimoCumprimento.set(i.exigenciaId, dia)
  }
  const fechadas: { casoId: string; noPrazo: boolean }[] = []
  for (const e of await banco.select({ id: exigencia.id, casoId: exigencia.casoId, prazo: exigencia.prazo, situacao: exigencia.situacao }).from(exigencia)) {
    const fechamento = e.situacao === 'cumprida' ? ultimoCumprimento.get(e.id) : e.situacao === 'vencida' ? e.prazo : null
    if (!noPeriodo(fechamento)) continue
    fechadas.push({ casoId: e.casoId, noPrazo: e.situacao === 'cumprida' && (!e.prazo || fechamento <= e.prazo) })
  }

  /** Os indicadores de um conjunto de casos: o escritório inteiro, ou um grupo do recorte. */
  function indicadores(doGrupo: (casoId: string) => boolean): Indicador[] {
    const inss = [...decisoes].filter(([id]) => doGrupo(id)).map(([, d]) => d)
    const merito = judiciais.filter((c) => doGrupo(c.id) && DE_MERITO.has(c.desfecho ?? ''))
    const exigencias = fechadas.filter((e) => doGrupo(e.casoId))
    return [
      taxa('deferimento_inss', 'Deferimento no INSS', inss.filter((d) => d.resultado === 'deferido').length, inss.length),
      taxa('procedencia', 'Procedência na Justiça', merito.filter((c) => PROCEDENTES.has(c.desfecho ?? '')).length, merito.length),
      contagem('extincoes', 'Extinções sem mérito', judiciais.filter((c) => doGrupo(c.id) && c.desfecho === EXTINTO).length),
      taxa('exigencias_no_prazo', 'Exigências cumpridas no prazo', exigencias.filter((e) => e.noPrazo).length, exigencias.length),
    ]
  }

  // CA3: o êxito dos casos decididos no período, pelo último parecer do caso. A Justiça vale sobre o INSS.
  const ultimoParecer = new Map<string, { resultado: string; criadoEm: Date }>()
  for (const p of await banco.select({ casoId: parecerMedico.casoId, resultado: parecerMedico.resultado, criadoEm: parecerMedico.criadoEm }).from(parecerMedico)) {
    const atual = ultimoParecer.get(p.casoId)
    if (!atual || p.criadoEm >= atual.criadoEm) ultimoParecer.set(p.casoId, p)
  }
  const exitoDoCaso = new Map<string, boolean>([...decisoes].map(([id, d]) => [id, d.resultado === 'deferido']))
  for (const c of judiciais) exitoDoCaso.set(c.id, PROCEDENTES.has(c.desfecho ?? ''))
  const exitoCom = (resultado: string) => {
    const ids = [...exitoDoCaso.keys()].filter((id) => ultimoParecer.get(id)?.resultado === resultado)
    return [ids.filter((id) => exitoDoCaso.get(id)).length, ids.length] as const
  }
  const dispensados = [...ultimoParecer.values()].filter((p) => p.resultado === 'dispensado' && noPeriodo(diaEmBrasilia(p.criadoEm))).length

  // CA2: as extinções sem mérito, por causa, em destaque (a meta é zero).
  const porCausa = new Map<string, number>()
  for (const c of judiciais.filter((j) => j.desfecho === EXTINTO)) porCausa.set(c.causa?.trim() || 'sem causa registrada', (porCausa.get(c.causa?.trim() || 'sem causa registrada') ?? 0) + 1)

  // CA4: os totais em dinheiro, só para quem pode ver.
  let totais: PainelDeResultados['totais'] = null
  if (verTotais) {
    const recebidas = (await banco.select({ casoId: prestacaoContas.casoId, honorarios: prestacaoContas.honorarios, recebidaEm: prestacaoContas.recebidaEm }).from(prestacaoContas)).filter(
      (p) => p.recebidaEm && noPeriodo(diaEmBrasilia(p.recebidaEm)),
    )
    const centavos = recebidas.reduce((soma, p) => soma + Math.round(Number(p.honorarios) * 100), 0)
    const dias = recebidas
      .map((p) => {
        const c = casoPorId.get(p.casoId)
        return c && p.recebidaEm ? Math.round((p.recebidaEm.getTime() - c.criadoEm.getTime()) / UM_DIA_MS) : -1
      })
      .filter((d) => d >= 0)
    const tempo = taxa('dias_ate_receber', 'Tempo até o dinheiro', 0, dias.length)
    totais = {
      honorariosRecebidos: (centavos / 100).toFixed(2),
      recebimentos: recebidas.length,
      diasAteReceber: { ...tempo, unidade: 'dias', valor: dias.length ? mediana(dias) : null },
    }
  }

  // GGVP-55 CA3: a base em uso não depende do período. Aguardando = desfecho lido e sem conferência, fora das contas.
  const [acervo] = await banco
    .select({
      processos: count(),
      conferidos: count(processoAcervo.desfechoConferidoPor),
      aguardando: sql`count(*) filter (where ${processoAcervo.desfecho} is not null and ${processoAcervo.desfechoConferidoPor} is null)`.mapWith(Number),
      ultimaEntrada: max(processoAcervo.criadoEm),
    })
    .from(processoAcervo)

  return {
    periodo: { de, ate },
    indicadores: [...indicadores(() => true), contagem('pareceres_dispensados', 'Pareceres dispensados', dispensados)],
    recorte: recorte ? { por: recorte, grupos: await gruposDoRecorte(banco, recorte, casoPorId, indicadores, [...decisoes.keys(), ...judiciais.map((c) => c.id), ...fechadas.map((e) => e.casoId)]) } : null,
    extincoes: {
      casos: judiciais.filter((c) => c.desfecho === EXTINTO).length,
      decididos: new Set([...decisoes.keys(), ...judiciais.map((c) => c.id)]).size,
      porCausa: [...porCausa].map(([causa, n]) => ({ causa, casos: n })).sort((a, b) => b.casos - a.casos),
    },
    pareceres: {
      dispensados,
      exitoComDispensa: taxa('exito_com_dispensa', 'Êxito com parecer dispensado', ...exitoCom('dispensado')),
      exitoComSuficiente: taxa('exito_com_suficiente', 'Êxito com parecer suficiente', ...exitoCom('suficiente')),
    },
    totais,
    operacao: decisoes.size + judiciais.length > 0 ? 'com_dados' : 'sem_dados',
    baseDoAcervo: acervo.ultimaEntrada
      ? {
          situacao: 'com_dados',
          processos: acervo.processos,
          conferidos: acervo.conferidos,
          aguardandoConferencia: acervo.aguardando,
          dataDaBase: diaEmBrasilia(acervo.ultimaEntrada),
        }
      : { situacao: 'sem_dados' },
  }
}

type CasoDoPainel = { id: string; beneficio: string | null; advogadaId: string | null }

/** O nome do grupo de cada caso no recorte; caso sem o dado do recorte fica fora dos grupos (CA7). */
async function gruposDoRecorte(
  banco: Banco,
  recorte: Recorte,
  casoPorId: Map<string, CasoDoPainel>,
  indicadores: (doGrupo: (casoId: string) => boolean) => Indicador[],
  idsComDado: string[],
) {
  const nomeDe = new Map<string, string>()
  if (recorte === 'beneficio') {
    for (const c of casoPorId.values()) if (c.beneficio) nomeDe.set(c.id, ROTULO_BENEFICIO[c.beneficio as Beneficio] ?? c.beneficio)
  } else if (recorte === 'advogada') {
    const nomes = new Map((await banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario)).map((u) => [u.id, u.nome]))
    for (const c of casoPorId.values()) if (c.advogadaId && nomes.has(c.advogadaId)) nomeDe.set(c.id, nomes.get(c.advogadaId) as string)
  } else if (recorte === 'perito') {
    const nomes = new Map((await banco.select({ id: perito.id, nome: perito.nome }).from(perito)).map((p) => [p.id, p.nome]))
    for (const p of await banco.select({ casoId: pericia.casoId, peritoId: pericia.peritoId }).from(pericia)) if (p.peritoId && nomes.has(p.peritoId)) nomeDe.set(p.casoId, nomes.get(p.peritoId) as string)
  } else {
    for (const i of await banco.select({ casoId: identificadorCaso.casoId, tipo: identificadorCaso.tipo, valor: identificadorCaso.valor }).from(identificadorCaso)) {
      const n = i.valor.replace(/\D/g, '')
      if (i.tipo !== 'cnj' || n.length !== 20) continue
      const jtr = n.slice(13, 16)
      nomeDe.set(i.casoId, `${TRIBUNAL_DO_JTR[jtr] ?? `${jtr[0]}.${jtr.slice(1)}`} · ${n.slice(16)}`)
    }
  }
  const nomes = [...new Set(idsComDado.map((id) => nomeDe.get(id)).filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return nomes.map((nome) => ({ nome, indicadores: indicadores((id) => nomeDe.get(id) === nome) }))
}
