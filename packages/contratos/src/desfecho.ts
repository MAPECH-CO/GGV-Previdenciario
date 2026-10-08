// Contratos do desfecho (GGVP-11): explicar o resultado ao cliente no caso perdido (GGVP-22).
import { z } from 'zod'
import { SugestaoDaIa } from './ia.ts'

/** Quem fala com o cliente (GGVP-22 CA5, Lucas 06/10): a advogada, em caso complexo, ou o Atendimento, no padrão. */
export const QUEM_FALA = ['advogada', 'atendimento'] as const
export const CANAIS_DO_CONTATO = ['telefone', 'whatsapp', 'presencial', 'video'] as const
export const ROTULO_CANAL_DO_CONTATO: Record<(typeof CANAIS_DO_CONTATO)[number], string> = {
  telefone: 'Telefone',
  whatsapp: 'WhatsApp',
  presencial: 'Presencial',
  video: 'Vídeo',
}

/** POST /api/casos/:id/resultado/resumo (CA3, CA5): o Jurídico escreve e aprova; sem estratégia interna. */
export const AprovarResumo = z.object({
  texto: z
    .string({ error: 'Escreva o resumo para o cliente' })
    .trim()
    .min(20, 'Escreva o resumo para o cliente (20 letras ou mais)')
    .max(2000, 'O resumo vai até 2000 letras'),
  quemFala: z.enum(QUEM_FALA, { error: 'Escolha quem fala com o cliente' }),
  /** Épico IA: o resumo partiu do rascunho da IA; a decisão guarda a chamada à parte do texto aprovado. */
  chamadaIaId: z.uuid().optional(),
})
export type AprovarResumo = z.infer<typeof AprovarResumo>

/** POST /api/casos/:id/resultado/sugestao (épico IA): o rascunho da IA, ou nulo com o motivo. */
export const SugestaoDoResumo = z.object({ sugestao: SugestaoDaIa.nullable(), motivo: z.string().nullable() })
export type SugestaoDoResumo = z.infer<typeof SugestaoDoResumo>

const Canal = z.enum(CANAIS_DO_CONTATO, { error: 'Escolha o canal do contato' })

/** POST /api/casos/:id/resultado/contato (CA4): sem contato mantém a tarefa; explicado conclui e pede o que foi dito. */
export const RegistrarContato = z.discriminatedUnion(
  'resultado',
  [
    z.object({ resultado: z.literal('sem_contato'), canal: Canal }),
    z.object({ resultado: z.literal('explicado'), canal: Canal, explicado: z.string().trim().min(1, 'Escreva o que foi explicado ao cliente') }),
  ],
  { error: 'Escolha "Sem contato" ou "Expliquei ao cliente"' },
)
export type RegistrarContato = z.infer<typeof RegistrarContato>

/** GET /api/casos/:id/resultado. Só o resumo aprovado sai daqui: nunca o estudo de caso nem a estratégia interna. */
export const ResultadoParaExplicar = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  resumo: z.object({ texto: z.string(), aprovadoPor: z.string(), aprovadoEm: z.string(), quemFala: z.enum(QUEM_FALA) }).nullable(),
  contatos: z.array(z.object({ quando: z.string(), canal: z.string(), explicado: z.string().nullable(), quem: z.string() })),
  podeAprovar: z.boolean(),
  podeRegistrar: z.boolean(),
  /** CA2: "Perdemos: estudo registrado". */
  encerrado: z.boolean(),
})
export type ResultadoParaExplicar = z.infer<typeof ResultadoParaExplicar>
