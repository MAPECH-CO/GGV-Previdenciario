// Transcrição de verdade (GGVP-133): o que o motor de IA devolve ao arrumar o texto e a chave temporária do texto ao vivo.
import { z } from 'zod'
import { CampoDaConversa } from './conversas.ts'

/** CA3, CA5: o texto arrumado com o glossário, fala por fala, e quem é cada falante. O original fica guardado ao lado. */
export const TranscricaoArrumadaPelaIa = z.object({
  falantes: z.record(z.string(), z.enum(['escritorio', 'cliente', 'terceiro'])),
  falas: z.array(z.object({ i: z.number().int(), texto: z.string().trim().min(1) })),
})
export type TranscricaoArrumadaPelaIa = z.infer<typeof TranscricaoArrumadaPelaIa>

/** POST /api/transcricao/chave-temporaria (CA4): a chave temporária do texto ao vivo; a chave de verdade fica no servidor. */
export const ChaveAoVivo = z.object({ chave: z.string(), expiraEm: z.string(), modelo: z.string() })
export type ChaveAoVivo = z.infer<typeof ChaveAoVivo>

/**
 * GGVP-140 CA1: o que a IA leu na conversa transcrita: o resumo, cada coisa dita (o campo, o valor como foi dito e a fala de
 * onde saiu) e o combinado. O que mudou na ficha é o código que compara; a IA não decide nada (G14).
 */
export const AnaliseDaConversaPelaIa = z.object({
  resumo: z.string().trim().min(1),
  ditos: z
    .array(z.object({ campo: CampoDaConversa, valor: z.string().trim().min(1), i: z.number().int().min(0), saude: z.boolean().optional() }))
    .default([]),
  combinado: z.string().trim().min(1).nullable().default(null),
})
export type AnaliseDaConversaPelaIa = z.infer<typeof AnaliseDaConversaPelaIa>
