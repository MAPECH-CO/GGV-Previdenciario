// Contratos entre a tela e o servidor. Um schema por endpoint e por formulário (ADR-001).
// Campo de formulário valida com a função de @ggv/campos, nunca com regra solta.
import { normalizarCpf, normalizarNome, validarCpf, validarNome } from '@ggv/campos'
import { z } from 'zod'

/**
 * GET /saude: a homologação consulta para saber se a API está no ar.
 * `banco`: ligado (respondeu), sem-banco (sem DATABASE_URL) ou fora-do-ar (a consulta falhou; a rota responde 503).
 */
export const Saude = z.object({
  ok: z.boolean(),
  servico: z.literal('api'),
  banco: z.enum(['ligado', 'sem-banco', 'fora-do-ar']),
})
export type Saude = z.infer<typeof Saude>

/** Pessoa atendida pelo escritório. Nome e CPF chegam como a pessoa digitou e saem normalizados. */
export const Pessoa = z.object({
  id: z.uuid(),
  nome: z.string().refine(validarNome, 'Nome inválido').transform(normalizarNome),
  cpf: z.string().refine(validarCpf, 'CPF inválido').transform(normalizarCpf).optional(),
})
export type Pessoa = z.infer<typeof Pessoa>
