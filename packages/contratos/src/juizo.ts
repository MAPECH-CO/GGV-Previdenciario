// Jurimetria do juízo (GGVP-64, parte 1): os números do juízo do processo, calculados em código a partir do acervo.
// Só para o Jurídico; toda taxa com o número de processos e a data da base, sem amostra mínima (G22, regra de 07/10).
import { z } from 'zod'

/** GET /api/casos/:id/juizo. O juízo é o tribunal e a unidade de origem do número CNJ, como "TRF3 · 6301". */
export const JurimetriaDoJuizo = z.object({
  juizo: z.string(),
  /** Data da base, AAAA-MM-DD: hoje, em Brasília. */
  base: z.string(),
  /** Procedentes (total ou parcial) sobre os decididos no mérito, só com desfecho conferido; `texto` no formato do G22. */
  porBeneficio: z.array(z.object({ beneficio: z.string(), nome: z.string(), procedentes: z.number().int(), decididos: z.number().int(), texto: z.string() })),
  /** Média, em meses, do protocolo da inicial à decisão, só dos processos com as duas datas; nulo quando nenhum tem. */
  tempoAteASentenca: z.object({ meses: z.number().int(), processos: z.number().int() }).nullable(),
  /** Os processos do juízo que entraram na conta. */
  processos: z.array(z.object({ numeroCnj: z.string(), desfecho: z.string() })),
})
export type JurimetriaDoJuizo = z.infer<typeof JurimetriaDoJuizo>
