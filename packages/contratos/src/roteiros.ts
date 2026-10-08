// Contratos do roteiro de conteúdo mínimo por benefício (GGVP-93), ligado no servidor (GGVP-132). Espelham os tipos das
// telas (apps/web/src/regras/roteiro.ts); a regra (pelo menos um obrigatório, tamanho do texto) é a mesma das telas.
import { z } from 'zod'

export const TipoDoItem = z.enum(['obrigatorio', 'contradicao', 'complementar'])

export const ItemDoRoteiro = z.object({
  id: z.string().trim().min(1).max(60),
  tipo: TipoDoItem,
  texto: z.string().trim().min(3).max(300),
  /** Como o item vira pergunta ao médico (GGVP-29, G20). */
  pergunta: z.string().trim().max(300).optional(),
})
export type ItemDoRoteiro = z.infer<typeof ItemDoRoteiro>

/** POST /api/roteiros/:id/versoes: os itens da versão nova; autor e data vêm da sessão. */
export const EdicaoDoRoteiro = z.object({ itens: z.array(ItemDoRoteiro).min(1).max(40) })
export type EdicaoDoRoteiro = z.infer<typeof EdicaoDoRoteiro>
