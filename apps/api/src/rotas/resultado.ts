// Explicar o resultado ao cliente no caso perdido (GGVP-22). O Jurídico escreve e aprova o resumo, sem estratégia
// interna, e decide quem fala (Lucas, 06/10); quem fala registra cada contato. Sem IA até 09/10: o texto é do Jurídico.
import { and, asc, desc, eq, gte, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { AprovarResumo, RegistrarContato, ResultadoParaExplicar, pode, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { atendimento, caso, decisao, pessoa, tarefa, usuario } from '../banco/esquema.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'

export const TITULO_RESUMO = 'Aprovar o resumo para o cliente'
export const TITULO_EXPLICAR = 'Explicar resultado'
export const MSG_SEM_RESUMO_ESPERANDO = 'Não há resultado esperando o resumo.'
export const MSG_SEM_EXPLICACAO = 'Não há explicação ao cliente em aberto neste caso.'

type Opcoes = { banco: Banco; agora?: () => Date }
type Tx = Parameters<Parameters<Banco['transaction']>[0]>[0]
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

/**
 * Abre o caminho do resultado perdido: "Aprovar o resumo para o cliente" para a advogada, uma vez. Quem chama: o
 * "Não recorrer" (GGVP-100) e o estudo de caso (GGVP-19), quando existirem; até lá, a semente.
 */
export async function abrirExplicacaoDoResultado(tx: Banco | Tx, casoId: string) {
  const [aberta] = await tx
    .select({ id: tarefa.id })
    .from(tarefa)
    .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3b.06r'), isNull(tarefa.concluidaEm)))
  if (!aberta) await tx.insert(tarefa).values({ casoId, passo: 'D3b.06r', titulo: TITULO_RESUMO, perfilDono: 'advogada' })
}

export function registrarRotasResultado(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  const aberta = async (casoId: string, passo: string) =>
    (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, passo), isNull(tarefa.concluidaEm))).limit(1))[0] ?? null

  // CA1, CA3: o resumo aprovado (com quem aprovou) e os contatos; nada do estudo de caso.
  app.get<{ Params: { id: string } }>('/api/casos/:id/resultado', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const [c] = await banco.select({ nome: pessoa.nome, fase: caso.fase }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    const [resumo] = await banco
      .select({ texto: decisao.justificativa, quemFala: decisao.resultado, em: decisao.decididoEm, por: usuario.nome })
      .from(decisao)
      .innerJoin(usuario, eq(decisao.decididoPor, usuario.id))
      .where(and(eq(decisao.casoId, casoId), eq(decisao.tipo, 'resumo_cliente')))
      .orderBy(desc(decisao.decididoEm))
      .limit(1)
    // Os contatos desta explicação: os atendimentos do caso depois do resumo aprovado (a entrevista vem sempre antes).
    const contatos = resumo
      ? await banco
          .select({ quando: atendimento.inicio, canal: atendimento.canal, explicado: atendimento.resumo, quem: usuario.nome })
          .from(atendimento)
          .innerJoin(usuario, eq(atendimento.responsavelId, usuario.id))
          .where(and(eq(atendimento.casoId, casoId), gte(atendimento.inicio, resumo.em)))
          .orderBy(asc(atendimento.inicio))
      : []
    return ResultadoParaExplicar.parse({
      casoId,
      cliente: c.nome,
      resumo: resumo ? { texto: resumo.texto ?? '', aprovadoPor: resumo.por, aprovadoEm: resumo.em.toISOString(), quemFala: resumo.quemFala } : null,
      contatos: contatos.map((x) => ({ quando: x.quando.toISOString(), canal: x.canal, explicado: x.explicado, quem: x.quem })),
      podeAprovar: pode(pedido.perfilAtivo, 'resultado.aprovar_resumo') && Boolean(await aberta(casoId, 'D3b.06r')),
      podeRegistrar: pode(pedido.perfilAtivo, 'resultado.explicar') && Boolean(await aberta(casoId, 'D3b.06')),
      encerrado: c.fase === 'encerrado',
    })
  })

  // CA3, CA5: o Jurídico aprova o resumo (decisão de pessoa) e escolhe quem fala; nasce "Explicar resultado" para ele.
  app.post<{ Params: { id: string } }>('/api/casos/:id/resultado/resumo', { preHandler: exigir(banco, 'resultado.aprovar_resumo', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = AprovarResumo.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o resumo.')
    const pendente = await aberta(casoId, 'D3b.06r')
    if (!pendente) return negar(resposta, 409, MSG_SEM_RESUMO_ESPERANDO)
    const quem = pedido.usuario!.id
    const { texto, quemFala } = entrada.data
    await banco.transaction(async (tx) => {
      await tx.insert(decisao).values({
        casoId,
        passo: 'D3b.06',
        tipo: 'resumo_cliente',
        resultado: quemFala,
        justificativa: texto,
        decididoPor: quem,
        perfil: pedido.perfilAtivo!,
        decididoEm: agora(),
      })
      await tx.update(tarefa).set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem }).where(eq(tarefa.id, pendente.id))
      // CA5: caso complexo, a advogada fica com a tarefa; no padrão, vai ao Atendimento.
      await tx.insert(tarefa).values({
        casoId,
        passo: 'D3b.06',
        titulo: TITULO_EXPLICAR,
        perfilDono: quemFala,
        responsavelId: quemFala === 'advogada' ? quem : null,
      })
    })
    await historico(quem, 'resumo_cliente_aprovado', pedido, `caso:${casoId}`, { quemFala })
    return resposta.code(201).send({ ok: true })
  })

  // CA2, CA4: cada contato com data e canal; "Sem contato" mantém a tarefa, "Expliquei" conclui e fecha o caso.
  app.post<{ Params: { id: string } }>('/api/casos/:id/resultado/contato', { preHandler: exigir(banco, 'resultado.explicar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = RegistrarContato.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o contato.')
    const t = await aberta(casoId, 'D3b.06')
    if (!t) return negar(resposta, 409, MSG_SEM_EXPLICACAO)
    const [c] = await banco.select({ pessoaId: caso.pessoaId }).from(caso).where(eq(caso.id, casoId))
    const quem = pedido.usuario!.id
    const d = entrada.data
    await banco.transaction(async (tx) => {
      await tx.insert(atendimento).values({
        pessoaId: c!.pessoaId,
        casoId,
        canal: d.canal,
        responsavelId: quem,
        inicio: agora(),
        fim: agora(),
        resumo: d.resultado === 'explicado' ? d.explicado : null,
      })
      if (d.resultado === 'explicado') {
        await tx.update(tarefa).set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem }).where(eq(tarefa.id, t.id))
        await tx.update(caso).set({ fase: 'encerrado', encerradoEm: agora(), atualizadoEm: agora() }).where(eq(caso.id, casoId))
      }
    })
    await historico(quem, d.resultado === 'explicado' ? 'resultado_explicado' : 'resultado_sem_contato', pedido, `caso:${casoId}`, { canal: d.canal })
    return resposta.code(201).send({ ok: true })
  })
}
