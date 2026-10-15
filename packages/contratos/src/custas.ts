// Custas do processo (GGVP-157, Lucas 13/10): o que se gastou e o que se ganhou em cada caso. A Sênior lança, o Financeiro
// confere o comprovante e aprova; o que ele mesmo lança já entra aprovado. É custo do escritório: não é cobrado do cliente
// nem entra na prestação de contas. As contas são código com teste, em centavos (G19).
import { dataParaIso, normalizarDecimal, validarData } from '@ggv/campos'
import { z } from 'zod'
import { Mes, ORIGENS_DA_RECEITA } from './financeiro.ts'

export const SITUACOES_DO_CUSTO = ['esperando', 'aprovado', 'recusado', 'cancelado'] as const
export type SituacaoDoCusto = (typeof SITUACOES_DO_CUSTO)[number]
export const ROTULO_SITUACAO_DO_CUSTO: Record<SituacaoDoCusto, string> = {
  esperando: 'Esperando o Financeiro',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
}

export const MSG_SEM_COMPROVANTE = 'Anexe o comprovante (foto ou PDF) para enviar.'

/** Valor em texto decimal com ponto ("1234.56"), como a prestação de contas. */
const Dinheiro = z.string()
const Data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
/** Até 2 casas: o banco guarda em centavos (numeric 14,2). */
const emCentavos = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6

/**
 * POST /api/casos/:id/custas (formulário com o comprovante) e a correção: a data em dd/mm/aaaa, a descrição livre (não há
 * lista de tipos) e o valor em reais ("1.234,56"). Sai com a data ISO e o valor "1234.56".
 */
export const LancarCusto = z.object({
  data: z
    .string()
    .refine(validarData, 'Data inválida: use dd/mm/aaaa.')
    .transform((d) => dataParaIso(d) as string),
  descricao: z.string().trim().min(1, 'Descreva o gasto.').max(200, 'Descreva em até 200 letras.'),
  valor: z.string().transform((v, ctx) => {
    const n = normalizarDecimal(v)
    if (n !== null && n > 0 && n < 1e10 && emCentavos(n)) return n.toFixed(2)
    ctx.addIssue({ code: 'custom', message: 'Valor inválido: use reais e centavos, maior que zero.' })
    return z.NEVER
  }),
})
export type LancarCusto = z.infer<typeof LancarCusto>

/** POST /api/casos/:id/custas/:custo/recusa: o Financeiro recusa com o motivo. */
export const RecusarCusto = z.object({ motivo: z.string().trim().min(1, 'Diga o motivo da recusa.').max(500, 'Motivo de até 500 letras.') })
export type RecusarCusto = z.infer<typeof RecusarCusto>

/** Um lançamento. O comprovante é obrigatório: todo lançamento tem um, em /api/casos/:id/custas/:custo/comprovante. */
export const CustoDoProcesso = z.object({
  id: z.uuid(),
  data: Data,
  descricao: z.string(),
  lancadoPor: z.string(),
  valor: Dinheiro,
  situacao: z.enum(SITUACOES_DO_CUSTO),
  /** O motivo da recusa. */
  motivo: z.string().nullable(),
})
export type CustoDoProcesso = z.infer<typeof CustoDoProcesso>

/** Ganhos (honorários recebidos), custos aprovados, lucro (ganhos − custos aprovados) e o que espera o Financeiro. */
export const TotaisDasCustas = z.object({ ganhos: Dinheiro, custos: Dinheiro, lucro: Dinheiro, esperando: Dinheiro })
export type TotaisDasCustas = z.infer<typeof TotaisDasCustas>

/** GET /api/casos/:id/custas (`custas.ver`): o card do processo e o detalhe do Financeiro. */
export const CustasDoProcesso = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  beneficio: z.string().nullable(),
  origem: z.enum(ORIGENS_DA_RECEITA),
  totais: TotaisDasCustas,
  lancamentos: z.array(CustoDoProcesso),
  podeLancar: z.boolean(),
  podeAprovar: z.boolean(),
})
export type CustasDoProcesso = z.infer<typeof CustasDoProcesso>

/** GET /api/custas?mes=aaaa-mm (`valores.ver`: Financeiro e Sócio): o que aprovar e os totais do mês por processo. */
export const VisaoDasCustas = z.object({
  mes: Mes,
  /** Todos os que esperam o Financeiro, de qualquer mês. */
  paraAprovar: z.array(CustoDoProcesso.extend({ casoId: z.uuid(), cliente: z.string() })),
  porProcesso: z.array(TotaisDasCustas.extend({ casoId: z.uuid(), cliente: z.string() })),
  totalDoMes: TotaisDasCustas,
})
export type VisaoDasCustas = z.infer<typeof VisaoDasCustas>

const centavos = (valor: string) => Math.round(Number(valor) * 100)
const reais = (c: number) => (c / 100).toFixed(2)

/** As contas de um processo (CA4): soma em centavos inteiros; cancelado e recusado não contam. */
export function somarCustas(ganhos: readonly string[], custos: readonly { valor: string; situacao: SituacaoDoCusto }[]): TotaisDasCustas {
  const soma = (situacao: SituacaoDoCusto) => custos.filter((c) => c.situacao === situacao).reduce((t, c) => t + centavos(c.valor), 0)
  const g = ganhos.reduce((t, v) => t + centavos(v), 0)
  const aprovados = soma('aprovado')
  return { ganhos: reais(g), custos: reais(aprovados), lucro: reais(g - aprovados), esperando: reais(soma('esperando')) }
}

type Ganho = { casoId: string; valor: string; dia: string }
type Custo = { casoId: string; valor: string; situacao: SituacaoDoCusto; data: string }

/**
 * CA6: os totais do mês por processo. O ganho conta no dia em que o Financeiro recebeu a prestação; o custo, na data do
 * gasto. Entra o processo com ganho ou custo (de qualquer situação) no mês.
 */
export function custasDoMes(ganhos: readonly Ganho[], custos: readonly Custo[], mes: string) {
  const g = ganhos.filter((x) => x.dia.startsWith(mes))
  const c = custos.filter((x) => x.data.startsWith(mes))
  const casos = [...new Set([...g, ...c].map((x) => x.casoId))]
  const porProcesso = casos.map((casoId) => ({
    casoId,
    ...somarCustas(
      g.filter((x) => x.casoId === casoId).map((x) => x.valor),
      c.filter((x) => x.casoId === casoId),
    ),
  }))
  return { porProcesso, totalDoMes: somarCustas(g.map((x) => x.valor), c) }
}
