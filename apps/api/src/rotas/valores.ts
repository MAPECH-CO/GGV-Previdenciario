// GGVP-158 P7.6: o valor da causa (da petição) e a renda por pessoa do LOAS (da ficha e da entrevista), no servidor, pela
// regra de valores do Pedro (06/10, `podeVerValor` das telas): o Financeiro e o Sócio veem tudo; a advogada, o valor da
// causa e a renda; a Sênior, a prestação enquanto o caso está nela (Mateus, 14/10); o Atendimento e a Documentação, nada.
// Só a advogada grava. O histórico diz que mudou, sem o valor.
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { RendaPorPessoa, ValorDaCausa, ValoresDoCaso, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { caso, pessoa, prestacaoContas, tarefa } from '../banco/esquema.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { podeVerValor } from '../../../web/src/regras/caso.ts'
import { UUID } from './recepcao.ts'

export const MSG_SEM_VALOR = 'Os valores do caso são da advogada, do Sócio e do Financeiro.'
export const MSG_SO_A_ADVOGADA = 'Quem grava o valor é a advogada.'
/** Os passos da prestação de contas: no INSS (D2.06) e na Justiça (D3b.02). */
const DA_PRESTACAO = ['D2.06', 'D3b.02']

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

/**
 * Os valores do caso que o perfil pode ver; `null` quando não vê nenhum. A página do processo usa a mesma conta para o
 * valor da causa e a renda.
 */
export async function valoresVisiveis(banco: Banco, casoId: string, perfil: string | null) {
  const [c] = await banco
    .select({ causa: caso.valorCausa, renda: pessoa.rendaPorPessoa })
    .from(caso)
    .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
    .where(eq(caso.id, casoId))
  if (!c) return undefined
  const [naPrestacao] = await banco
    .select({ id: tarefa.id })
    .from(tarefa)
    .where(and(eq(tarefa.casoId, casoId), inArray(tarefa.passo, DA_PRESTACAO), isNull(tarefa.concluidaEm)))
    .limit(1)
  const regra = { naPrestacaoDeContas: Boolean(naPrestacao) }
  const ve = (tipo: 'causa' | 'renda-por-pessoa' | 'prestacao-de-contas') => podeVerValor(perfil ?? undefined, tipo, regra)
  if (!ve('causa') && !ve('renda-por-pessoa') && !ve('prestacao-de-contas')) return null
  const [pc] = ve('prestacao-de-contas')
    ? await banco.select().from(prestacaoContas).where(eq(prestacaoContas.casoId, casoId)).orderBy(desc(prestacaoContas.versao)).limit(1)
    : []
  return {
    ...(ve('causa') && { causa: c.causa }),
    ...(ve('renda-por-pessoa') && { rendaPorPessoa: c.renda }),
    ...(ve('prestacao-de-contas') && {
      prestacao: pc ? { versao: pc.versao, recebido: pc.valorRecebido, honorarios: pc.honorarios, repasse: pc.valorCliente } : null,
    }),
  }
}

export function registrarRotasValores(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  // A trava da rota é a de quem pode pedir os valores do caso (Financeiro, advogada, Sênior e Sócio); a regra de valores
  // decide cada um, e quem não vê nenhum recebe 403.
  const ver = { preHandler: exigir(banco, 'valores_do_caso.ver', agora) }
  const gravar = { preHandler: exigir(banco, 'caso.ver', agora) }

  app.get<{ Params: { id: string } }>('/api/casos/:id/valores', ver, async (pedido, resposta) => {
    if (!UUID.test(pedido.params.id)) return negar(resposta, 404, 'Caso não encontrado.')
    const valores = await valoresVisiveis(banco, pedido.params.id, pedido.perfilAtivo)
    if (valores === undefined) return negar(resposta, 404, 'Caso não encontrado.')
    if (valores === null) return negar(resposta, 403, MSG_SEM_VALOR)
    return ValoresDoCaso.parse({ casoId: pedido.params.id, ...valores, podeEditar: pedido.perfilAtivo === 'advogada' })
  })

  app.put<{ Params: { id: string } }>('/api/casos/:id/valor-da-causa', gravar, async (pedido, resposta) => {
    if (pedido.perfilAtivo !== 'advogada') return negar(resposta, 403, MSG_SO_A_ADVOGADA)
    const entrada = ValorDaCausa.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o valor.')
    if (!UUID.test(pedido.params.id)) return negar(resposta, 404, 'Caso não encontrado.')
    const [mudou] = await banco
      .update(caso)
      .set({ valorCausa: entrada.data.valor.toFixed(2), atualizadoEm: agora() })
      .where(eq(caso.id, pedido.params.id))
      .returning({ id: caso.id })
    if (!mudou) return negar(resposta, 404, 'Caso não encontrado.')
    await historico(pedido.usuario!.id, 'valor_da_causa_alterado', pedido, `caso:${pedido.params.id}`)
    return { ok: true }
  })

  app.put<{ Params: { id: string } }>('/api/fichas/:id/renda-por-pessoa', gravar, async (pedido, resposta) => {
    if (pedido.perfilAtivo !== 'advogada') return negar(resposta, 403, MSG_SO_A_ADVOGADA)
    const entrada = RendaPorPessoa.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira a renda.')
    if (!UUID.test(pedido.params.id)) return negar(resposta, 404, 'Ficha não encontrada.')
    const [mudou] = await banco
      .update(pessoa)
      .set({ rendaPorPessoa: entrada.data.valor.toFixed(2) })
      .where(eq(pessoa.id, pedido.params.id))
      .returning({ id: pessoa.id })
    if (!mudou) return negar(resposta, 404, 'Ficha não encontrada.')
    await historico(pedido.usuario!.id, 'renda_por_pessoa_alterada', pedido, `pessoa:${pedido.params.id}`)
    return { ok: true }
  })
}
