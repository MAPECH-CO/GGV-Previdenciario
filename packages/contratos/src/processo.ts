// A página do processo lida do banco (GGVP-146, parte 5): GET /api/casos/:id/processo devolve o caso numa resposta, já na
// visão do perfil da sessão. O que o banco não tem vem nulo ou vazio: a tela não inventa.
import { z } from 'zod'

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
