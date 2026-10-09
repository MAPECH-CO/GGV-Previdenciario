// Confirmar o desfecho de mérito (GGVP-90, CA3 e CA4; passo D4.02, a porta de entrada do D3b).
import { z } from 'zod'

/** As quatro respostas da advogada à decisão de mérito; a extinção sem mérito pede a causa (GGVP-37 CA5, GGVP-75 CA2). */
export const DESFECHOS_DE_MERITO = ['procedente_total', 'procedente_parcial', 'improcedente', 'extinto_sem_merito'] as const
export type DesfechoDeMerito = (typeof DESFECHOS_DE_MERITO)[number]
export const ROTULO_DESFECHO_DE_MERITO: Record<DesfechoDeMerito, string> = {
  procedente_total: 'Procedente',
  procedente_parcial: 'Procedente em parte',
  improcedente: 'Improcedente',
  extinto_sem_merito: 'Extinto sem julgar o mérito',
}
export const FORMAS_DE_PAGAMENTO_JUDICIAL = ['rpv', 'precatorio'] as const
export const ROTULO_FORMA_DE_PAGAMENTO_JUDICIAL: Record<(typeof FORMAS_DE_PAGAMENTO_JUDICIAL)[number], string> = { rpv: 'RPV', precatorio: 'Precatório' }
export const ehProcedente = (d: string) => d === 'procedente_total' || d === 'procedente_parcial'

/** POST /api/casos/:id/desfecho (CA3, CA4). */
export const ConfirmarDesfecho = z
  .object({
    desfecho: z.enum(DESFECHOS_DE_MERITO, { error: 'Escolha o desfecho da decisão' }),
    causa: z.string().trim().max(500, 'A causa vai até 500 letras').optional(),
    /** Só no procedente, e só quando já se sabe (CA4). */
    forma: z.enum(FORMAS_DE_PAGAMENTO_JUDICIAL).optional(),
  })
  .refine((d) => d.desfecho !== 'extinto_sem_merito' || Boolean(d.causa), { message: 'Escreva a causa da extinção sem mérito', path: ['causa'] })
  .refine((d) => !d.forma || ehProcedente(d.desfecho), { message: 'A forma de pagamento vale só para o procedente', path: ['forma'] })
export type ConfirmarDesfecho = z.infer<typeof ConfirmarDesfecho>

/** GET /api/casos/:id/desfecho: o que a tela mostra (CA3) e, depois, quem confirmou e quando (CA4). */
export const DesfechoParaConfirmar = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  beneficio: z.string().nullable(),
  /** A última decisão de mérito do caso, com a leitura da IA quando houver. */
  decisao: z
    .object({
      disponibilizadaEm: z.string(),
      fonte: z.string(),
      texto: z.string(),
      classeSugeridaIa: z.string().nullable(),
      confiancaIa: z.number().nullable(),
    })
    .nullable(),
  /** O prazo do recurso, contado em código na vigília (GGVP-34). */
  prazoRecurso: z.string().nullable(),
  confirmado: z
    .object({ desfecho: z.enum(DESFECHOS_DE_MERITO), causa: z.string().nullable(), forma: z.enum(FORMAS_DE_PAGAMENTO_JUDICIAL).nullable(), por: z.string(), em: z.string() })
    .nullable(),
  /** A tarefa "Confirmar desfecho" aberta e o perfil com a permissão (advogada ou Sênior). */
  podeConfirmar: z.boolean(),
})
export type DesfechoParaConfirmar = z.infer<typeof DesfechoParaConfirmar>
