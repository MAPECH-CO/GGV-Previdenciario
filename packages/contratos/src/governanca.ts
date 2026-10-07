// Contratos da garantia e governança (GGVP-13): tentativas bloqueadas (GGVP-109) e regras do roteiro em código (GGVP-25).
import { z } from 'zod'
import { DataObrigatoria } from './inss.ts'

/** Portões que a lista da gestão mostra (GGVP-109 CA9). `setores`: setor ou perícia sem retorno; `perfil`: ação fora do perfil. */
export const PORTOES_DE_BLOQUEIO = ['G1', 'G2', 'G6', 'G7', 'G8', 'G17', 'G21', 'setores', 'perfil'] as const
export type PortaoDeBloqueio = (typeof PORTOES_DE_BLOQUEIO)[number]

/** GET /api/gestao/tentativas (GGVP-109 CA9, `gestao.ver`): quem, quando, caso e portão, sem dado de saúde. */
export const TentativaBloqueada = z.object({
  quando: z.string(),
  quem: z.string(),
  perfil: z.string().nullable(),
  casoId: z.uuid().nullable(),
  cliente: z.string().nullable(),
  portao: z.enum(PORTOES_DE_BLOQUEIO),
  descricao: z.string(),
})
export type TentativaBloqueada = z.infer<typeof TentativaBloqueada>
export const TentativasBloqueadas = z.object({ tentativas: z.array(TentativaBloqueada) })
export type TentativasBloqueadas = z.infer<typeof TentativasBloqueadas>

/** As regras numéricas do roteiro de laudos (GGVP-25, G19). */
export const REGRAS = ['loas_24_meses', 'incapacidade_15_dias', 'periodos_pcd', 'dii_carencia_qualidade'] as const
export type Regra = (typeof REGRAS)[number]

// Dado que falta não é erro de formulário: a regra responde "não calculável: falta X" (CA4). Formato errado é.
const DataDaRegra = (oQue: string) => DataObrigatoria(`Informe ${oQue} (dd/mm/aaaa)`).optional()

/** CA1 · BPC/LOAS Deficiente: início do impedimento e prognóstico (data prevista, permanente, ou se ainda persiste). */
export const EntradaLoas24 = z.object({
  inicio: DataDaRegra('a data de início do impedimento'),
  persiste: z.boolean().optional(),
  fimPrevisto: DataDaRegra('a data prevista de cessação'),
  permanente: z.boolean().optional(),
})
export type EntradaLoas24 = z.output<typeof EntradaLoas24>

/** CA2 · Incapacidade temporária: cada atestado com a correlação clínica marcada pela advogada. */
export const EntradaIncapacidade = z.object({
  atestados: z
    .array(
      z.object({
        inicio: DataObrigatoria('Informe o início do atestado (dd/mm/aaaa)'),
        dias: z.number({ error: 'Informe os dias do atestado' }).int().positive('Os dias do atestado são um número inteiro maior que zero'),
        correlacionado: z.boolean({ error: 'Marque se a doença do atestado é clinicamente correlacionada' }),
      }),
    )
    .optional(),
})
export type EntradaIncapacidade = z.output<typeof EntradaIncapacidade>

/** CA3 · Aposentadoria PCD: início (e fim, se transitória) da deficiência e os vínculos do CNIS. */
export const EntradaPcd = z.object({
  inicioDeficiencia: DataDaRegra('a data de início da deficiência'),
  fimDeficiencia: DataDaRegra('a data de fim da deficiência'),
  vinculos: z.array(z.object({ inicio: DataObrigatoria('Informe o início do vínculo (dd/mm/aaaa)'), fim: DataDaRegra('o fim do vínculo') })).optional(),
})
export type EntradaPcd = z.output<typeof EntradaPcd>

/** Competência contribuída, como no CNIS. */
const Competencia = z.string().regex(/^(0[1-9]|1[0-2])\/\d{4}$/, 'Competência no formato mm/aaaa')

/**
 * CA5 · DII × carência e qualidade de segurado. A isenção de carência (acidente, doença do trabalho ou da lista do
 * art. 151) é marcada pela advogada: a regra não recebe diagnóstico nem CID.
 */
export const EntradaDii = z.object({
  dii: DataDaRegra('a data de início da incapacidade (DII)'),
  competencias: z.array(Competencia).optional(),
  isentaDeCarencia: z.boolean().optional(),
  desempregado: z.boolean().optional(),
  /** Segurado facultativo: graça de 6 meses, sem as prorrogações (Lei 8.213, art. 15, VI). */
  facultativo: z.boolean().optional(),
})
export type EntradaDii = z.output<typeof EntradaDii>

export const ENTRADA_DA_REGRA = {
  loas_24_meses: EntradaLoas24,
  incapacidade_15_dias: EntradaIncapacidade,
  periodos_pcd: EntradaPcd,
  dii_carencia_qualidade: EntradaDii,
} as const

/** POST /api/regras/:regra (GGVP-25, `laudo.conferir`): o resultado com as entradas usadas, a regra e a versão (CA6). */
export const ResultadoDaRegra = z.object({
  regra: z.enum(REGRAS),
  versao: z.number().int(),
  fundamento: z.string(),
  /** A data de referência do cálculo: o mesmo insumo com o mesmo dia dá o mesmo resultado (CA8). */
  hoje: z.string(),
  entradas: z.record(z.string(), z.unknown()),
  /** CA4: o que falta para calcular. Vazio quando calculou. */
  falta: z.array(z.string()),
  /** Nulo quando não calculável. */
  atende: z.boolean().nullable(),
  resumo: z.string(),
  detalhes: z.array(z.object({ rotulo: z.string(), valor: z.string() })),
})
export type ResultadoDaRegra = z.infer<typeof ResultadoDaRegra>

/** GGVP-99 CA7, CA11: um evento da linha do processo. `quem` é a pessoa ou "Sistema"; o detalhe interno não sai. */
export const EventoDoHistorico = z.object({
  quando: z.string(),
  quem: z.string(),
  origem: z.enum(['pessoa', 'sistema']),
  passo: z.string().nullable(),
  descricao: z.string(),
})
export type EventoDoHistorico = z.infer<typeof EventoDoHistorico>

/** GET /api/casos/:id/historico (GGVP-99 CA11, `caso.ver`): a linha do processo e a exportação em curso (CA12). */
export const HistoricoDoCaso = z.object({
  casoId: z.uuid(),
  cliente: z.string(),
  eventos: z.array(EventoDoHistorico),
  exportacao: z.object({ situacao: z.enum(['pedida', 'autorizada']), pedidaPor: z.string(), motivo: z.string(), pedidaEm: z.string() }).nullable(),
  podePedirExportacao: z.boolean(),
  podeAutorizarExportacao: z.boolean(),
  /** Só quem pediu, depois da autorização da direção. */
  podeExportar: z.boolean(),
})
export type HistoricoDoCaso = z.infer<typeof HistoricoDoCaso>

/** POST /api/casos/:id/historico/exportacao (GGVP-99 CA12): a gestão pede, com o motivo; a direção autoriza. */
export const PedirExportacao = z.object({
  motivo: z.string({ error: 'Escreva o motivo do pedido' }).trim().min(1, 'Escreva o motivo do pedido'),
})
export type PedirExportacao = z.infer<typeof PedirExportacao>

/** GET /api/gestao/prazos (GGVP-99 CA14): prazos cumpridos e perdidos, tirados do histórico. */
export const PrazosDoEscritorio = z.object({
  cumpridos: z.number(),
  perdidos: z.number(),
  itens: z.array(
    z.object({ quando: z.string(), casoId: z.uuid().nullable(), cliente: z.string().nullable(), situacao: z.enum(['cumprido', 'perdido']), descricao: z.string() }),
  ),
})
export type PrazosDoEscritorio = z.infer<typeof PrazosDoEscritorio>

/** POST /api/pessoas/:id/cofre (GGVP-103 CA4, CA11): a senha entra só pelo cofre. Senha não leva trim. */
export const CadastrarSenhaGovbr = z.object({ senha: z.string({ error: 'Digite a senha do gov.br' }).min(1, 'Digite a senha do gov.br') })
export type CadastrarSenhaGovbr = z.infer<typeof CadastrarSenhaGovbr>

/** GET /api/gestao/cofre (GGVP-103 CA6): os usos do cofre por pessoa, sem o valor. */
export const UsoDoCofre = z.object({
  pessoas: z.array(z.object({ quem: z.string(), leituras: z.number(), cadastros: z.number(), recusas: z.number(), ultimoUso: z.string().nullable() })),
})
export type UsoDoCofre = z.infer<typeof UsoDoCofre>
