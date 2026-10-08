// Contratos do benefício deferido (GGVP-44): prestação de contas, recebimento e ida ao banco. Tela e servidor usam o mesmo.
import { normalizarDecimal } from '@ggv/campos'
import { z } from 'zod'
import { DataObrigatoria } from './inss.ts'

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
})
export type VersaoDaPrestacao = z.infer<typeof VersaoDaPrestacao>

/** GET /api/casos/:id/prestacao (só `prestacao.ver`: Financeiro e advogada, CA2). */
export const PrestacaoDoCaso = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  beneficio: z.string().nullable(),
  carta: z.object({ id: z.uuid(), nome: z.string() }).nullable(),
  percentualContrato: z.string().nullable(),
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

/** Opções fechadas, para o painel não ter "débito" e "Debito" (ajuste do Mateus em 05/10; lista a confirmar com o Lucas). */
export const FORMAS_DE_PAGAMENTO = ['pix', 'transferencia', 'boleto', 'dinheiro'] as const
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
  formaPagamento: z.preprocess(vazioEhNada, z.enum(FORMAS_DE_PAGAMENTO, { error: 'Escolha a forma de pagamento da lista' }).optional()),
  prazoPagamento: DataObrigatoria('Informe o prazo de pagamento (dd/mm/aaaa)'),
  conferiCarta: z.literal(true, { error: 'Marque "Conferi os valores com a carta de concessão"' }),
})
export type SalvarPrestacao = z.input<typeof SalvarPrestacao>

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
 * é do Atendimento. O servidor recusa data que já passou.
 */
export const AgendarIdaAoBanco = z.object({
  data: DataObrigatoria('Informe a data da ida ao banco (dd/mm/aaaa)'),
  hora: z.string({ error: 'Informe a hora (hh:mm)' }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe a hora (hh:mm)'),
  local: z.string({ error: 'Informe a agência ou o local' }).trim().min(1, 'Informe a agência ou o local'),
  acompanhanteId: z.preprocess(vazioEhNada, z.uuid({ error: 'Escolha quem do Atendimento acompanha o cliente' })),
})
export type AgendarIdaAoBanco = z.input<typeof AgendarIdaAoBanco>

export const CANAIS_DE_AVISO = ['whatsapp', 'telefone', 'email', 'sms'] as const

/** POST /api/casos/:id/banco/envio (CA3, CA11): a pessoa revisou o texto do modelo e enviou; o servidor registra. */
export const RegistrarEnvio = z.object({ canal: z.enum(CANAIS_DE_AVISO, { error: 'Escolha o canal' }) })
export type RegistrarEnvio = z.infer<typeof RegistrarEnvio>

// Valores da prestação (CA5). Regra numérica é código, a mesma na tela (prévia) e no servidor: em centavos inteiros,
// honorários pelo percentual do contrato arredondados para baixo (a favor do cliente) e repasse = recebido − honorários.
const paraCentavos = (valor: number) => Math.round(valor * 100)
const paraTexto = (centavos: number) => (centavos / 100).toFixed(2)

export function calcularPrestacao(valorRecebido: number, percentual: number) {
  const recebido = paraCentavos(valorRecebido)
  // Percentual com até duas casas, em centésimos de ponto (30,5% → 3050), para a conta ficar inteira.
  const honorarios = Math.floor((recebido * Math.round(percentual * 100)) / 10_000)
  return { valorRecebido: paraTexto(recebido), honorarios: paraTexto(honorarios), repasse: paraTexto(recebido - honorarios) }
}
