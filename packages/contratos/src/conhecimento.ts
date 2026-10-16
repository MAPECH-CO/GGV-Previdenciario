// A base histórica do escritório no portal (GGVP-163): o que o portal lê das vistas `conhecimento.portal_*`. Toda taxa
// sai com o número de casos e a data da base (G22); o número é código (G19). Só o Jurídico e o Sócio (`estudo.ver`).
import { z } from 'zod'

/** Um indicador do recorte geral ou por ano: `n` casos, `sim` favoráveis, `valor` de 0 a 1 (nulo sem caso). */
export const IndicadorHistorico = z.object({
  indicador: z.string(),
  nome: z.string(),
  /** `geral` ou `ano`. */
  recorte: z.string(),
  chave: z.string(),
  n: z.number().int(),
  sim: z.number().int().nullable(),
  valor: z.number().nullable(),
  /** AAAA-MM-DD. */
  baseEm: z.string().nullable(),
})
export type IndicadorHistorico = z.infer<typeof IndicadorHistorico>

/** GET /api/base-historica/:beneficio (R5): a síntese e as taxas do benefício; `dataDaBase` nula sem a base. */
export const BaseHistoricaDoBeneficio = z.object({
  beneficio: z.string(),
  nome: z.string(),
  /** AAAA-MM-DD, lida da base a cada pedido (CA4). Nula quando não há base histórica. */
  dataDaBase: z.string().nullable(),
  /** A síntese em Markdown, na ordem. */
  sintese: z.array(z.object({ ordem: z.number().int(), materia: z.string().nullable(), texto: z.string() })),
  indicadores: z.array(IndicadorHistorico),
})
export type BaseHistoricaDoBeneficio = z.infer<typeof BaseHistoricaDoBeneficio>

/** R3: os fundamentos históricos do juízo, contados em código, por tipo e benefício, com processos de exemplo. */
export const FundamentosDoJuizo = z.object({
  /** Processos distintos do juízo na base. */
  processos: z.number().int(),
  grupos: z.array(
    z.object({
      /** `fundamento` ou `acordao`. */
      tipo: z.string(),
      beneficio: z.string(),
      nome: z.string(),
      processos: z.number().int(),
      exemplos: z.array(z.object({ processo: z.string(), texto: z.string() })),
    }),
  ),
})
export type FundamentosDoJuizo = z.infer<typeof FundamentosDoJuizo>
