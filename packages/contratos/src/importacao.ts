// O importador dos dados que o escritório já tem (GGVP-146, parte 2): uma planilha (CSV) de clientes e processos em
// andamento. Primeiro a simulação, com o relatório; a gravação só com a confirmação da pessoa sobre o mesmo relatório.
import { z } from 'zod'

/** Até 5 MB de texto: alguns milhares de linhas. */
export const TAMANHO_MAXIMO_DA_PLANILHA = 5_000_000
export const LINHAS_MAXIMAS_DA_PLANILHA = 5_000

/** As colunas que o importador lê, na primeira linha da planilha. Só nome e CPF são obrigatórios. */
export const COLUNAS_DA_PLANILHA = ['nome', 'cpf', 'nascimento', 'telefone', 'email', 'cep', 'beneficio', 'fase', 'nb', 'cnj'] as const

/** POST /api/importacao/simulacao: o texto da planilha. Nada é gravado. */
export const PlanilhaDoEscritorio = z.object({ arquivo: z.string().min(1, 'Escolha a planilha.').max(TAMANHO_MAXIMO_DA_PLANILHA, 'Planilha grande demais.') })
export type PlanilhaDoEscritorio = z.infer<typeof PlanilhaDoEscritorio>

/** POST /api/importacao: a mesma planilha, a marca do relatório conferido e a confirmação da pessoa. */
export const ConfirmacaoDaImportacao = PlanilhaDoEscritorio.extend({ conferido: z.string().regex(/^[0-9a-f]{64}$/), confirmo: z.literal(true) })
export type ConfirmacaoDaImportacao = z.infer<typeof ConfirmacaoDaImportacao>

/** O que acontece com cada linha válida: cliente novo ou já cadastrado (pelo CPF), e o processo. */
export const LinhaDaImportacao = z.object({
  linha: z.number(),
  nome: z.string(),
  cliente: z.enum(['novo', 'ja-cadastrado']),
  /** O nome que já está no portal, quando o CPF já existe e o nome da planilha é outro. */
  nomeNoPortal: z.string().optional(),
  processo: z.enum(['novo', 'ja-cadastrado', 'sem-processo']),
  beneficio: z.string().nullable(),
  fase: z.string().nullable(),
})
export type LinhaDaImportacao = z.infer<typeof LinhaDaImportacao>

export const RelatorioDaImportacao = z.object({
  /** A marca deste relatório: a gravação só acontece se a planilha e o banco ainda dão o mesmo relatório. */
  conferido: z.string(),
  clientes: z.object({ novos: z.number(), jaCadastrados: z.number() }),
  processos: z.object({ novos: z.number(), jaCadastrados: z.number() }),
  linhas: z.array(LinhaDaImportacao),
  erros: z.array(z.object({ linha: z.number(), motivo: z.string() })),
  colunasIgnoradas: z.array(z.string()),
})
export type RelatorioDaImportacao = z.infer<typeof RelatorioDaImportacao>
