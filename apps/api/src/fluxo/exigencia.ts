// Exigência do INSS (GGVP-39): perícia aberta pela exigência, volta à vigília e limites de cobrança (Q1).
import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { Banco } from '../banco/conexao.ts'
import { caso, configuracao, decisao, etapa, exigencia, exigenciaItem, pericia, pessoa, tarefa } from '../banco/esquema.ts'
import { diasUteisAte, feriadosNacionais } from './prazo-inss.ts'

type Tx = Parameters<Parameters<Banco['transaction']>[0]>[0]
type Tipo = 'medica' | 'social'

const NOME_PERICIA: Record<Tipo, string> = { medica: 'perícia médica', social: 'avaliação social' }

/** Limites do G15 vindos da configuração do escritório (GGVP-104). Sem configuração: `null`, e nada escala. */
export async function limitesDeCobranca(banco: Banco | Tx): Promise<{ limite: number | null; intervaloDias: number | null }> {
  const linhas = await banco
    .select()
    .from(configuracao)
    .where(inArray(configuracao.chave, ['cobranca.limite', 'cobranca.intervalo_dias']))
  const valor = (chave: string) => {
    const v = linhas.find((l) => l.chave === chave)?.valor
    return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null
  }
  return { limite: valor('cobranca.limite'), intervaloDias: valor('cobranca.intervalo_dias') }
}

/** Tipos de perícia que a advogada escolheu ao decidir a exigência (decisão D2.05, G5). */
export async function tiposDecididos(banco: Banco | Tx, casoId: string): Promise<Tipo[]> {
  const [d] = await banco
    .select({ justificativa: decisao.justificativa })
    .from(decisao)
    .where(and(eq(decisao.casoId, casoId), eq(decisao.passo, 'D2.05')))
    .orderBy(desc(decisao.decididoEm))
    .limit(1)
  return (d?.justificativa ?? '').split(',').filter((t): t is Tipo => t === 'medica' || t === 'social')
}

/** De onde vem a perícia: a exigência do INSS (D2.05), a do juiz (D3a, GGVP-79 CA8) ou o despacho da Sênior (D3, GGVP-54 CA5). */
export const ORIGEM_INSS = { diagrama: 'D2', passo: 'D2.05', rotulo: 'exigência do INSS' } as const
export const ORIGEM_JUIZ = { diagrama: 'D3a', passo: 'D3a.03', rotulo: 'exigência do juiz' } as const
export const ORIGEM_DESPACHO = { diagrama: 'D3', passo: 'D3.03', rotulo: 'despacho da Sênior' } as const
type Origem = typeof ORIGEM_INSS | typeof ORIGEM_JUIZ | typeof ORIGEM_DESPACHO

/** CA2, CA3, CA6: abre as perícias pedidas pela exigência e a tarefa do Jurídico administrativo, como a GGVP-31. */
export async function abrirPericiasDaExigencia(tx: Tx, casoId: string, tipos: Tipo[], quem: string, agora: Date, origem: Origem = ORIGEM_INSS) {
  const [e] = await tx
    .insert(etapa)
    .values({ casoId, diagrama: origem.diagrama, passo: origem.passo, situacao: 'concluida', iniciadaEm: agora, concluidaEm: agora, concluidaPor: quem })
    .returning()
  for (const tipo of tipos) await tx.insert(pericia).values({ casoId, tipo, chamadaPorEtapaId: e.id })
  await tx.insert(tarefa).values({ casoId, passo: 'DP.01', titulo: `Marcar ${tipos.map((t) => NOME_PERICIA[t]).join(' e ')} (${origem.rotulo})`, perfilDono: 'juridico_adm' })
  return e.id
}

/**
 * CA4: o caso espera o INSS analisar a resposta (espera `D2.E4`, código proposto). A vigília (`D2.04`) e a tarefa
 * "Trazer a resposta do INSS" continuam abertas desde o registro da exigência; não abre outra. Idempotente.
 */
export async function esperarAnaliseDoInss(tx: Tx | Banco, casoId: string, agora: Date) {
  const [aberta] = await tx
    .select({ id: etapa.id })
    .from(etapa)
    .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D2.E4'), isNull(etapa.concluidaEm)))
  if (!aberta) await tx.insert(etapa).values({ casoId, diagrama: 'D2', passo: 'D2.E4', situacao: 'aguardando_externo', aguardando: 'INSS analisar a resposta', iniciadaEm: agora })
}

/**
 * CA2: com o resultado de todas as perícias pedidas pela exigência, o caso volta para a vigília. Quem chama é o registro
 * do resultado da perícia (épico Perícia). Devolve `true` quando voltou.
 */
export async function avancarExigencia(banco: Banco, casoId: string, agora = new Date()): Promise<boolean> {
  const [x] = await banco
    .select()
    .from(exigencia)
    .where(and(eq(exigencia.casoId, casoId), eq(exigencia.origem, 'inss')))
    .orderBy(desc(exigencia.criadoEm))
    .limit(1)
  if (!x || x.pede === null || x.pede === 'documentos') return false
  // Perícia e documentos: a etapa das perícias só nasce depois da resposta com os documentos (CA6).
  const [e] = await banco
    .select({ id: etapa.id })
    .from(etapa)
    .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D2.05')))
    .orderBy(desc(etapa.iniciadaEm))
    .limit(1)
  if (!e) return false
  const chamadas = await banco.select({ resultado: pericia.resultado }).from(pericia).where(eq(pericia.chamadaPorEtapaId, e.id))
  if (chamadas.length === 0 || chamadas.some((p) => p.resultado === null)) return false
  await banco.transaction(async (tx) => {
    await tx.update(exigencia).set({ situacao: 'cumprida' }).where(eq(exigencia.id, x.id))
    await esperarAnaliseDoInss(tx, casoId, agora)
  })
  return true
}

export const EXIGENCIA_EM_CURSO = ['aberta', 'dilacao_pedida'] as const

/**
 * CA14 (G21; GGVP-87 CA4): exigências do INSS e do juiz com item pendente e prazo a 5 dias úteis ou menos, para a fila da Sênior.
 * Calculado ao montar a fila, sem agendador. `diasUteis` negativo: vencida.
 */
export async function alertasDeExigencia(banco: Banco, hoje: string) {
  const linhas = await banco
    .selectDistinct({ exigenciaId: exigencia.id, origem: exigencia.origem, casoId: exigencia.casoId, prazo: exigencia.prazo, cliente: { id: pessoa.id, nome: pessoa.nome }, beneficio: caso.beneficio })
    .from(exigencia)
    .innerJoin(exigenciaItem, and(eq(exigenciaItem.exigenciaId, exigencia.id), inArray(exigenciaItem.situacao, ['pendente', 'nao_cumprido'])))
    .innerJoin(caso, eq(exigencia.casoId, caso.id))
    .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
    .where(and(inArray(exigencia.situacao, [...EXIGENCIA_EM_CURSO]), isNotNull(exigencia.prazo)))
  const feriados = await feriadosNacionais(banco)
  return linhas
    .map((l) => ({ ...l, prazo: l.prazo!, diasUteis: diasUteisAte(hoje, l.prazo!, feriados) }))
    .filter((l) => l.diasUteis <= 5)
    .sort((a, b) => a.diasUteis - b.diasUteis)
}
