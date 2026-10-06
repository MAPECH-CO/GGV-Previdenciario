// Contratos entre a tela e o servidor. Um schema por endpoint e por formulário (ADR-001).
// Campo de formulário valida com a função de @ggv/campos, nunca com regra solta.
import { normalizarCpf, normalizarNome, validarCpf, validarEmail, validarNome } from '@ggv/campos'
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

/** POST /api/sessao: entrar. O e-mail passa por `validarEmail`; a senha só precisa vir preenchida. */
export const Entrar = z.object({
  email: z.string().trim().toLowerCase().refine(validarEmail, 'E-mail inválido'),
  senha: z.string().min(1, 'Digite a senha'),
})
export type Entrar = z.infer<typeof Entrar>

/** Quem está na sessão. `perfis` vazio: entrou, mas ainda sem perfil (GGVP-96). Nunca leva a senha. */
export const UsuarioDaSessao = z.object({
  nome: z.string(),
  email: z.string(),
  perfis: z.array(z.string()),
  /** Perfil escolhido no "Entrar como…"; nulo quando a pessoa não tem nenhum. */
  perfilAtivo: z.string().nullable(),
  /** Senha provisória da gestão: troca obrigatória antes de qualquer tela (GGVP-117, Q1). */
  trocarSenha: z.boolean(),
})
export type UsuarioDaSessao = z.infer<typeof UsuarioDaSessao>

export const TAMANHO_MINIMO_SENHA = 8

/** POST /api/sessao/senha: trocar a senha provisória. */
export const TrocarSenha = z.object({
  senhaNova: z.string().min(TAMANHO_MINIMO_SENHA, `A senha precisa de pelo menos ${TAMANHO_MINIMO_SENHA} caracteres`),
})
export type TrocarSenha = z.infer<typeof TrocarSenha>

/** POST /api/sessao/perfil: "Entrar como…" (GGVP-96 CA10). */
export const TrocarPerfil = z.object({ perfil: z.string() })
export type TrocarPerfil = z.infer<typeof TrocarPerfil>

/** Corpo de toda resposta de erro da API. */
export const Erro = z.object({ erro: z.string() })
export type Erro = z.infer<typeof Erro>
export * from './permissoes.ts'
export * from './inss.ts'
