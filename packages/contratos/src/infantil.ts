// Contrato do LOAS de menor de 16 anos (GGVP-50), ligado no servidor (GGVP-132). Espelha `DadosDaCrianca` das telas
// (apps/web/src/regras/infantil.ts). A condição da criança é dado de saúde: só o Jurídico marca e vê.
import { z } from 'zod'

export const CondicaoDaCrianca = z.enum(['saude-mental', 'neurologica'])
export const TerapiaDaCrianca = z.enum(['fono', 'to', 'psicologia'])

/** PUT /api/processos/:id/crianca: quem marca e quando vêm da sessão. */
export const DadosDaCrianca = z.object({
  condicoes: z.array(CondicaoDaCrianca).max(2),
  terapias: z.array(TerapiaDaCrianca).max(3),
  /** Frequenta escola ou creche: só então o relatório escolar entra. */
  escola: z.boolean(),
})
export type DadosDaCrianca = z.infer<typeof DadosDaCrianca>
