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

/** GET /api/casos/:id/conferencia (GGVP-23). Parecer só com o resultado e os itens; nunca o CID nem o texto do laudo. */
export const CasoParaConferencia = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  beneficio: z.string().nullable(),
  /** G1. `cadastrado` falso: não há kit do benefício, e a tela avisa. */
  checklist: z.object({ cadastrado: z.boolean(), completo: z.boolean(), faltam: z.array(z.string()) }),
  documentos: z.array(z.object({ id: z.uuid(), tipo: z.string(), nome: z.string() })),
  /** G17. Nulo: ainda sem parecer. */
  parecer: z
    .object({
      resultado: z.enum(['suficiente', 'insuficiente', 'contraditorio', 'dispensado']),
      itens: z.array(z.object({ item: z.string(), atendido: z.boolean() })),
      justificativaDispensa: z.string().nullable(),
    })
    .nullable(),
  laudoNovoEsperando: z.boolean(),
  temFicha: z.boolean(),
  kitAssinado: z.boolean(),
  /** Só a Sênior decide; os outros perfis veem para leitura (CA4). */
  podeDecidir: z.boolean(),
  situacao: z.enum(['aguardando', 'aprovado', 'reprovado']),
})
export type CasoParaConferencia = z.infer<typeof CasoParaConferencia>

const DataOpcional = z
  .string()
  .refine(validarData, 'Informe a data do ajuste (dd/mm/aaaa)')
  .transform((d) => dataParaIso(d) as string)

/** POST /api/casos/:id/conferencia (GGVP-23): aprovar, ou reprovar com motivo e "Essa tarefa tem prazo?". */
export const DecidirConferencia = z.discriminatedUnion(
  'decisao',
  [
    z.object({ decisao: z.literal('aprovar') }),
    z
      .object({
        decisao: z.literal('reprovar'),
        motivo: z.string().trim().min(1, 'Escreva o que o Atendimento precisa ajustar'),
        temPrazo: z.boolean({ error: 'Responda se a tarefa tem prazo' }),
        prazo: DataOpcional.optional(),
      })
      .refine((r) => !r.temPrazo || r.prazo, { message: 'Informe a data do ajuste (dd/mm/aaaa)', path: ['prazo'] }),
  ],
  { error: 'Escolha aprovar ou reprovar' },
)
export type DecidirConferencia = z.input<typeof DecidirConferencia>

/** POST /api/casos/:id/parecer/dispensa (G17): só a Sênior, com justificativa. */
export const DispensarParecer = z.object({ justificativa: z.string().trim().min(1, 'Escreva por que o parecer é dispensado') })
export type DispensarParecer = z.infer<typeof DispensarParecer>

const DataObrigatoria = (mensagem: string) =>
  z
    .string({ error: mensagem })
    .refine(validarData, mensagem)
    .transform((d) => dataParaIso(d) as string)

/**
 * POST /api/casos/:id/vigilia (GGVP-35, GGVP-48): o que o Jurídico achou no Meu INSS. A comunicação (ou a carta de
 * indeferimento) vai no mesmo envio, como arquivo, e é obrigatória na decisão.
 */
export const RespostaDoInss = z.discriminatedUnion(
  'tipo',
  [
    z
      .object({
        tipo: z.literal('decisao'),
        resultado: z.enum(['deferido', 'indeferido'], { error: 'Informe se foi deferido ou indeferido' }),
        texto: z.string().trim().min(1, 'Cole o texto da comunicação do INSS'),
        /** Deferido com outro benefício ou outra data de início: a advogada analisa antes da prestação (resposta do revisor de 05/10). */
        diferenteDoPedido: z.boolean().default(false),
        /** Indeferido: o motivo que consta no sistema do INSS segue para a tarefa da Justiça (GGVP-48 CA3). */
        motivoInss: z.string().trim().optional(),
      })
      .refine((r) => r.resultado !== 'indeferido' || r.motivoInss, { message: 'Informe o motivo que consta no sistema do INSS', path: ['motivoInss'] }),
    z.object({
      tipo: z.literal('exigencia'),
      texto: z.string().trim().min(1, 'Cole o texto da exigência'),
      data: DataObrigatoria('Informe a data da exigência (dd/mm/aaaa)'),
    }),
  ],
  { error: 'Escolha "Decisão" ou "Exigência"' },
)
export type RespostaDoInss = z.input<typeof RespostaDoInss>

/** GET /api/casos/:id/vigilia: o que o caso espera e desde quando (CA7), e o que já foi registrado (CA10). */
export const VigiliaDoCaso = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  beneficio: z.string().nullable(),
  fase: z.string(),
  esperando: z.string().nullable(),
  desde: z.string().nullable(),
  registros: z.array(z.object({ quando: z.string(), tipo: z.string(), resumo: z.string(), quem: z.string() })),
  podeRegistrar: z.boolean(),
  podeEncerrar: z.boolean(),
})
export type VigiliaDoCaso = z.infer<typeof VigiliaDoCaso>

/** POST /api/casos/:id/encerrar (GGVP-48): só a Sênior, com o motivo (cliente desistiu, sem chance). */
export const EncerrarCaso = z.object({ motivo: z.string().trim().min(1, 'Escreva por que o caso é encerrado') })
export type EncerrarCaso = z.infer<typeof EncerrarCaso>
