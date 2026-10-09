// Contratos da garantia e governança (GGVP-13): tentativas bloqueadas (GGVP-109) e regras do roteiro em código (GGVP-25).
import { normalizarInteiro, validarInteiro } from '@ggv/campos'
import { z } from 'zod'
import { DataObrigatoria } from './inss.ts'

/**
 * Portões que a lista da gestão mostra (GGVP-109 CA9). `setores`: setor ou perícia sem retorno; `perfil`: ação fora do
 * perfil; `funcoes`: separação de funções, quem deu o OK na prestação não registra o recebimento (GGVP-98 CA8). Fica
 * sem número na lista G1 a G22 (decisão do Mateus, 08/10; Q21).
 */
export const PORTOES_DE_BLOQUEIO = ['G1', 'G2', 'G6', 'G7', 'G8', 'G17', 'G21', 'setores', 'perfil', 'funcoes', 'G20'] as const
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

/** Meses inteiros entre duas datas aaaa-mm ou aaaa-mm-dd: o mês só conta quando o dia chega (G19). A tela e o servidor usam esta. */
export function mesesEntre(inicio: string, fim: string): number {
  const [ai, mi, di = 1] = inicio.split('-').map(Number)
  const [af, mf, df = 1] = fim.split('-').map(Number)
  return (af - ai) * 12 + (mf - mi) - (df < di ? 1 : 0)
}

/** O impedimento de longo prazo do LOAS: 24 meses ou mais (Lei 8.742, art. 20, §10; G19). */
export const MESES_LOAS = 24

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

/** O catálogo de benefícios do escritório (GGVP-104 CA5): um só, para o banco, a configuração e as telas. */
export const BENEFICIOS = [
  'bpc_loas_deficiente',
  'bpc_loas_idoso',
  'aposentadoria_pcd',
  'aposentadoria_idade',
  'aposentadoria_tempo',
  'aposentadoria_especial',
  'aposentadoria_incapacidade_permanente',
  'auxilio_incapacidade_temporaria',
  'auxilio_acidente',
  'pensao_morte',
  'salario_maternidade',
  'outro',
] as const
export type Beneficio = (typeof BENEFICIOS)[number]
export const ROTULO_BENEFICIO: Record<Beneficio, string> = {
  bpc_loas_deficiente: 'BPC/LOAS Deficiente',
  bpc_loas_idoso: 'BPC/LOAS Idoso',
  aposentadoria_pcd: 'Aposentadoria da Pessoa com Deficiência',
  aposentadoria_idade: 'Aposentadoria por Idade',
  aposentadoria_tempo: 'Aposentadoria por Tempo de Contribuição',
  aposentadoria_especial: 'Aposentadoria Especial',
  aposentadoria_incapacidade_permanente: 'Aposentadoria por Incapacidade Permanente',
  auxilio_incapacidade_temporaria: 'Auxílio por Incapacidade Temporária',
  auxilio_acidente: 'Auxílio-Acidente',
  pensao_morte: 'Pensão por Morte',
  salario_maternidade: 'Salário-Maternidade',
  outro: 'Outro',
}

/** GGVP-120 CA11: o benefício na tela e na Central, pelo nome do catálogo; fora dele, sem "_"; vazio, "a definir". */
export const nomeDoBeneficio = (b: string | null): string =>
  b ? (ROTULO_BENEFICIO[b as Beneficio] ?? b.replaceAll('_', ' ')) : 'a definir'

/**
 * GGVP-104 CA4: os parâmetros que a gestão edita, cada um com o rótulo e a faixa. Valores do Lucas (02/10) nos dados
 * de exemplo. Os laços de contato e de remarcação são de outros épicos, que leem a mesma chave.
 */
export const PARAMETROS_DO_ESCRITORIO = {
  'cobranca.limite': { rotulo: 'Cobrança de documento: tentativas até subir para a Sênior', min: 1, max: 20 },
  'cobranca.intervalo_dias': { rotulo: 'Cobrança de documento: dias úteis entre as tentativas', min: 1, max: 30 },
  'contato.limite': { rotulo: 'Cliente sumido: tentativas de contato até subir para a Sênior', min: 1, max: 20 },
  'contato.janela_dias': { rotulo: 'Cliente sumido: dias para as tentativas de contato', min: 1, max: 60 },
  'pericia.remarcacao.limite': { rotulo: 'Remarcação de perícia: remarcações até subir para a advogada responsável', min: 0, max: 10 },
  'cofre.alerta.leituras_por_dia': { rotulo: 'Cofre do gov.br: leituras por pessoa no dia antes do alerta', min: 1, max: 100 },
  'cofre.alerta.hora_inicio': { rotulo: 'Cofre do gov.br: começo do horário sem alerta (hora)', min: 0, max: 23 },
  'cofre.alerta.hora_fim': { rotulo: 'Cofre do gov.br: fim do horário sem alerta (hora)', min: 1, max: 24 },
} as const
export type Parametro = keyof typeof PARAMETROS_DO_ESCRITORIO
export const PARAMETROS = Object.keys(PARAMETROS_DO_ESCRITORIO) as Parametro[]

/** PUT /api/configuracao/parametros/:chave: número inteiro pelo `campos`; a faixa de cada um, o servidor confere. */
export const SalvarParametro = z.object({
  valor: z
    .unknown()
    .refine(validarInteiro, 'Informe um número inteiro')
    .transform((v) => normalizarInteiro(v) as number),
})
export type SalvarParametro = z.input<typeof SalvarParametro>

/** PUT /api/configuracao/kits/:beneficio (CA1): a versão seguinte do kit, com os documentos e quais são obrigatórios. */
export const PublicarKit = z
  .object({
    itens: z
      .array(
        z.object({
          tipoDocumento: z.string({ error: 'Escreva o documento' }).trim().min(1, 'Escreva o documento'),
          obrigatorio: z.boolean(),
        }),
      )
      .min(1, 'O kit precisa de ao menos um documento'),
  })
  .refine((k) => new Set(k.itens.map((i) => i.tipoDocumento)).size === k.itens.length, { message: 'Cada documento entra uma vez no kit', path: ['itens'] })
export type PublicarKit = z.input<typeof PublicarKit>

/** PUT /api/configuracao/mensagens/:id: o texto da mensagem padrão. */
export const SalvarMensagem = z.object({ conteudo: z.string({ error: 'Escreva a mensagem' }).trim().min(1, 'Escreva a mensagem') })
export type SalvarMensagem = z.infer<typeof SalvarMensagem>

/** GET /api/configuracao (GGVP-104, `gestao.ver`; editar com `configuracao.editar`). */
export const ConfiguracaoDoEscritorio = z.object({
  parametros: z.array(z.object({ chave: z.string(), rotulo: z.string(), valor: z.number().nullable(), min: z.number(), max: z.number() })),
  kits: z.array(
    z.object({
      beneficio: z.enum(BENEFICIOS),
      versao: z.number().nullable(),
      vigenteDesde: z.string().nullable(),
      itens: z.array(z.object({ tipoDocumento: z.string(), obrigatorio: z.boolean() })),
    }),
  ),
  /** Os tipos de documento já usados, para a gestão não escrever um que nenhuma tela usa. */
  tiposDeDocumento: z.array(z.string()),
  mensagens: z.array(z.object({ id: z.uuid(), nome: z.string(), conteudo: z.string() })),
  /** CA3: as últimas mudanças, com quem, quando e o que mudou. */
  historico: z.array(z.object({ quando: z.string(), quem: z.string(), descricao: z.string() })),
  podeEditar: z.boolean(),
})
export type ConfiguracaoDoEscritorio = z.infer<typeof ConfiguracaoDoEscritorio>

/**
 * Portão do parecer médico (G17, G18; GGVP-109 no servidor, GGVP-33 na tela): uma regra só, que a tela e o servidor
 * importam daqui. Vale para liberar ao Jurídico (D1.24), aprovar para o INSS (D2.01) e pedir a petição (D3.05).
 */
export const ACOES_DO_PORTAO = { liberar: 'liberar ao Jurídico', 'aprovar-inss': 'aprovar para o INSS', 'pedir-peticao': 'pedir a petição' } as const
export type AcaoDoPortao = keyof typeof ACOES_DO_PORTAO

/** Os benefícios com laudo na matriz de `docs/requisitos/roteiro-laudos.md`: pedem parecer "Suficiente". */
export const BENEFICIOS_COM_PARECER: readonly Beneficio[] = [
  'bpc_loas_deficiente',
  'aposentadoria_pcd',
  'aposentadoria_incapacidade_permanente',
  'auxilio_incapacidade_temporaria',
  'auxilio_acidente',
]
/** Benefício ainda não definido pede parecer: na dúvida, o portão fica fechado. */
export const precisaDeParecer = (beneficio: string | null) => beneficio === null || (BENEFICIOS_COM_PARECER as readonly string[]).includes(beneficio)

/** "pendente": a IA sugeriu e nenhuma pessoa do Jurídico confirmou. "dispensado": duas Sêniores diferentes (Q14). */
export type SituacaoDoParecer = 'suficiente' | 'insuficiente' | 'pendente' | 'contraditorio' | 'dispensado'
export type ParecerDoPortao = { situacao: SituacaoDoParecer; contradicoes?: { id: string; texto: string }[] }

/** Por que a ação não segue pelo G17, dizendo o que falta; em ordem, null. Regra é código com teste, nunca modelo. */
export function travaDoParecer(
  acao: AcaoDoPortao,
  beneficio: string | null,
  parecer: ParecerDoPortao | null | undefined,
  { laudoNovoEsperando = false, dispensaPedida = false }: { laudoNovoEsperando?: boolean; dispensaPedida?: boolean } = {},
): string | null {
  if (!precisaDeParecer(beneficio)) return null
  const fazer = `Não dá para ${ACOES_DO_PORTAO[acao]}`
  if (parecer?.contradicoes?.length)
    return `${fazer}: a análise da IA achou documento que contradiz o requisito do benefício (${parecer.contradicoes.map((c) => c.texto.toLowerCase()).join('; ')}). O caso fica parado até o Jurídico conferir o parecer (G18).`
  const emOrdem = parecer?.situacao === 'suficiente' || parecer?.situacao === 'dispensado'
  if (emOrdem && laudoNovoEsperando) return `${fazer}: há laudo novo esperando a conferência do Jurídico (G17).`
  if (emOrdem) return null
  if (dispensaPedida) return `${fazer}: a dispensa do parecer foi pedida e espera a aprovação de outra Sênior (G17).`
  switch (parecer?.situacao) {
    case 'insuficiente':
      return `${fazer}: o parecer médico está Insuficiente. Falta o complemento do médico e o parecer refeito (G17).`
    case 'contraditorio':
      return `${fazer}: um documento contradiz o requisito do benefício e o parecer está Contraditório (G18).`
    case 'pendente':
      return `${fazer}: a IA analisou, mas o parecer médico ainda não foi confirmado por pessoa do Jurídico (G17).`
    default:
      return `${fazer}: falta o parecer médico "Suficiente", confirmado por pessoa (G17).`
  }
}
