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

/** GGVP-22 CA6, GGVP-67 CA12: texto com o marcador "[completar...]" (da IA ou de alguém) não se aprova; regra única da tela
 * e do servidor. Nulo quando não falta nada. GGVP-158: em tempo linear, sem regex (a regex travava com muitos "[completar"
 * sem o fecho). Basta o primeiro: se ele não tem "]" depois, nenhum outro tem. */
export function faltaCompletar(texto: string): string | null {
  const t = texto.toLowerCase()
  const i = t.indexOf('[completar')
  return i >= 0 && t.indexOf(']', i) >= 0 ? 'O texto ainda tem [completar]: preencha antes de aprovar.' : null
}

export const MSG_JURIMETRIA_NO_TEXTO = 'O texto cita número de jurimetria (G22): tire antes de aprovar.'

/**
 * GGVP-158 P5.12 (G22): o número de jurimetria fica fora do texto da peça que vai ao juiz. Casa o formato que o portal
 * mostra: a taxa com os casos ("71% em 34 laudos", "71% · 24 de 34 processos"), a data da base ("· base de 07/10"), a
 * chance com a porcentagem e o tempo médio em dias. Percentual de lei ("acréscimo de 25%"), os entendimentos e os
 * processos de exemplo passam. Os padrões têm repetição limitada e rodam no texto com os espaços juntados: tempo linear.
 * ponytail: número de jurimetria escrito de outro jeito passa; a revisão da advogada segue valendo.
 */
const FORMATOS_DA_JURIMETRIA = [
  /\d{1,3}(?:,\d{1,2})? ?% ?(?:· |em |de |\(|, )?(?:\d{1,6} de )?\d{1,6} (?:casos|laudos|processos|decisões|decisoes)\b/,
  /(?:·|,) base de \d{1,2}\/\d{1,2}\b/,
  /\bchance\b[^.%]{0,40}?\d{1,3}(?:,\d{1,2})? ?%/,
  /\d{1,3}(?:,\d{1,2})? ?% de chance\b/,
  /\btempo m[ée]dio\b[^.]{0,40}?\d{1,4} dias\b/,
]
export function numeroDeJurimetriaNoTexto(texto: string): string | null {
  const t = texto.toLowerCase().replace(/\s+/g, ' ')
  return FORMATOS_DA_JURIMETRIA.some((f) => f.test(t)) ? MSG_JURIMETRIA_NO_TEXTO : null
}
