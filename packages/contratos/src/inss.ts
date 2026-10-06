// Contratos da Via administrativa no INSS (GGVP-8). Tela e servidor validam com o mesmo schema.
import { dataParaIso, somenteDigitos, validarData } from '@ggv/campos'
import { z } from 'zod'

/** Linha da Central do perfil (GET /api/tarefas). Título e detalhe nunca levam CID nem diagnóstico. */
export const TarefaDaCentral = z.object({
  id: z.uuid(),
  casoId: z.uuid(),
  passo: z.string().nullable(),
  cliente: z.object({ id: z.uuid(), nome: z.string() }),
  titulo: z.string(),
  detalhe: z.string(),
  /** Caminho da tela do passo, quando ela existe. */
  tela: z.string().nullable(),
  prazo: z.string().nullable(),
  urgente: z.boolean(),
})
export type TarefaDaCentral = z.infer<typeof TarefaDaCentral>

/** GET /api/casos/:id/protocolo (GGVP-27). Documentos só com tipo e nome: o conteúdo não sai daqui. */
export const CasoParaProtocolo = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  beneficio: z.string().nullable(),
  okSenior: z.object({ por: z.string(), em: z.string() }).nullable(),
  documentos: z.array(z.object({ id: z.uuid(), tipo: z.string(), nome: z.string() })),
  temSenhaNoCofre: z.boolean(),
  jaProtocolado: z.boolean(),
})
export type CasoParaProtocolo = z.infer<typeof CasoParaProtocolo>

/** Campos do protocolo (o comprovante vai no mesmo envio, como arquivo). */
export const RegistrarProtocolo = z.object({
  numero: z
    .string()
    .transform(somenteDigitos)
    .refine((n) => n.length > 0, 'Informe o número do requerimento'),
  der: z
    .string()
    .refine(validarData, 'Informe a data de entrada do requerimento (dd/mm/aaaa)')
    .transform((d) => dataParaIso(d) as string),
  revisado: z.literal(true, { error: 'Marque "Revisei o requerimento antes de enviar"' }),
})
export type RegistrarProtocolo = z.input<typeof RegistrarProtocolo>

export const TIPOS_COMPROVANTE = ['application/pdf', 'image/jpeg', 'image/png'] as const

/** POST /api/casos/:id/cofre (G9): a tela mostra a senha só por `segundos`. */
export const SenhaDoCofre = z.object({ senha: z.string(), segundos: z.number() })
export type SenhaDoCofre = z.infer<typeof SenhaDoCofre>

export const TIPOS_DE_PERICIA = ['medica', 'social'] as const

/** POST /api/casos/:id/pericia (GGVP-31): "Precisa de perícia?" é obrigatória; com "sim", ao menos um tipo. */
export const DecidirPericia = z.discriminatedUnion('precisa', [
  z.object({ precisa: z.literal(false) }),
  z.object({
    precisa: z.literal(true),
    tipos: z.array(z.enum(TIPOS_DE_PERICIA), { error: 'Escolha a perícia médica, a avaliação social ou as duas' }).min(1, 'Escolha a perícia médica, a avaliação social ou as duas'),
  }),
], { error: 'Responda se o caso precisa de perícia' })
export type DecidirPericia = z.infer<typeof DecidirPericia>
