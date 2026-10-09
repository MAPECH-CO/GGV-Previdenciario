// Painel Financeiro (GGVP-78; Figma "Financeiro · painel" 1930:4): os números saem das prestações de contas gravadas
// (GGVP-44, GGVP-98), calculados aqui, em código com teste. O que o banco não guarda (mensalidades, RPV e precatório,
// honorários previstos da safra), o painel não mostra.
import { z } from 'zod'

/** Mês "aaaa-mm", o período do painel. */
export const Mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mês inválido.')

/**
 * Os dois passos do Financeiro (GGVP-98): "Receber e lançar" a prestação e, depois da ida ao banco, "Confirmar
 * recebimento". Aguardando OK: a advogada ainda não deu o OK na prestação (ou corrige a divergência), e o aviso ao cliente
 * espera (G8). Lançar: o OK saiu e o Financeiro ainda não lançou. A receber: lançada, esperando a ida ao banco e a
 * confirmação. Atrasado: a receber com o prazo de pagamento vencido. Recebido: o Financeiro confirmou o recebimento.
 */
export const STATUS_DO_LANCAMENTO = ['aguardando_ok', 'a_lancar', 'atrasado', 'a_receber', 'recebido'] as const
export type StatusDoLancamento = (typeof STATUS_DO_LANCAMENTO)[number]
export const ROTULO_STATUS_DO_LANCAMENTO: Record<StatusDoLancamento, string> = {
  aguardando_ok: 'Aguardando OK',
  a_lancar: 'Lançar',
  atrasado: 'Atrasado',
  a_receber: 'A receber',
  recebido: 'Recebido',
}

/** De onde vem a receita: o deferimento no INSS ou o caso ganho na Justiça (Mateus, 07/10: um caminho para os dois). */
export const ORIGENS_DA_RECEITA = ['inss', 'justica'] as const
export type OrigemDaReceita = (typeof ORIGENS_DA_RECEITA)[number]
export const ROTULO_ORIGEM_DA_RECEITA: Record<OrigemDaReceita, string> = {
  inss: 'Honorários administrativos (INSS)',
  justica: 'Honorários de êxito (Justiça)',
}

/** Valor em texto decimal com ponto ("1234.56"), como a prestação de contas. */
const Dinheiro = z.string()
const Data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** Uma linha por caso: a versão atual da prestação, ou o caso que ainda espera o OK da advogada. */
export const LancamentoFinanceiro = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  beneficio: z.string().nullable(),
  /** CNJ ou NB formatado; sem número, nulo. */
  processo: z.string().nullable(),
  origem: z.enum(ORIGENS_DA_RECEITA),
  /** Os honorários do escritório; nulo enquanto a advogada não concluiu a primeira versão. */
  valor: Dinheiro.nullable(),
  /** O prazo de pagamento da prestação. */
  vencimento: Data.nullable(),
  /** O dia (Brasília) em que o Financeiro confirmou o recebimento, depois da ida ao banco (GGVP-98 CA9). */
  recebidoEm: Data.nullable(),
  status: z.enum(STATUS_DO_LANCAMENTO),
  responsavel: z.string(),
})
export type LancamentoFinanceiro = z.infer<typeof LancamentoFinanceiro>

/** GET /api/financeiro?mes=aaaa-mm (`valores.ver_totais`). `lancamentos` só para quem vê valores (`valores.ver`); senão nulo. */
export const PainelFinanceiro = z.object({
  mes: Mes,
  recebidoNoMes: Dinheiro,
  /** Variação sobre o mês anterior, em pontos percentuais inteiros; sem recebido no anterior, nula. */
  variacao: z.number().nullable(),
  aReceber: Dinheiro,
  processosAReceber: z.number(),
  emAtraso: Dinheiro,
  processosEmAtraso: z.number(),
  /** As prestações a lançar: com o OK da advogada e sem o lançamento do Financeiro, mais as que esperam o OK. */
  aLancar: z.number(),
  aguardandoOk: z.number(),
  /** De janeiro ao mês do período: o recebido (pelo dia da confirmação) e o previsto (pelo prazo de pagamento). */
  porMes: z.array(z.object({ mes: Mes, recebido: Dinheiro, previsto: Dinheiro })),
  /** O recebido nos 12 meses até o período, por origem; a fatia em pontos percentuais inteiros. */
  porOrigem: z.array(z.object({ origem: z.enum(ORIGENS_DA_RECEITA), valor: Dinheiro, fatia: z.number() })),
  lancamentos: z.array(LancamentoFinanceiro).nullable(),
})
export type PainelFinanceiro = z.infer<typeof PainelFinanceiro>

/** O que o servidor lê do banco para cada caso; o status e as contas saem daqui. `lancado`: o "Receber e lançar" feito. */
export type LinhaDoFinanceiro = Omit<LancamentoFinanceiro, 'status'> & { aguardandoOk: boolean; lancado: boolean }

const centavos = (valor: string | null) => (valor === null ? 0 : Math.round(Number(valor) * 100))
const reais = (c: number) => (c / 100).toFixed(2)
const soma = (linhas: { valor: string | null }[]) => linhas.reduce((t, l) => t + centavos(l.valor), 0)

/** "2026-01" → "2025-12"; `n` meses antes. */
export function mesAntes(mes: string, n = 1): string {
  const [ano, m] = mes.split('-').map(Number)
  const total = ano * 12 + (m - 1) - n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export function statusDoLancamento(l: Pick<LinhaDoFinanceiro, 'aguardandoOk' | 'lancado' | 'recebidoEm' | 'vencimento'>, hoje: string): StatusDoLancamento {
  if (l.aguardandoOk) return 'aguardando_ok'
  if (l.recebidoEm) return 'recebido'
  if (!l.lancado) return 'a_lancar'
  return l.vencimento && l.vencimento < hoje ? 'atrasado' : 'a_receber'
}

/** As contas do painel (GGVP-78, G19: número é código). `hoje` e `mes` no horário de Brasília. */
export function montarPainelFinanceiro(linhas: LinhaDoFinanceiro[], mes: string, hoje: string, comLancamentos: boolean): PainelFinanceiro {
  const todas = linhas
    .map(({ aguardandoOk, lancado, ...l }) => ({ ...l, status: statusDoLancamento({ aguardandoOk, lancado, ...l }, hoje) }))
    .sort((a, b) => STATUS_DO_LANCAMENTO.indexOf(a.status) - STATUS_DO_LANCAMENTO.indexOf(b.status) || (a.vencimento ?? '9').localeCompare(b.vencimento ?? '9') || a.cliente.localeCompare(b.cliente, 'pt-BR'))
  const recebidas = todas.filter((l) => l.status === 'recebido')
  const recebidoEm = (m: string) => soma(recebidas.filter((l) => l.recebidoEm!.startsWith(m)))
  const noMes = recebidoEm(mes)
  const anterior = recebidoEm(mesAntes(mes))
  const aReceber = todas.filter((l) => l.status === 'a_receber' || l.status === 'atrasado')
  const atrasadas = todas.filter((l) => l.status === 'atrasado')
  const aguardandoOk = todas.filter((l) => l.status === 'aguardando_ok').length
  const aLancar = todas.filter((l) => l.status === 'a_lancar').length
  const numeroDoMes = Number(mes.slice(5, 7))
  const meses = Array.from({ length: numeroDoMes }, (_, i) => mesAntes(mes, numeroDoMes - 1 - i))
  const comValor = todas.filter((l) => l.status !== 'aguardando_ok')
  const doze = new Set(Array.from({ length: 12 }, (_, i) => mesAntes(mes, i)))
  const naJanela = recebidas.filter((l) => doze.has(l.recebidoEm!.slice(0, 7)))
  const total = soma(naJanela)
  return {
    mes,
    recebidoNoMes: reais(noMes),
    variacao: anterior ? Math.round(((noMes - anterior) / anterior) * 100) : null,
    aReceber: reais(soma(aReceber)),
    processosAReceber: aReceber.length,
    emAtraso: reais(soma(atrasadas)),
    processosEmAtraso: atrasadas.length,
    aLancar: aLancar + aguardandoOk,
    aguardandoOk,
    porMes: meses.map((m) => ({ mes: m, recebido: reais(recebidoEm(m)), previsto: reais(soma(comValor.filter((l) => l.vencimento?.startsWith(m)))) })),
    porOrigem: total
      ? ORIGENS_DA_RECEITA.map((origem) => ({ origem, c: soma(naJanela.filter((l) => l.origem === origem)) }))
          .filter((o) => o.c > 0)
          .map(({ origem, c }) => ({ origem, valor: reais(c), fatia: Math.round((c / total) * 100) }))
      : [],
    lancamentos: comLancamentos ? todas : null,
  }
}
