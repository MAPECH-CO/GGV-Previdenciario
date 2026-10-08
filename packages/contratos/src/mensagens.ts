// Contratos das mensagens ao cliente ligadas no servidor (GGVP-138, telas da GGVP-102). Espelham os tipos das telas
// (apps/web/src/dados/mensagens.ts); o catálogo de modelos e o que o texto não pode ter (G9, G11, G20) são as regras
// puras de apps/web/src/regras/mensagens.ts, que o servidor importa.
import { z } from 'zod'

export const IdDoModelo = z.enum([
  'convite',
  'lembrete',
  'confirmacao',
  'boas-vindas',
  'cobranca',
  'complemento',
  'resultado-favoravel',
  'resultado-desfavoravel',
  'pericia-orientacao',
  'pericia-presenca',
  'aviso-de-mudanca',
])
export type IdDoModelo = z.infer<typeof IdDoModelo>

/** POST /api/fichas/:id/mensagens: o texto revisado, a conversa do cliente no Chatwoot e o processo (CA1, CA6). */
export const PedidoDeMensagem = z.object({
  modelo: IdDoModelo,
  texto: z.string().trim().min(1).max(1000),
  conversa: z.number().int().min(0),
  processoId: z.string().uuid().optional(),
  /** A tela de origem já põe o contato no card: aqui fica só o registro do envio. */
  noCard: z.literal(false).optional(),
})
export type PedidoDeMensagem = z.infer<typeof PedidoDeMensagem>

/** O contato do cliente na central do Chatwoot (CA6). */
export const ContatoChatwoot = z.object({ id: z.number(), nome: z.string(), telefone: z.string() })
export type ContatoChatwoot = z.infer<typeof ContatoChatwoot>

/** Uma conversa do contato no Chatwoot; a de mais mensagens vem primeiro (CA6). */
export const ConversaChatwoot = z.object({ id: z.number(), caixa: z.string(), situacao: z.enum(['aberta', 'resolvida']), mensagens: z.number(), ultimaEm: z.string() })
export type ConversaChatwoot = z.infer<typeof ConversaChatwoot>

/** GET /api/fichas/:id/mensagens/:modelo: a mensagem pronta para revisar, com a trava do modelo e o cliente no Chatwoot. */
export const MensagemPronta = z.object({
  modelo: IdDoModelo,
  texto: z.string(),
  editavel: z.boolean(),
  trava: z.string().nullable(),
  contato: ContatoChatwoot.nullable(),
  conversas: z.array(ConversaChatwoot),
})
export type MensagemPronta = z.infer<typeof MensagemPronta>

/** O registro de cada envio (CA4): o texto final, o canal, a data e a hora, e o status de entrega. */
export const MensagemAoCliente = z.object({
  id: z.string(),
  fichaId: z.string(),
  processoId: z.string().optional(),
  modelo: IdDoModelo,
  texto: z.string(),
  canal: z.literal('Chatwoot'),
  /** A conversa do cliente no Chatwoot; 0 quando o Chatwoot não achou o contato. */
  conversa: z.number(),
  quando: z.string(),
  quem: z.string(),
  status: z.enum(['enviada', 'entregue', 'lida', 'falhou']),
  /** O motivo do Chatwoot quando não saiu (CA5). */
  erro: z.string().optional(),
})
export type MensagemAoCliente = z.infer<typeof MensagemAoCliente>
