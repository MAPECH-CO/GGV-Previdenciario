// Confirmar o desfecho de mérito (GGVP-90, CA3 e CA4): a decisão de mérito que a vigília encaminha abre "Confirmar
// desfecho" (D4.02); a advogada confirma e o caso segue no D3b. Sem a confirmação, nada avança (orquestrador, 09/10).
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { ConfirmarDesfecho, DesfechoParaConfirmar, ehProcedente, pode, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { caso, decisao, etapa, eventoAuditoria, pessoa, publicacao, tarefa, usuario } from '../banco/esquema.ts'
import { feriadosDoProcesso, prazoJudicial } from '../fluxo/prazo-judicial.ts'
import { exigir } from '../sessao/rotas.ts'

export const PASSO_CONFIRMAR = 'D4.02'
export const PASSO_PAGAMENTO = 'D3b.01'
/** Improcedente e extinção: a Sênior decide se recorre (GGVP-100, D3b.04); quem escreve e protocola o recurso são as Sêniores (Lucas, 09/10). */
export const PASSO_DECIDIR_RECURSO = 'D3b.04'
export const TITULO_PAGAMENTO = 'Acompanhar pagamento'
export const TITULO_DECIDIR_RECURSO = 'Decidir recurso'
/** O lado seguro do prazo do recurso (G12): 10 dias úteis, o menor entre o recurso inominado do JEF e a apelação, como no #35. */
export const DIAS_DO_RECURSO = 10

type Tx = Parameters<Parameters<Banco['transaction']>[0]>[0]

/** O prazo do recurso pelo lado seguro (G12): o da publicação ou 10 dias úteis da sentença, o que vier antes. */
async function prazoDoRecurso(banco: Pick<Banco, 'select'>, sentenca: { em: string; cnj: string | null } | undefined, prazoDaPublicacao: string | null) {
  const fim = sentenca ? prazoJudicial(sentenca.em, DIAS_DO_RECURSO, await feriadosDoProcesso(banco, sentenca.cnj)).fim : null
  return prazoDaPublicacao && (!fim || prazoDaPublicacao < fim) ? prazoDaPublicacao : fim
}

/**
 * "Decidir recurso" (D3b.04) para a Sênior, com o prazo do recurso, se não houver uma aberta. O mesmo formato do
 * `abrirDecisaoDoRecurso` do #35 (GGVP-100): quando ele entrar, troca-se por "await abrirDecisaoDoRecurso(tx, casoId)".
 */
async function abrirDecisaoDoRecurso(tx: Tx, casoId: string, prazoDaPublicacao: string | null) {
  const [aberta] = await tx
    .select({ id: tarefa.id })
    .from(tarefa)
    .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, PASSO_DECIDIR_RECURSO), isNull(tarefa.concluidaEm)))
    .limit(1)
  if (aberta) return
  const [sentenca] = await tx
    .select({ em: publicacao.disponibilizadaEm, cnj: publicacao.numeroCnj })
    .from(publicacao)
    .where(and(eq(publicacao.casoId, casoId), eq(publicacao.classe, 'merito')))
    .orderBy(desc(publicacao.disponibilizadaEm))
    .limit(1)
  const prazo = await prazoDoRecurso(tx, sentenca, prazoDaPublicacao)
  await tx.insert(tarefa).values({ casoId, passo: PASSO_DECIDIR_RECURSO, titulo: TITULO_DECIDIR_RECURSO, perfilDono: 'senior', prazo })
}
export const MSG_SEM_DESFECHO_ESPERANDO = 'Não há desfecho esperando a confirmação neste caso.'

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasDesfecho(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const aberta = async (casoId: string) =>
    (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, PASSO_CONFIRMAR), isNull(tarefa.concluidaEm))).limit(1))[0] ?? null

  // CA3: o trecho da decisão, a leitura da IA com a confiança e o prazo do recurso; CA4: quem confirmou e quando.
  app.get<{ Params: { id: string } }>('/api/casos/:id/desfecho', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const [c] = await banco
      .select({ fichaId: caso.pessoaId, nome: pessoa.nome, beneficio: caso.beneficio })
      .from(caso)
      .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
      .where(eq(caso.id, casoId))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    const [d] = await banco
      .select({ em: publicacao.disponibilizadaEm, fonte: publicacao.fonte, cnj: publicacao.numeroCnj, texto: publicacao.texto, sugerida: publicacao.classeSugeridaIa, confianca: publicacao.confiancaIa })
      .from(publicacao)
      .where(and(eq(publicacao.casoId, casoId), eq(publicacao.classe, 'merito')))
      .orderBy(desc(publicacao.disponibilizadaEm))
      .limit(1)
    const [ultima] = await banco
      .select({ prazo: tarefa.prazo })
      .from(tarefa)
      .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, PASSO_CONFIRMAR)))
      .orderBy(desc(tarefa.criadoEm))
      .limit(1)
    const [feita] = await banco
      .select({ desfecho: decisao.resultado, texto: decisao.justificativa, em: decisao.decididoEm, por: usuario.nome })
      .from(decisao)
      .innerJoin(usuario, eq(decisao.decididoPor, usuario.id))
      .where(and(eq(decisao.casoId, casoId), eq(decisao.tipo, 'desfecho_merito')))
      .orderBy(desc(decisao.decididoEm))
      .limit(1)
    const pendente = await aberta(casoId)
    return DesfechoParaConfirmar.parse({
      casoId,
      fichaId: c.fichaId,
      cliente: c.nome,
      beneficio: c.beneficio,
      decisao: d ? { disponibilizadaEm: d.em, fonte: d.fonte, numeroCnj: d.cnj, texto: d.texto, classeSugeridaIa: d.sugerida, confiancaIa: d.confianca === null ? null : Number(d.confianca) } : null,
      prazoRecurso: await prazoDoRecurso(banco, d, ultima?.prazo ?? null),
      // ponytail: a decisão guarda a forma (procedente) ou a causa (extinção) no mesmo campo; coluna própria se precisar das duas.
      confirmado:
        feita && !pendente
          ? {
              desfecho: feita.desfecho,
              causa: ehProcedente(feita.desfecho) ? null : feita.texto,
              forma: ehProcedente(feita.desfecho) ? feita.texto : null,
              por: feita.por,
              em: feita.em.toISOString(),
            }
          : null,
      podeConfirmar: pode(pedido.perfilAtivo, 'publicacao.classificar') && pendente !== null,
    })
  })

  // CA3, CA4: a advogada (ou a Sênior) confirma; o caso guarda o desfecho, a decisão guarda quem e quando, e abre o passo seguinte.
  app.post<{ Params: { id: string } }>('/api/casos/:id/desfecho', { preHandler: exigir(banco, 'publicacao.classificar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = ConfirmarDesfecho.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o desfecho.')
    const pendente = await aberta(casoId)
    if (!pendente) return negar(resposta, 409, MSG_SEM_DESFECHO_ESPERANDO)
    const { desfecho, causa, forma } = entrada.data
    const quem = pedido.usuario!.id
    const procedente = ehProcedente(desfecho)
    const feito = await banco.transaction(async (tx) => {
      // A condição vai no próprio update: duas confirmações ao mesmo tempo, só a primeira fecha a tarefa e segue.
      const [fechada] = await tx
        .update(tarefa)
        .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem })
        .where(and(eq(tarefa.id, pendente.id), isNull(tarefa.concluidaEm)))
        .returning({ id: tarefa.id })
      if (!fechada) return false
      await tx
        .update(etapa)
        .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem })
        .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, PASSO_CONFIRMAR), isNull(etapa.concluidaEm)))
      const [c] = await tx
        .update(caso)
        .set({ desfecho, causaDesfecho: desfecho === 'extinto_sem_merito' ? causa! : null, atualizadoEm: agora() })
        .where(eq(caso.id, casoId))
        .returning({ advogadaId: caso.advogadaResponsavelId })
      const [lida] = await tx
        .select({ id: publicacao.id, sugerida: publicacao.classeSugeridaIa, confianca: publicacao.confiancaIa })
        .from(publicacao)
        .where(and(eq(publicacao.casoId, casoId), eq(publicacao.classe, 'merito')))
        .orderBy(desc(publicacao.disponibilizadaEm))
        .limit(1)
      await tx.insert(decisao).values({
        casoId,
        passo: PASSO_CONFIRMAR,
        tipo: 'desfecho_merito',
        resultado: desfecho,
        justificativa: procedente ? (forma ?? null) : desfecho === 'extinto_sem_merito' ? causa! : null,
        // A leitura da IA que a advogada tinha à frente fica à parte do que ela decidiu.
        sugestaoIa: lida ? { publicacao: lida.id, classe: lida.sugerida, confianca: lida.confianca } : null,
        decididoPor: quem,
        perfil: pedido.perfilAtivo!,
        decididoEm: agora(),
      })
      // CA4: procedente segue para o pagamento, com a advogada responsável; improcedente e extinção, para a Sênior decidir
      // o recurso, com o prazo pelo lado seguro.
      if (procedente) {
        await tx.insert(etapa).values({ casoId, diagrama: 'D3b', passo: PASSO_PAGAMENTO, situacao: 'aberta', iniciadaEm: agora() })
        await tx.insert(tarefa).values({ casoId, passo: PASSO_PAGAMENTO, titulo: TITULO_PAGAMENTO, perfilDono: 'advogada', responsavelId: c?.advogadaId ?? null })
      } else await abrirDecisaoDoRecurso(tx, casoId, pendente.prazo)
      await tx.insert(eventoAuditoria).values({ quem, acao: 'desfecho_confirmado', alvo: `caso:${casoId}`, quando: agora(), detalhe: { ip: pedido.ip, desfecho, forma: forma ?? null } })
      return true
    })
    if (!feito) return negar(resposta, 409, MSG_SEM_DESFECHO_ESPERANDO)
    return resposta.code(201).send({ ok: true })
  })
}
