// Contratos do parecer de suficiência da documentação médica (GGVP-20, GGVP-33), ligado no servidor (GGVP-132). Espelham
// os tipos das telas (apps/web/src/regras/parecerDoCaso.ts); as regras (cada item conferido, G18, G20) são as mesmas das
// telas, rodando no servidor. A dispensa por duas Sêniores usa `DispensarParecer` e `ResponderDispensa` (inss.ts).
import { z } from 'zod'

export const SituacaoDoItem = z.enum(['presente', 'ausente', 'contraditorio'])

/** POST /api/processos/:id/parecer: o que a pessoa do Jurídico conferiu e decidiu; quem e quando vêm da sessão. */
export const PedidoDeParecer = z.object({
  /** O `quando` da análise que a tela mostrou: se mudou, a tela abre de novo. */
  analise: z.string().max(40),
  conferidos: z.record(z.string().max(60), SituacaoDoItem),
  decisao: z.enum(['suficiente', 'insuficiente']),
  abordar: z.string().max(1000).optional(),
  conferenciaManual: z.string().max(1000).optional(),
})
export type PedidoDeParecer = z.infer<typeof PedidoDeParecer>

/** POST /api/processos/:id/complemento/tentativas (GGVP-29 CA3): "Ligar" ou o envio pelo Chatwoot; quem vem da sessão. */
export const TentativaDoComplemento = z.object({ canal: z.enum(['chatwoot', 'ligacao']), resultado: z.enum(['sem-resposta', 'respondeu']) })
export type TentativaDoComplemento = z.infer<typeof TentativaDoComplemento>

/** POST /api/processos/:id/complemento/decisoes (GGVP-29 CA3, G15): a Sênior no limite dá nova tentativa com prazo. */
export const DecisaoDoComplemento = z.object({
  justificativa: z.string().trim().min(5, 'A justificativa é obrigatória.').max(1000),
  /** aaaa-mm-dd: o novo prazo, depois de hoje (a regra da tela confere). */
  prazo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe o novo prazo, depois de hoje (dd/mm/aaaa).'),
})
export type DecisaoDoComplemento = z.infer<typeof DecisaoDoComplemento>
