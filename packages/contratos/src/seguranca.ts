// Contratos da segurança do contato ligada no servidor (GGVP-138, telas da GGVP-111): terceiro não se passa pelo
// cliente. A forma é conferida aqui; o que falta para mudar (verificação, contrato novo, segunda confirmação) é a regra
// pura de apps/web/src/regras/seguranca.ts, que o servidor importa.
import { z } from 'zod'
import { VerificacaoInformada } from './conversas.ts'

/** Os dados para o repasse ao cliente. O formato da agência e da conta é conferido pela regra (`erroDosDadosBancarios`). */
export const DadosBancarios = z.object({ banco: z.string().trim().max(60), agencia: z.string().trim().max(10), conta: z.string().trim().max(20), pix: z.string().trim().max(80).optional() })
export type DadosBancarios = z.infer<typeof DadosBancarios>

/** POST /api/fichas/:id/dados-bancarios: o pedido, com a verificação do cliente (CA1, CA5). */
export const PedidoDeMudancaBancaria = z.object({ dados: DadosBancarios, verificacao: VerificacaoInformada.nullable().optional() })
export type PedidoDeMudancaBancaria = z.infer<typeof PedidoDeMudancaBancaria>

/** PATCH /api/fichas/:id: a verificação vai junto quando o telefone ou o e-mail mudam (CA1). */
export const VerificacaoDaEdicao = z.object({ verificacao: VerificacaoInformada.nullable().optional() })
export type VerificacaoDaEdicao = z.infer<typeof VerificacaoDaEdicao>

/** Os dados bancários em vigor de uma ficha, com quem pediu e desde quando valem. */
export const RegistroBancario = DadosBancarios.extend({ fichaId: z.string(), desde: z.string(), quem: z.string() })
export type RegistroBancario = z.infer<typeof RegistroBancario>

/** O pedido de mudança, esperando a segunda confirmação (CA5). */
export const PedidoBancario = z.object({
  fichaId: z.string(),
  dados: DadosBancarios,
  verificacao: z.object({ como: z.enum(['video', 'presencial']), contratoNovo: z.literal(true) }),
  pediu: z.string(),
  pedidoEm: z.string(),
})
export type PedidoBancario = z.infer<typeof PedidoBancario>
