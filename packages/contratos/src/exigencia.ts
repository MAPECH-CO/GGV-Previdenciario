// Contratos da exigência do INSS (GGVP-39). Tela e servidor validam com o mesmo schema.
import { normalizarInteiro } from '@ggv/campos'
import { z } from 'zod'
import { DataObrigatoria, TIPOS_DE_PERICIA, naoFutura } from './inss.ts'

export const PEDIDOS_DA_EXIGENCIA = ['documentos', 'pericia', 'pericia_e_documentos'] as const
export const CANAIS_DE_COBRANCA = ['whatsapp', 'telefone', 'email', 'sms', 'presencial'] as const
export const RESULTADOS_DE_COBRANCA = ['entregou', 'sem_resposta', 'vai_entregar'] as const
export const SITUACOES_DO_ITEM = ['pendente', 'cumprido', 'nao_cumprido'] as const

/** GET /api/casos/:id/exigencia: a exigência aberta, com o prazo contado em código (CA7) e o card da Documentação (CA11, CA12). */
export const ExigenciaDoCaso = z.object({
  casoId: z.uuid(),
  exigenciaId: z.uuid(),
  cliente: z.string(),
  beneficio: z.string().nullable(),
  texto: z.string(),
  /** aaaa-mm-dd */
  data: z.string(),
  diasInss: z.number().nullable(),
  prazo: z.string().nullable(),
  /** Como o prazo foi contado, para a tela mostrar (G12). */
  regraPrazo: z.string().nullable(),
  feriadosCadastrados: z.boolean(),
  pede: z.enum(PEDIDOS_DA_EXIGENCIA).nullable(),
  situacao: z.string(),
  vencida: z.boolean(),
  itens: z.array(
    z.object({ id: z.uuid(), descricao: z.string(), situacao: z.enum(SITUACOES_DO_ITEM), motivo: z.string().nullable(), prova: z.string().nullable() }),
  ),
  pericias: z.array(z.object({ tipo: z.enum(TIPOS_DE_PERICIA), resultado: z.string().nullable() })),
  card: z
    .object({
      prazoEntrega: z.string().nullable(),
      proximoLembrete: z.string().nullable(),
      tentativas: z.number(),
      limite: z.number().nullable(),
      escalada: z.boolean(),
      cobrancas: z.array(z.object({ quando: z.string(), canal: z.string(), resultado: z.string(), quem: z.string() })),
    })
    .nullable(),
  podeDecidir: z.boolean(),
  podeCumprir: z.boolean(),
  /** A advogada responde no portal do INSS depois que a Documentação entrega as provas (ajuste do Mateus em 05/10). */
  podeResponder: z.boolean(),
  podeDecidirVencida: z.boolean(),
})
export type ExigenciaDoCaso = z.infer<typeof ExigenciaDoCaso>

const temDocumentos = (pede: string) => pede !== 'pericia'
const temPericia = (pede: string) => pede !== 'documentos'

/** POST /api/casos/:id/exigencia (CA1, CA8): a advogada decide; "até o prazo do INSS" o servidor confere, porque depende da contagem. */
export const DecidirExigencia = z
  .object({
    pede: z.enum(PEDIDOS_DA_EXIGENCIA, { error: 'Escolha o que a exigência pede' }),
    itens: z.array(z.string().trim()).default([]).transform((l) => l.filter(Boolean)),
    tiposPericia: z.array(z.enum(TIPOS_DE_PERICIA)).default([]),
    diasInss: z
      .union([z.string(), z.number()])
      .transform((v) => normalizarInteiro(v))
      .refine((n) => n !== null && n >= 1 && n <= 120, 'Informe o prazo que o INSS deu, em dias (1 a 120)')
      .transform((n) => n as number),
    prazoEntrega: DataObrigatoria('Informe o prazo de entrega da Documentação (dd/mm/aaaa)').optional(),
  })
  .refine((d) => !temDocumentos(d.pede) || d.itens.length > 0, { message: 'Informe ao menos um documento pedido', path: ['itens'] })
  .refine((d) => !temPericia(d.pede) || d.tiposPericia.length > 0, { message: 'Escolha o tipo: perícia médica ou avaliação social', path: ['tiposPericia'] })
  .refine((d) => !temDocumentos(d.pede) || d.prazoEntrega, { message: 'Informe o prazo de entrega da Documentação (dd/mm/aaaa)', path: ['prazoEntrega'] })
export type DecidirExigencia = z.input<typeof DecidirExigencia>

/** POST /api/casos/:id/exigencia/cobrancas (CA12, G15). */
export const RegistrarCobranca = z.object({
  canal: z.enum(CANAIS_DE_COBRANCA, { error: 'Escolha o canal da cobrança' }),
  resultado: z.enum(RESULTADOS_DE_COBRANCA, { error: 'Escolha o resultado da cobrança' }),
})
export type RegistrarCobranca = z.infer<typeof RegistrarCobranca>

/** POST /api/casos/:id/exigencia/itens/:item (CA11): cumprido vai com a prova no mesmo envio; não cumprido, com motivo. */
export const CumprirItem = z.discriminatedUnion(
  'acao',
  [z.object({ acao: z.literal('cumprido') }), z.object({ acao: z.literal('nao_cumprido'), motivo: z.string().trim().min(1, 'Escreva por que o item não foi cumprido') })],
  { error: 'Escolha "Cumprido" ou "Não cumprido"' },
)
export type CumprirItem = z.infer<typeof CumprirItem>

/** POST /api/casos/:id/exigencia/resposta (CA4, advogada): data da resposta no portal; o comprovante vai no mesmo envio. */
export const ResponderExigencia = z.object({
  dataResposta: DataObrigatoria('Informe a data da resposta no portal (dd/mm/aaaa)').refine(naoFutura, 'A data da resposta não pode ser no futuro'),
})
export type ResponderExigencia = z.input<typeof ResponderExigencia>

/** POST /api/casos/:id/exigencia/vencida (CA14, resposta do revisor de 05/10): a Sênior pede dilação ou registra a perda. */
export const DecidirVencida = z.discriminatedUnion(
  'decisao',
  [
    z.object({ decisao: z.literal('dilacao'), novoPrazo: DataObrigatoria('Informe o novo prazo (dd/mm/aaaa)') }),
    z.object({ decisao: z.literal('perda'), motivo: z.string().trim().min(1, 'Escreva o que aconteceu') }),
  ],
  { error: 'Escolha "Pedi dilação" ou "Registrar a perda"' },
)
export type DecidirVencida = z.input<typeof DecidirVencida>
