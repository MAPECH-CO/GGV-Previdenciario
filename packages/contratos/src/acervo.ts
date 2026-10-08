// Acervo do escritório (GGVP-55, D4.05): a conferência dos desfechos lidos. Só o conferido entra nas contas (CA7).
import { z } from 'zod'

/** Os desfechos de um processo do acervo, como o Raio-X classifica (êxito = procedente, em parte ou acordo). */
export const DESFECHOS_DO_ACERVO = ['procedente_total', 'procedente_parcial', 'acordo', 'improcedente', 'extinto_sem_merito', 'desistencia'] as const
export type DesfechoDoAcervo = (typeof DESFECHOS_DO_ACERVO)[number]
export const ROTULO_DESFECHO_DO_ACERVO: Record<DesfechoDoAcervo, string> = {
  procedente_total: 'Procedente',
  procedente_parcial: 'Procedente em parte',
  acordo: 'Acordo',
  improcedente: 'Improcedente',
  extinto_sem_merito: 'Extinto sem mérito',
  desistencia: 'Desistência',
}

/** GET /api/acervo/conferencia: os processos com desfecho lido e sem conferência, e quantos já foram conferidos. */
export const ConferenciaDoAcervo = z.object({
  pendentes: z.array(
    z.object({
      id: z.uuid(),
      numeroCnj: z.string().nullable(),
      beneficio: z.string().nullable(),
      desfechoLido: z.string(),
      fonte: z.string(),
    }),
  ),
  conferidos: z.number().int(),
})
export type ConferenciaDoAcervo = z.infer<typeof ConferenciaDoAcervo>

/** POST /api/acervo/processos/:id/conferencia: o desfecho conferido, o mesmo lido ou o corrigido. */
export const ConferirDesfecho = z.object({ desfecho: z.enum(DESFECHOS_DO_ACERVO, { error: 'Escolha o desfecho' }) })
export type ConferirDesfecho = z.infer<typeof ConferirDesfecho>
