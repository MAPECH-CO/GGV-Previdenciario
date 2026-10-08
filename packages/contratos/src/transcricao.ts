// Transcrição de verdade (GGVP-133): o que o motor de IA devolve ao arrumar o texto e a chave temporária do texto ao vivo.
import { z } from 'zod'

/** CA3, CA5: o texto arrumado com o glossário, fala por fala, e quem é cada falante. O original fica guardado ao lado. */
export const TranscricaoArrumadaPelaIa = z.object({
  falantes: z.record(z.string(), z.enum(['escritorio', 'cliente', 'terceiro'])),
  falas: z.array(z.object({ i: z.number().int(), texto: z.string().trim().min(1) })),
})
export type TranscricaoArrumadaPelaIa = z.infer<typeof TranscricaoArrumadaPelaIa>

/** POST /api/transcricao/chave-temporaria (CA4): a chave temporária do texto ao vivo; a chave de verdade fica no servidor. */
export const ChaveAoVivo = z.object({ chave: z.string(), expiraEm: z.string(), modelo: z.string() })
export type ChaveAoVivo = z.infer<typeof ChaveAoVivo>
