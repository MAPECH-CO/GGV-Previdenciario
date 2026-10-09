// Jurimetria do juízo (GGVP-64): os números do juízo do processo, calculados em código a partir do acervo, e os
// entendimentos recorrentes, que a IA tira das decisões (parte 2). Só para o Jurídico; toda taxa com o número de
// processos e a data da base, sem amostra mínima (G22, regra de 07/10).
import { z } from 'zod'

/** CA2, CA5: um entendimento que se repete nas decisões de mérito do juízo, com os processos de exemplo; sem porcentagem. */
export const EntendimentoDoJuizo = z.object({ texto: z.string().trim().min(1), processos: z.array(z.string().trim().min(1)).min(1) })
export type EntendimentoDoJuizo = z.infer<typeof EntendimentoDoJuizo>
/** O que a IA devolve: até 5 entendimentos. O código ainda confere os processos contra as decisões lidas. */
export const EntendimentosDoJuizo = z.object({ entendimentos: z.array(EntendimentoDoJuizo).max(5) })
export type EntendimentosDoJuizo = z.infer<typeof EntendimentosDoJuizo>

/** GET /api/casos/:id/juizo. O juízo é o tribunal e a unidade de origem do número CNJ, como "TRF3 · 6301". */
export const JurimetriaDoJuizo = z.object({
  juizo: z.string(),
  /** Parte 2 (CA1): a vara e o juiz do caso, conferidos na leitura da publicação; nulos enquanto ninguém conferiu. */
  vara: z.string().nullable(),
  juiz: z.string().nullable(),
  /** Parte 2 (CA2, CA5): o que se repete nas decisões do juízo; lista vazia enquanto a IA não leu. */
  entendimentos: z.array(EntendimentoDoJuizo),
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
