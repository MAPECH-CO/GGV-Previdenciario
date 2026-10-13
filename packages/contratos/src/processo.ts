// A página do processo lida do banco (GGVP-146, parte 5): GET /api/casos/:id/processo devolve o caso numa resposta, já na
// visão do perfil da sessão. O que o banco não tem vem nulo ou vazio: a tela não inventa.
import { z } from 'zod'
import { SugestaoDaIa } from './ia.ts'

const ETAPAS = ['entrevista', 'inss', 'justica', 'vigilia', 'desfecho'] as const

export const ProcessoDoCaso = z.object({
  casoId: z.uuid(),
  pessoa: z.object({ id: z.uuid(), nome: z.string(), cpf: z.string().nullable(), nascimento: z.string().nullable() }),
  /** Id do catálogo de benefícios das telas; nulo até a advogada definir (G3). */
  beneficio: z.string().nullable(),
  fase: z.enum(['atendimento', 'administrativa', 'judicial', 'encerrado']),
  desfecho: z.string().nullable(),
  /** A etapa do caso (as cinco da página), pelo passo do BPMN aberto mais adiantado; sem nenhum aberto, pela fase. */
  etapaAtual: z.enum(ETAPAS),
  identificadores: z.object({ nb: z.string().nullable(), protocolo: z.string().nullable(), cnj: z.string().nullable() }),
  /** GGVP-158 P5.14: a vara e o juiz conferidos no caso, sem número nenhum, para todos que veem o caso. */
  vara: z.string().nullable().optional(),
  juiz: z.string().nullable().optional(),
  /** GGVP-158 P7.1: o texto da estratégia que vale, só para quem vê o estudo de caso (o Jurídico e os sócios). */
  estrategia: z.string().nullable().optional(),
  senhaGovNoCofre: z.boolean(),
  transcricoes: z.number().int(),
  /** Os passos do BPMN abertos agora; `aguardando` diz quem de fora o caso espera. */
  etapas: z.array(z.object({ diagrama: z.string(), passo: z.string(), aguardando: z.string().nullable(), desde: z.string() })),
  /** A linha do caso: os eventos e as decisões do histórico (GGVP-99), em ordem, sem o detalhe interno. */
  linha: z.array(z.object({ quando: z.string(), quem: z.string(), origem: z.enum(['pessoa', 'sistema']), passo: z.string().nullable(), descricao: z.string() })),
  /** Tipo e nome, nunca o conteúdo. Documento de saúde fora do Jurídico: só que ele existe (`nome` nulo). */
  documentos: z.array(z.object({ id: z.uuid(), tipo: z.string(), nome: z.string().nullable(), origem: z.string(), data: z.string(), sensivel: z.boolean() })),
  /** As tarefas abertas, do prazo mais perto ao sem prazo, com o setor dono. */
  tarefas: z.array(
    z.object({ id: z.uuid(), setor: z.string(), titulo: z.string(), responsavel: z.string().nullable(), prazo: z.string().nullable(), passo: z.string().nullable(), tela: z.string().nullable() }),
  ),
  /** A perícia mais recente: status e resultado para todo mundo do caso; o laudo fica na tela da perícia (só o Jurídico). */
  pericia: z
    .object({
      tipo: z.enum(['medica', 'social']),
      origem: z.enum(['d2-necessidade', 'd2-exigencia', 'd3-despacho', 'd3a-juiz']),
      situacao: z.enum(['aguardando-inss', 'marcar', 'aguardando-comprovante', 'agendada', 'na-advogada', 'aguardando-resultado', 'concluida']),
      marcada: z.object({ data: z.string(), hora: z.string(), local: z.string().nullable() }).nullable(),
      /** GGVP-158 P5.5: a data que o sistema leu da publicação do juiz, e não a que alguém registrou. */
      marcadaPeloSistema: z.boolean().optional(),
      perito: z.string().nullable(),
      resultado: z.enum(['favoravel', 'desfavoravel']).nullable(),
    })
    .nullable(),
  /** Exigências em aberto (INSS, juízo ou despacho), com o prazo contado em código e os itens por setor (G21). */
  exigencias: z.array(
    z.object({
      origem: z.enum(['inss', 'juizo', 'despacho']),
      descricao: z.string(),
      prazo: z.string().nullable(),
      situacao: z.string(),
      recebidaEm: z.string(),
      itens: z.array(
        z.object({
          setor: z.string(),
          descricao: z.string(),
          situacao: z.enum(['pendente', 'cumprido', 'nao_cumprido']),
          cumpridoEm: z.string().nullable(),
          cumpridoPor: z.string().nullable(),
        }),
      ),
    }),
  ),
  /** Os prazos processuais que ainda não venceram e têm tarefa aberta, fora os que já aparecem como exigência (G12). */
  prazos: z.array(z.object({ fim: z.string(), regra: z.string() })),
  /** As publicações do processo judicial: a data, a fonte e a classe (o texto fica na tela das publicações). */
  publicacoes: z.array(z.object({ data: z.string(), fonte: z.string(), classe: z.string().nullable() })),
  /** A tarefa aberta mais urgente ou, sem tarefa, quem de fora o caso espera. */
  proximoPasso: z.object({ oQue: z.string(), setor: z.string().nullable(), prazo: z.string().nullable(), tela: z.string().nullable() }).nullable(),
  /** A última versão da prestação de contas: só o Financeiro e a advogada do caso. */
  valores: z.object({ versao: z.number().int(), recebido: z.string(), honorarios: z.string(), cliente: z.string() }).nullable(),
  /** O conteúdo médico do caso: só o Jurídico (`dado_saude.ver_detalhe`), com o acesso registrado. */
  saude: z
    .object({
      documentos: z.array(z.object({ tipo: z.string(), emitidoEm: z.string().nullable(), profissional: z.string().nullable(), cid: z.string().nullable() })),
      parecer: z.object({ resultado: z.string(), confirmadoEm: z.string().nullable() }).nullable(),
    })
    .nullable(),
})
export type ProcessoDoCaso = z.infer<typeof ProcessoDoCaso>

/** GGVP-158 P7.1: a saída da IA para a estratégia do caso, conferida no código. */
export const EstrategiaDaIa = z.object({ estrategia: z.string().trim().min(20).max(1500) })
export type EstrategiaDaIa = z.infer<typeof EstrategiaDaIa>

/**
 * GET /api/casos/:id/estrategia (`estudo.ver`, GGVP-158 P7.1): a estratégia que vale, as versões salvas (a mais nova
 * primeiro) e a proposta pronta da IA, com as fontes; sem a IA, o aviso.
 */
export const EstrategiaDoCaso = z.object({
  casoId: z.uuid(),
  atual: z.object({ texto: z.string(), por: z.string(), em: z.string(), daIa: z.boolean() }).nullable(),
  versoes: z.array(z.object({ texto: z.string(), por: z.string(), em: z.string() })),
  sugestao: SugestaoDaIa.nullable(),
  aviso: z.string().nullable(),
  podeSalvar: z.boolean(),
})
export type EstrategiaDoCaso = z.infer<typeof EstrategiaDoCaso>

/** POST /api/casos/:id/estrategia (a advogada e a Sênior): o texto conferido, o da IA ajustado ou não, e a proposta usada. */
export const SalvarEstrategia = z.object({
  texto: z
    .string({ error: 'Escreva a estratégia' })
    .trim()
    .min(20, 'Escreva a estratégia (pelo menos 20 letras)')
    .max(1500, 'A estratégia vai até 1.500 letras'),
  chamadaIaId: z.uuid().optional(),
})
export type SalvarEstrategia = z.input<typeof SalvarEstrategia>
