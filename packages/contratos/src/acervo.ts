// Acervo do escritório (GGVP-55, GGVP-41, D4.05): a conferência dos desfechos lidos, com a ficha do desfecho do portal.
// Só o conferido entra nas contas (CA7).
import { z } from 'zod'
import { TAMANHO_DA_VARA } from './justica.ts'

/**
 * Os desfechos de um processo do acervo, como o Raio-X classifica (êxito = procedente, em parte ou acordo). GGVP-41: o
 * caso ganho no INSS entra no acervo como "deferido" (GGVP-98), e a Sênior também confere (CA7).
 */
export const DESFECHOS_DO_ACERVO = ['procedente_total', 'procedente_parcial', 'acordo', 'improcedente', 'extinto_sem_merito', 'desistencia', 'deferido'] as const
export type DesfechoDoAcervo = (typeof DESFECHOS_DO_ACERVO)[number]
export const ROTULO_DESFECHO_DO_ACERVO: Record<DesfechoDoAcervo, string> = {
  procedente_total: 'Procedente',
  procedente_parcial: 'Procedente em parte',
  acordo: 'Acordo',
  improcedente: 'Improcedente',
  extinto_sem_merito: 'Extinto sem mérito',
  desistencia: 'Desistência',
  deferido: 'Deferido no INSS',
}

/** GGVP-41: a tese vira grupo na Gestão; curta, para a mesma tese não se espalhar em vários grupos. */
export const TAMANHO_DA_TESE = 80
/** GGVP-161 CA1: o resultado do recurso conferido pela Sênior; provido e provido em parte contam como favoráveis. */
export const RESULTADOS_DO_RECURSO = ['provido', 'provido_parcial', 'nao_provido'] as const
export type ResultadoDoRecurso = (typeof RESULTADOS_DO_RECURSO)[number]
export const ROTULO_RESULTADO_DO_RECURSO: Record<ResultadoDoRecurso, string> = { provido: 'Provido', provido_parcial: 'Provido em parte', nao_provido: 'Não provido' }

/** GGVP-153: o que a pergunta de um clique completa. */
export const CAMPOS_A_COMPLETAR = ['vara', 'juiz', 'tese'] as const
/** Texto vazio é o mesmo que não saber (CA5). */
const textoOuNulo = z.string().trim().nullable().default(null).transform((t) => t || null)

/**
 * GGVP-41 (CA1, CA6): a ficha do desfecho no acervo, que a IA escreve sem dado pessoal e a Sênior confere. Sem vara
 * ou sem tese, o campo fica nulo e o caso sai daquele recorte (CA5); a tese longa é cortada no tamanho da Gestão.
 */
export const FichaDoDesfecho = z.object({
  materia: z.string().trim().min(1),
  vara: textoOuNulo,
  tese: textoOuNulo.transform((t) => t?.slice(0, TAMANHO_DA_TESE) ?? null),
  resumo: z.string().trim().min(1),
  licao: z.string().trim().min(1),
})
export type FichaDoDesfecho = z.infer<typeof FichaDoDesfecho>

/** GET /api/acervo/conferencia: os processos com desfecho lido e sem conferência, e quantos já foram conferidos. */
export const ConferenciaDoAcervo = z.object({
  pendentes: z.array(
    z.object({
      id: z.uuid(),
      numeroCnj: z.string().nullable(),
      beneficio: z.string().nullable(),
      desfechoLido: z.string(),
      fonte: z.string(),
      /** GGVP-41: a ficha do desfecho do portal; nula enquanto a IA não leu (CA11). */
      ficha: FichaDoDesfecho.nullable(),
    }),
  ),
  conferidos: z.number().int(),
  /** GGVP-153 CA1: os conferidos ligados a um caso que ainda não têm vara, juiz ou tese, com o que falta em cada um. */
  incompletos: z.array(
    z.object({
      id: z.uuid(),
      numeroCnj: z.string().nullable(),
      beneficio: z.string().nullable(),
      desfecho: z.string(),
      falta: z.array(z.enum(CAMPOS_A_COMPLETAR)),
    }),
  ),
  /** GGVP-153 CA1: as opções de um clique, o que o portal já conhece. */
  conhecidos: z.object({ vara: z.array(z.string()), juiz: z.array(z.string()), tese: z.array(z.string()) }),
})
export type ConferenciaDoAcervo = z.infer<typeof ConferenciaDoAcervo>

/**
 * POST /api/acervo/processos/:id/completar (GGVP-153 CA2): o que faltava, escolhido em um clique ou escrito. Só o campo
 * mandado conta; vazio é o mesmo que não mandar.
 */
const completar = (rotulo: string, tamanho: number) =>
  z
    .string()
    .trim()
    .max(tamanho, `${rotulo} tem até ${tamanho} caracteres`)
    .optional()
    .transform((t) => t || undefined)
export const CompletarAcervo = z
  .object({ vara: completar('A vara', TAMANHO_DA_VARA), juiz: completar('O nome do juiz', TAMANHO_DA_VARA), tese: completar('A tese', TAMANHO_DA_TESE) })
  .refine((c) => c.vara || c.juiz || c.tese, 'Escolha ou escreva o que falta.')
export type CompletarAcervo = z.infer<typeof CompletarAcervo>

/**
 * POST /api/acervo/processos/:id/conferencia: o desfecho conferido, o mesmo lido ou o corrigido. GGVP-41 (CA7): no
 * desfecho do portal, a tese também, a da IA ou a corrigida; vazia, o caso fica fora do recorte por tese.
 */
export const ConferirDesfecho = z.object({
  desfecho: z.enum(DESFECHOS_DO_ACERVO, { error: 'Escolha o desfecho' }),
  tese: z.string().trim().max(TAMANHO_DA_TESE, `A tese tem até ${TAMANHO_DA_TESE} caracteres`).optional(),
  /** GGVP-161 CA1: o resultado do recurso, quando houve recurso julgado; nulo é "sem recurso julgado". */
  recurso: z.enum(RESULTADOS_DO_RECURSO, { error: 'Escolha o resultado do recurso' }).nullable().optional(),
})
export type ConferirDesfecho = z.infer<typeof ConferirDesfecho>

/**
 * GGVP-158 P7.7 (GGVP-148): o Raio-X, a base histórica dos processos, no formato do importador de hoje (CSV, os títulos
 * na primeira linha), até o Pedro entregar o formato do Raio-X. Só `cnj` é obrigatória; outra coluna é ignorada e aparece
 * no relatório: nome, CPF, telefone e endereço nunca são gravados. `cartorio_cobrou`: os itens separados por ";". Os
 * pedidos são os do importador (`PlanilhaDoEscritorio` na simulação e `ConfirmacaoDaImportacao` na carga).
 */
export const COLUNAS_DO_RAIO_X = [
  'cnj',
  'beneficio',
  'desfecho',
  'data_decisao',
  'perito',
  'vara',
  'juiz',
  'falha_nossa',
  'laudo',
  /** GGVP-163 R7: o resultado do estudo social (sim ou não), que o CSV já traz. */
  'estudo_social',
  'extinto_por_determinacao',
  'faltou_pericia',
  'recurso',
  'cartorio_cobrou',
] as const

/** POST /api/acervo/raio-x/simulacao: o relatório da carga, antes de gravar. */
export const RelatorioDoRaioX = z.object({
  /** A marca deste relatório: a carga só grava se a planilha e o acervo ainda dão o mesmo relatório. */
  conferido: z.string(),
  processos: z.object({ novos: z.number().int(), jaNoAcervo: z.number().int() }),
  /** Os nomes distintos dos processos novos, em ordem alfabética. */
  peritos: z.array(z.string()),
  juizes: z.array(z.string()),
  varas: z.array(z.string()),
  /** AAAA-MM-DD: a decisão mais nova dos processos novos (a data de corte); nula sem nenhuma data. */
  dataDeCorte: z.string().nullable(),
  erros: z.array(z.object({ linha: z.number(), motivo: z.string() })),
  colunasIgnoradas: z.array(z.string()),
})
export type RelatorioDoRaioX = z.infer<typeof RelatorioDoRaioX>

const Taxa = z.object({ casos: z.number().int(), valor: z.number().nullable() })
/** Uma taxa do Raio-X, no total e por safra (o ano do número CNJ), sempre com o número de casos; sem caso, nula. */
export const TaxaDoRaioX = Taxa.extend({ chave: z.string(), rotulo: z.string(), porSafra: z.array(Taxa.extend({ safra: z.string() })) })
export type TaxaDoRaioX = z.infer<typeof TaxaDoRaioX>

/** GET /api/acervo/raio-x: os indicadores calculados da base importada (fonte `raio_x`); sem base, tudo vazio. */
export const RaioXDaBase = z.object({
  processos: z.number().int(),
  /** AAAA-MM-DD: a decisão mais nova da base; nula sem base. */
  dataDaBase: z.string().nullable(),
  indicadores: z.array(TaxaDoRaioX),
  /** O que o cartório mais cobra na inicial: os processos com cobrança e, de cada item, quantas vezes. */
  cartorioCobra: z.object({ processos: z.number().int(), itens: z.array(z.object({ item: z.string(), vezes: z.number().int() })) }),
  /** Onde julgam: o foro pelo número CNJ, com o êxito nos decididos dele. */
  ondeJulgam: z.array(z.object({ foro: z.string(), processos: z.number().int(), decididos: z.number().int(), exito: z.number().nullable() })),
})
export type RaioXDaBase = z.infer<typeof RaioXDaBase>
