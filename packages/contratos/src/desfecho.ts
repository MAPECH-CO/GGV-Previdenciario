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

/**
 * GGVP-19 (Lucas, 06/10): o estudo de caso que a IA faz sozinha depois do resultado negativo. "chance" é a leitura da IA
 * sobre as provas (o caso era forte ou fraco), não porcentagem; "novoProcesso" abre a tarefa da Sênior.
 */
export const EstudoDaIa = z.object({
  materia: z.string().trim().min(1),
  vara: z.string().trim().nullable().default(null),
  /** Nula quando a petição não está no sistema (caso antigo, ou o exemplo). */
  tese: z.string().trim().nullable().default(null),
  resumo: z.string().trim().min(1),
  motivo: z.string().trim().min(1),
  aprendizado: z.string().trim().min(1),
  chance: z.enum(['maior', 'menor']),
  novoProcesso: z.boolean(),
  oQueRefazer: z.string().trim().nullable().default(null),
})
export type EstudoDaIa = z.infer<typeof EstudoDaIa>

/** GET /api/estudos (GGVP-19 CA5): o estudo mais novo de cada caso perdido, com a revisão da Sênior quando houve. */
export const EstudosDeCaso = z.object({
  estudos: z.array(
    z.object({
      casoId: z.uuid(),
      cliente: z.string(),
      beneficio: z.string().nullable(),
      resultado: z.string(),
      geradoEm: z.string(),
      modelo: z.string(),
      estudo: EstudoDaIa,
      /** A tarefa "Revisar estudo de caso" está aberta (CA3). */
      aRevisar: z.boolean(),
      revisao: z.object({ novoProcesso: z.boolean(), por: z.string(), em: z.string() }).nullable(),
    }),
  ),
  podeRevisar: z.boolean(),
})
export type EstudosDeCaso = z.infer<typeof EstudosDeCaso>

/** POST /api/casos/:id/estudo/revisao (GGVP-19 CA3): a Sênior decide se entra com novo processo. */
export const RevisarEstudo = z.object({ novoProcesso: z.boolean({ error: 'Escolha se vamos entrar com novo processo' }) })
export type RevisarEstudo = z.infer<typeof RevisarEstudo>

/** GGVP-100 (D3b.04): "Vale recorrer?" depois da sentença improcedente. Quem decide é a Sênior (Lucas, 07/10). */
export const DECISOES_DO_RECURSO = ['recorrer', 'nao_recorrer'] as const
export const ROTULO_DECISAO_DO_RECURSO: Record<(typeof DECISOES_DO_RECURSO)[number], string> = {
  recorrer: 'Sim, recorrer',
  nao_recorrer: 'Não, encerrar com estudo de caso',
}

/** POST /api/casos/:id/recurso (CA3): a escolha e a justificativa, sempre. */
export const DecidirRecurso = z.object({
  decisao: z.enum(DECISOES_DO_RECURSO, { error: 'Escolha se vale recorrer' }),
  justificativa: z.string({ error: 'Escreva a justificativa' }).trim().min(1, 'Escreva a justificativa').max(2000, 'A justificativa vai até 2000 letras'),
})
export type DecidirRecurso = z.infer<typeof DecidirRecurso>

/**
 * GET /api/casos/:id/recurso. O prazo é contado pelo sistema, pelo lado seguro (CA4, G12). A chance é da jurimetria,
 * calculada por código (CA8); nula enquanto não houver a do juízo. A IA nunca dá o número.
 */
export const RecursoDoCaso = z.object({
  casoId: z.uuid(),
  pessoaId: z.uuid(),
  cliente: z.string(),
  beneficio: z.string().nullable(),
  sentenca: z.object({ disponibilizadaEm: z.string(), texto: z.string() }).nullable(),
  prazo: z.object({ fim: z.string(), regra: z.string() }).nullable(),
  chance: z.object({ porcentagem: z.number().int(), casos: z.number().int(), regra: z.string() }).nullable(),
  decisao: z.object({ decisao: z.enum(DECISOES_DO_RECURSO), justificativa: z.string(), por: z.string(), em: z.string() }).nullable(),
  /** A tarefa "Decidir recurso" está aberta e o perfil decide (a Sênior). */
  podeDecidir: z.boolean(),
})
export type RecursoDoCaso = z.infer<typeof RecursoDoCaso>
