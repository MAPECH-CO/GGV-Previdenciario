// Contrato da linha do tempo da deficiência (GGVP-42), ligada no servidor (GGVP-132). Espelha `DadosDaDeficiencia` das
// telas (apps/web/src/regras/deficiencia.ts); a regra (data não futura, agravamento só sobe) é a mesma das telas.
import { z } from 'zod'

const DataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const GrauDaDeficiencia = z.enum(['leve', 'moderada', 'grave'])

/** PUT /api/processos/:id/deficiencia: quem registra e quando vêm da sessão. */
export const DadosDaDeficiencia = z.object({
  inicio: DataIso,
  grau: GrauDaDeficiencia,
  /** O grau muda a partir de cada data (CA2). */
  agravamentos: z.array(z.object({ data: DataIso, grau: GrauDaDeficiencia })).max(20),
  /** O mínimo da LC 142 muda com o sexo. */
  sexo: z.enum(['feminino', 'masculino']),
})
export type DadosDaDeficiencia = z.infer<typeof DadosDaDeficiencia>
