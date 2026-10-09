// Contrato da prova do acidente no Auxílio-Acidente (GGVP-47), ligada no servidor (GGVP-132). Espelha `DadosDoAcidente`
// das telas (apps/web/src/regras/acidente.ts); a regra (data não futura) é a mesma das telas.
import { z } from 'zod'

export const CircunstanciaDoAcidente = z.enum(['trabalho', 'trajeto', 'ocupacional', 'transito', 'domestico'])
export const CategoriaDoSegurado = z.enum(['empregado', 'domestico', 'avulso', 'especial', 'individual', 'facultativo'])

/** PUT /api/processos/:id/acidente: quem marca e quando vêm da sessão. */
export const DadosDoAcidente = z.object({
  circunstancia: CircunstanciaDoAcidente,
  categoria: CategoriaDoSegurado,
  acidenteEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Houve auxílio por incapacidade temporária antes: puxa a cópia do processo (condicional). */
  auxilioAnterior: z.boolean(),
  /** A válvula: o empregador recusou; vira pendência e não trava. */
  recusados: z.array(z.enum(['cat', 'ppp'])).max(2),
})
export type DadosDoAcidente = z.infer<typeof DadosDoAcidente>
