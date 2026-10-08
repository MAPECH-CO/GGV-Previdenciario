// Contratos da IA (GGVP-106): a IA só sugere, com fontes; toda chamada fica registrada para auditoria.
import { z } from 'zod'

export const FORNECEDORES_DE_IA = ['openai', 'mistral'] as const
/** `desligada`: sem chave; `recusada`: dado de saúde sem autorização do escritório; `falhou`: o serviço não respondeu. */
export const SITUACOES_DA_CHAMADA = ['ok', 'desligada', 'recusada', 'falhou'] as const

export const FonteDaIa = z.object({
  /** O que foi usado: um documento do caso, uma publicação, um caso do acervo, uma regra do sistema. */
  tipo: z.enum(['documento', 'publicacao', 'acervo', 'regra', 'caso']),
  referencia: z.string(),
  trecho: z.string().optional(),
})
export type FonteDaIa = z.infer<typeof FonteDaIa>

/** CA2: o que a tela recebe. Sempre sugestão; quem decide é a pessoa, numa rota com o perfil da sessão (CA1). */
export const SugestaoDaIa = z.object({
  chamadaId: z.uuid(),
  sugestao: z.literal(true),
  texto: z.string(),
  fontes: z.array(FonteDaIa),
  modelo: z.string(),
  geradaEm: z.string(),
  /** GGVP-110 CA3: a saída repetiu instrução suspeita; a tela avisa a pessoa antes de ela usar a sugestão. */
  alerta: z.string().nullable(),
})
export type SugestaoDaIa = z.infer<typeof SugestaoDaIa>

/** GET /api/casos/:id/ia (CA4). `saida` só para quem vê dado de saúde; para os outros, nulo. */
export const ChamadaDaIa = z.object({
  id: z.uuid(),
  finalidade: z.string(),
  fornecedor: z.enum(FORNECEDORES_DE_IA),
  modelo: z.string(),
  situacao: z.enum(SITUACOES_DA_CHAMADA),
  quem: z.string().nullable(),
  quando: z.string(),
  fontes: z.array(FonteDaIa),
  saida: z.string().nullable(),
  alerta: z.string().nullable(),
})
export type ChamadaDaIa = z.infer<typeof ChamadaDaIa>
export const ChamadasDaIa = z.object({ chamadas: z.array(ChamadaDaIa) })
export type ChamadasDaIa = z.infer<typeof ChamadasDaIa>
