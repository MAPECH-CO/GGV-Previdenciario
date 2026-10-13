// Contratos do benefício deferido (GGVP-44): prestação de contas, recebimento e ida ao banco. Tela e servidor usam o mesmo.
import { normalizarDecimal, normalizarInteiro } from '@ggv/campos'
import { z } from 'zod'
import { DataObrigatoria } from './inss.ts'

/** GGVP-158 P6.3: de onde veio cada valor da prestação (GGVP-92 CA3). Quem decide a fonte é o servidor, nunca a tela. */
export const FONTES_DA_PRESTACAO = ['contrato', 'sistema', 'conferencia', 'carta'] as const
export type FonteDaPrestacao = (typeof FONTES_DA_PRESTACAO)[number]
export const ROTULO_FONTE_DA_PRESTACAO: Record<FonteDaPrestacao, string> = {
  contrato: 'Do contrato',
  sistema: 'Calculado pelo sistema',
  conferencia: 'Informado por quem conferiu',
  carta: 'Conferido com a carta de concessão',
}
const Fonte = z.enum(FONTES_DA_PRESTACAO).nullable()
/** A fonte de cada valor; nula quando o valor não existe (sem entrada, sem parcelas, nada na Caixa). */
export const FontesDaPrestacao = z.object({
  valorRecebido: Fonte,
  percentual: Fonte,
  honorarios: Fonte,
  repasse: Fonte,
  entrada: Fonte,
  parcelas: Fonte,
  parteNaCaixa: Fonte,
})
export type FontesDaPrestacao = z.infer<typeof FontesDaPrestacao>

/** As parcelas combinadas, como o servidor devolve: quantas e o valor de cada uma, em texto decimal com ponto. */
const ParcelasNaPrestacao = z.object({ quantidade: z.number(), valor: z.string() })

/** Uma versão da prestação (CA6). Valores em texto decimal com ponto ("1234.56"), calculados no servidor. */
export const VersaoDaPrestacao = z.object({
  versao: z.number(),
  valorRecebido: z.string(),
  percentual: z.string().nullable(),
  honorarios: z.string(),
  repasse: z.string(),
  formaPagamento: z.string().nullable(),
  prazoPagamento: z.string().nullable(),
  por: z.string().nullable(),
  em: z.string().nullable(),
  recebidaPor: z.string().nullable(),
  recebidaEm: z.string().nullable(),
  divergencia: z.string().nullable(),
  // GGVP-158 P6.3: o combinado, a parte paga na Caixa e a fonte de cada valor. Nulos nas versões de antes (e no teste de
  // tela que monta a prestação à mão).
  entrada: z.string().nullable().default(null),
  parcelas: ParcelasNaPrestacao.nullable().default(null),
  parteNaCaixa: z.string().nullable().default(null),
  fontes: FontesDaPrestacao.nullable().default(null),
})
export type VersaoDaPrestacao = z.infer<typeof VersaoDaPrestacao>

/** GET /api/casos/:id/prestacao (só `prestacao.ver`: Financeiro, advogada, Sênior e Sócio, CA2). */
export const PrestacaoDoCaso = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  beneficio: z.string().nullable(),
  carta: z.object({ id: z.uuid(), nome: z.string() }).nullable(),
  percentualContrato: z.string().nullable(),
  /** GGVP-158 P6.3: a entrada e as parcelas do contrato da Recepção, para a prestação abrir com elas. Nulo sem o combinado. */
  acordo: z.object({ entrada: z.string(), parcelas: ParcelasNaPrestacao.nullable() }).nullable().default(null),
  versoes: z.array(VersaoDaPrestacao),
  agendamento: z.object({ quando: z.string(), local: z.string(), acompanhante: z.string().nullable() }).nullable(),
  podeEditar: z.boolean(),
  podeReceber: z.boolean(),
})
export type PrestacaoDoCaso = z.infer<typeof PrestacaoDoCaso>

const Decimal = (mensagem: string, maximo = Number.MAX_SAFE_INTEGER / 100) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'number' ? v : normalizarDecimal(v)))
    .refine((n) => n !== null && n >= 0 && n <= maximo, mensagem)
    .transform((n) => n as number)

const Inteiro = (mensagem: string, minimo: number, maximo: number) =>
  z
    .union([z.string(), z.number()], { error: mensagem })
    .transform((v) => (typeof v === 'number' ? (Number.isInteger(v) ? v : null) : normalizarInteiro(v)))
    .refine((n) => n !== null && n >= minimo && n <= maximo, mensagem)
    .transform((n) => n as number)

export const MSG_VALOR_DA_PARCELA = 'Informe o valor de cada parcela, como 1.234,56'
/** As parcelas combinadas no contrato: quantas e o valor de cada uma. ponytail: parcelas iguais; lista, se o escritório pedir. */
const ParcelasDoAcordo = z.object(
  {
    quantidade: Inteiro('Informe quantas parcelas (de 1 a 60)', 1, 60),
    valor: Decimal(MSG_VALOR_DA_PARCELA).refine((n) => n > 0, MSG_VALOR_DA_PARCELA),
  },
  { error: 'Informe quantas parcelas e o valor de cada uma' },
)

/**
 * GGVP-158 P6.2: o que foi combinado com o cliente no contrato (Lucas, GGVP-92, 06/10): a entrada e as parcelas. Fica no
 * contrato da Recepção, e a prestação de contas abre com ele. Sem parcelas: `null`.
 */
export const AcordoDoContrato = z.object({
  entrada: Decimal('Informe o valor da entrada, como 1.234,56'),
  parcelas: ParcelasDoAcordo.nullable(),
})
export type AcordoDoContrato = z.output<typeof AcordoDoContrato>

/**
 * Opções fechadas, para o painel não ter "débito" e "Debito" (ajuste do Mateus em 05/10). A lista fica com as quatro para
 * ler as versões antigas; a prestação nova só aceita `FORMAS_ACEITAS` (GGVP-158 P6.3), e a tela passa a ela com o Pedro.
 */
export const FORMAS_DE_PAGAMENTO = ['pix', 'transferencia', 'boleto', 'dinheiro'] as const
/** Lucas, 07/10: Pix ou boleto emitido pelo escritório no nome do cliente; uma parte pode ser paga na Caixa. */
export const FORMAS_ACEITAS = ['pix', 'boleto'] as const
export const ROTULO_FORMA_DE_PAGAMENTO: Record<(typeof FORMAS_DE_PAGAMENTO)[number], string> = {
  pix: 'Pix',
  transferencia: 'Transferência bancária',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
}
const vazioEhNada = (v: unknown) => (v === '' || v === null ? undefined : v)

/** POST /api/casos/:id/prestacao (CA5): concluir exige a conferência com a carta. Honorários e repasse são do servidor. */
export const SalvarPrestacao = z.object({
  valorRecebido: Decimal('Informe o valor recebido (atrasados), como 1.234,56').refine((n) => n > 0, 'Informe o valor recebido (atrasados), como 1.234,56'),
  percentual: Decimal('Informe o percentual de honorários do contrato (0 a 100)', 100),
  formaPagamento: z.preprocess(vazioEhNada, z.enum(FORMAS_ACEITAS, { error: 'Escolha a forma de pagamento da lista' }).optional()),
  prazoPagamento: DataObrigatoria('Informe o prazo de pagamento (dd/mm/aaaa)'),
  conferiCarta: z.literal(true, { error: 'Marque "Conferi os valores com a carta de concessão"' }),
  // GGVP-158 P6.3: o resultado abre editável (Lucas, 06/10): os honorários ajustados por quem confere, o combinado do
  // contrato e a parte paga na Caixa, quando o escritório vai junto (07/10). Sem custas por enquanto.
  honorarios: z.preprocess(vazioEhNada, Decimal('Informe os honorários, como 1.234,56').optional()),
  entrada: z.preprocess(vazioEhNada, Decimal('Informe o valor da entrada, como 1.234,56').optional()),
  parcelas: z.preprocess(vazioEhNada, ParcelasDoAcordo.optional()),
  parteNaCaixa: z.preprocess(vazioEhNada, Decimal('Informe a parte paga na Caixa, como 1.234,56').optional()),
}).superRefine((d, ctx) => {
  if (d.honorarios !== undefined && d.honorarios > d.valorRecebido) {
    ctx.addIssue({ code: 'custom', path: ['honorarios'], message: MSG_HONORARIOS_ACIMA })
  } else if (d.parteNaCaixa !== undefined && d.parteNaCaixa > Number(calcularPrestacao(d.valorRecebido, d.percentual, d.honorarios).honorarios)) {
    ctx.addIssue({ code: 'custom', path: ['parteNaCaixa'], message: MSG_CAIXA_ACIMA })
  }
})
export type SalvarPrestacao = z.input<typeof SalvarPrestacao>
export const MSG_HONORARIOS_ACIMA = 'Os honorários vão até o valor recebido.'
export const MSG_CAIXA_ACIMA = 'A parte paga na Caixa vai até o valor dos honorários.'

/** POST /api/casos/:id/prestacao/recebimento (GGVP-44 CA9; GGVP-98 CA3: lançar só com os valores conferidos). */
export const ReceberPrestacao = z.discriminatedUnion(
  'resultado',
  [
    z.object({ resultado: z.literal('recebido'), valoresConferem: z.literal(true, { error: 'Marque "Valores conferem com o comprovante"' }) }),
    z.object({ resultado: z.literal('divergencia'), motivo: z.string().trim().min(1, 'Escreva qual é a divergência') }),
  ],
  { error: 'Escolha "Recebido" ou "Divergência"' },
)
export type ReceberPrestacao = z.infer<typeof ReceberPrestacao>

/** GET /api/casos/:id/banco: o Financeiro avisa e marca a ida ao banco (GGVP-98, Lucas 06/10). */
export const IdaAoBancoDoCaso = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  agendamento: z.object({ id: z.uuid(), data: z.string(), hora: z.string(), local: z.string(), acompanhante: z.string().nullable() }).nullable(),
  /** Quem pode levar o cliente ao banco: o Atendimento (GGVP-98 CA6). */
  equipe: z.array(z.object({ id: z.uuid(), nome: z.string() })),
  /** Texto montado pelo modelo aprovado, para a pessoa revisar antes de enviar (Q5). `null`: sem modelo ou sem agendamento. */
  mensagem: z.string().nullable(),
  modeloCadastrado: z.boolean(),
  okAdvogada: z.boolean(),
  avisos: z.array(z.object({ quando: z.string(), canal: z.string(), texto: z.string(), quem: z.string() })),
  podeAgendar: z.boolean(),
  /** GGVP-98 CA9: depois do aviso, o Financeiro confirma o recebimento e o caso fecha. */
  podeConfirmar: z.boolean(),
  encerrado: z.boolean(),
})
export type IdaAoBancoDoCaso = z.infer<typeof IdaAoBancoDoCaso>

/**
 * POST /api/casos/:id/banco (CA10, CA12 e GGVP-98 CA6): data, hora, local e quem acompanha obrigatórios. Quem acompanha
 * é do Atendimento. O servidor recusa data ou hora que já passou.
 */
export const AgendarIdaAoBanco = z.object({
  data: DataObrigatoria('Informe a data da ida ao banco (dd/mm/aaaa)'),
  hora: z.string({ error: 'Informe a hora (hh:mm)' }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe a hora (hh:mm)'),
  local: z.string({ error: 'Informe a agência ou o local' }).trim().min(1, 'Informe a agência ou o local'),
  acompanhanteId: z.preprocess(vazioEhNada, z.uuid({ error: 'Escolha quem do Atendimento acompanha o cliente' })),
})
export type AgendarIdaAoBanco = z.input<typeof AgendarIdaAoBanco>

/** GET /api/casos/:id/banco/levar: a visita de quem leva o cliente (GGVP-98, Atendimento). Sem valores: o Atendimento não vê valor. */
export const LevarAoBancoDoCaso = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  data: z.string(),
  hora: z.string(),
  local: z.string(),
  acompanhante: z.string().nullable(),
  oQueLevar: z.array(z.string()),
})
export type LevarAoBancoDoCaso = z.infer<typeof LevarAoBancoDoCaso>

/** POST /api/casos/:id/banco/levar: "Levei o cliente ao banco", ou "Não deu" com o motivo, que volta ao Financeiro remarcar. */
export const ConcluirIdaAoBanco = z.discriminatedUnion(
  'resultado',
  [
    z.object({ resultado: z.literal('levado') }),
    z.object({ resultado: z.literal('nao_deu'), motivo: z.string({ error: 'Escreva por que não deu' }).trim().min(1, 'Escreva por que não deu') }),
  ],
  { error: 'Escolha "Levei o cliente ao banco" ou "Não deu"' },
)
export type ConcluirIdaAoBanco = z.infer<typeof ConcluirIdaAoBanco>

export const CANAIS_DE_AVISO = ['whatsapp', 'telefone', 'email', 'sms'] as const

/** POST /api/casos/:id/banco/envio (CA3, CA11): a pessoa revisou o texto do modelo e enviou; o servidor registra. */
export const RegistrarEnvio = z.object({ canal: z.enum(CANAIS_DE_AVISO, { error: 'Escolha o canal' }) })
export type RegistrarEnvio = z.infer<typeof RegistrarEnvio>

// Valores da prestação (CA5). Regra numérica é código, a mesma na tela (prévia) e no servidor: em centavos inteiros,
// honorários pelo percentual do contrato arredondados para baixo (a favor do cliente) e repasse = recebido − honorários.
const paraCentavos = (valor: number) => Math.round(valor * 100)
const paraTexto = (centavos: number) => (centavos / 100).toFixed(2)

/**
 * GGVP-158 P6.3: com os honorários ajustados por quem confere, vale o ajuste (até o recebido: o contrato `SalvarPrestacao`
 * recusa acima); sem eles, o percentual. O repasse é sempre o recebido menos os honorários, e a conta fecha em centavos.
 */
export function calcularPrestacao(valorRecebido: number, percentual: number, honorariosAjustados?: number) {
  const recebido = paraCentavos(valorRecebido)
  // Percentual com até duas casas, em centésimos de ponto (30,5% → 3050), para a conta ficar inteira.
  const pelaPercentagem = Math.floor((recebido * Math.round(percentual * 100)) / 10_000)
  const honorarios = honorariosAjustados === undefined ? pelaPercentagem : Math.min(paraCentavos(honorariosAjustados), recebido)
  return { valorRecebido: paraTexto(recebido), honorarios: paraTexto(honorarios), repasse: paraTexto(recebido - honorarios) }
}
