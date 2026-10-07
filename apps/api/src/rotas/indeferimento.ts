// Do indeferido ao despacho (GGVP-52, 54): o motivo com as palavras de quem viu é escrito no próprio registro do
// indeferido (rotas/vigilia.ts; ajuste do Mateus, 06/10) e fica no banco de motivos (`resultado_inss`); aqui a Sênior
// vê o histórico e despacha (G4). Sem IA até o épico IA jurídica.
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { Despachar, Despacho, ROTULO_SETOR, pode, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { caso, decisao, documento, etapa, exigencia, exigenciaItem, pericia, pessoa, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { ORIGEM_DESPACHO, abrirPericiasDaExigencia, lacosDas, lembreteDoLaco, limitesDeCobranca } from '../fluxo/exigencia.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'

export const MSG_SEM_INDEFERIMENTO = 'Este caso não tem indeferimento registrado.'
export const MSG_NADA_A_DESPACHAR = 'Este caso não está esperando o despacho da Sênior.'

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const hoje = (agora: Date) => new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)

/**
 * O que a Sênior mandou buscar: os itens da exigência `despacho` e as perícias do D3, e quem falta (GGVP-58 CA3, CA11;
 * GGVP-63 CA1: "Pedir a petição" só libera sem ninguém faltando).
 */
export async function situacaoDoDespacho(banco: Banco, casoId: string) {
  const [x] = await banco
    .select()
    .from(exigencia)
    .where(and(eq(exigencia.casoId, casoId), eq(exigencia.origem, 'despacho')))
    .orderBy(desc(exigencia.criadoEm))
    .limit(1)
  const itens = x
    ? await banco
        .select({ item: exigenciaItem, escaladaEm: tarefa.escaladaEm, tarefaId: tarefa.id, acionadoEm: tarefa.criadoEm, concluidaEm: tarefa.concluidaEm })
        .from(exigenciaItem)
        .leftJoin(tarefa, eq(exigenciaItem.tarefaId, tarefa.id))
        .where(eq(exigenciaItem.exigenciaId, x.id))
        .orderBy(asc(exigenciaItem.perfilResponsavel), asc(exigenciaItem.descricao))
    : []
  const pericias = await banco
    .select({ tipo: pericia.tipo, resultado: pericia.resultado })
    .from(pericia)
    .innerJoin(etapa, eq(pericia.chamadaPorEtapaId, etapa.id))
    .where(and(eq(pericia.casoId, casoId), eq(etapa.diagrama, ORIGEM_DESPACHO.diagrama), eq(etapa.passo, ORIGEM_DESPACHO.passo)))
  const pendentes = itens.filter((i) => i.item.situacao === 'pendente').map((i) => ROTULO_SETOR[i.item.perfilResponsavel as 'atendimento' | 'documentacao'])
  const faltam = [...new Set(pendentes), ...(pericias.some((p) => !p.resultado) ? ['Perícia'] : [])]
  return { exigencia: x ?? null, itens, pericias, faltam }
}

export function registrarRotasIndeferimento(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  /** O último indeferimento do caso, com o cliente. */
  async function indeferimentoDo(casoId: string) {
    const [l] = await banco
      .select({ resultado: resultadoInss, cliente: pessoa.nome, beneficio: caso.beneficio })
      .from(resultadoInss)
      .innerJoin(caso, eq(resultadoInss.casoId, caso.id))
      .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
      .where(and(eq(resultadoInss.casoId, casoId), eq(resultadoInss.resultado, 'indeferido')))
      .orderBy(desc(resultadoInss.criadoEm))
      .limit(1)
    return l ?? null
  }

  const tarefaAberta = async (casoId: string, passo: string) =>
    (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, passo), isNull(tarefa.concluidaEm))).limit(1))[0] ?? null

  /** A carta e o motivo escrito, com quem e quando (GGVP-52 CA3, CA7; GGVP-54 CA1). */
  async function cartaEMotivo(r: typeof resultadoInss.$inferSelect) {
    const [carta] = r.documentoId ? await banco.select({ id: documento.id, nome: documento.nomeOriginal }).from(documento).where(eq(documento.id, r.documentoId)) : []
    const [autor] = r.motivoEscritoPor ? await banco.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, r.motivoEscritoPor)) : []
    return {
      carta: carta ?? null,
      motivoEscrito: r.motivoEscrito && autor && r.motivoEscritoEm ? { texto: r.motivoEscrito, por: autor.nome, em: r.motivoEscritoEm.toISOString() } : null,
    }
  }

  // GGVP-54 CA1, CA9 e GGVP-58 CA3, CA11: o histórico do caso, o despacho feito e o status de cada setor.
  app.get<{ Params: { id: string } }>('/api/casos/:id/despacho', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const l = await indeferimentoDo(casoId)
    if (!l) return negar(resposta, 404, MSG_SEM_INDEFERIMENTO)
    const [d] = await banco
      .select({ resultado: decisao.resultado, em: decisao.decididoEm, por: usuario.nome })
      .from(decisao)
      .innerJoin(usuario, eq(decisao.decididoPor, usuario.id))
      .where(and(eq(decisao.casoId, casoId), eq(decisao.passo, 'D3.03'), eq(decisao.tipo, 'despacho')))
      .orderBy(desc(decisao.decididoEm))
      .limit(1)
    const s = await situacaoDoDespacho(banco, casoId)
    const lacos = await lacosDas(banco, s.itens.flatMap((i) => (i.tarefaId ? [i.tarefaId] : [])))
    const aguardando = Boolean(await tarefaAberta(casoId, 'D3.03'))
    return Despacho.parse({
      casoId,
      cliente: l.cliente,
      beneficio: l.beneficio,
      indeferimento: { dataDecisao: l.resultado.dataDecisao, motivoInss: l.resultado.motivoIndeferimento, ...(await cartaEMotivo(l.resultado)) },
      despacho: d ? { decisao: d.resultado, por: d.por, em: d.em.toISOString() } : null,
      // GGVP-68 CA14 e GGVP-94 CA8, CA9: o acionamento, o laço e, no item que passou do limite, a decisão da Sênior.
      setores: s.itens.map((i) => ({
        id: i.item.id,
        setor: i.item.perfilResponsavel,
        descricao: i.item.descricao,
        prazo: i.item.prazo,
        situacao: i.item.situacao,
        escalada: Boolean(i.escaladaEm),
        acionadoEm: i.acionadoEm?.toISOString() ?? null,
        historicoDoLaco: (i.tarefaId && lacos.get(i.tarefaId)) || [],
        podeDecidir: pode(pedido.perfilAtivo, 'caso.despachar_indeferimento') && Boolean(i.escaladaEm) && !i.concluidaEm,
      })),
      pericias: s.pericias,
      faltam: s.faltam,
      podeDespachar: pode(pedido.perfilAtivo, 'caso.despachar_indeferimento') && aguardando,
      podeEncerrar: pode(pedido.perfilAtivo, 'caso.encerrar') && aguardando,
    })
  })

  // GGVP-54 CA2 a CA9 (G4): só a Sênior despacha; "nada falta" segue para a petição; os setores recebem "Cumprir pendência".
  app.post<{ Params: { id: string } }>('/api/casos/:id/despacho', { preHandler: exigir(banco, 'caso.despachar_indeferimento', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = Despachar.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o despacho.')
    const aguardando = await tarefaAberta(casoId, 'D3.03')
    if (!aguardando) return negar(resposta, 409, MSG_NADA_A_DESPACHAR)
    const d = entrada.data
    const quem = pedido.usuario!.id
    const l = await indeferimentoDo(casoId)
    const fechar = { situacao: 'concluida' as const, concluidaEm: agora(), concluidaPor: quem }
    const { limite } = await limitesDeCobranca(banco)
    const itens = d.decisao === 'acionar' ? d.itens : []
    const tipos = d.decisao === 'acionar' ? d.tiposPericia : []
    // CA9: a autora, a data e os setores acionados ficam na decisão (G4: a sugestão da IA, quando houver, vai em `sugestaoIa`).
    const setores = [...itens.map((i) => i.setor), ...tipos.map((t) => `pericia:${t}`)].join(', ')
    const feito = await banco.transaction(async (tx) => {
      const [t] = await tx
        .update(tarefa)
        .set(fechar)
        .where(and(eq(tarefa.id, aguardando.id), isNull(tarefa.concluidaEm)))
        .returning()
      if (!t) return false
      await tx
        .update(etapa)
        .set(fechar)
        .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D3.03'), isNull(etapa.concluidaEm)))
      await tx.insert(decisao).values({ casoId, passo: 'D3.03', tipo: 'despacho', resultado: d.decisao, justificativa: setores || null, decididoPor: quem, perfil: pedido.perfilAtivo!, decididoEm: agora() })
      if (d.decisao === 'acionar') {
        // CA2, CA6: um item e uma tarefa "Cumprir pendência" por pedido, na fila do setor, com o prazo só quando a Sênior deu um.
        const [x] = await tx
          .insert(exigencia)
          .values({
            casoId,
            origem: 'despacho',
            descricao: l?.resultado.motivoEscrito ?? 'Despacho da Sênior',
            recebidaEm: hoje(agora()),
            pede: itens.length ? (tipos.length ? 'pericia_e_documentos' : 'documentos') : 'pericia',
            analisadaPor: quem,
            criadoEm: agora(),
          })
          .returning()
        for (const i of itens) {
          const prazo = await lembreteDoLaco(tx, hoje(agora()), i.prazo, limite ?? 1)
          const [doSetor] = await tx
            .insert(tarefa)
            .values({ casoId, passo: 'D3.04', titulo: 'Cumprir pendência', perfilDono: i.setor, prazo, limiteTentativas: limite, criadoEm: agora() })
            .returning()
          await tx.insert(exigenciaItem).values({ exigenciaId: x.id, descricao: i.descricao, perfilResponsavel: i.setor, prazo: i.prazo, tarefaId: doSetor.id })
        }
        // CA5: a perícia vai para o Jurídico administrativo, que marca, liga, orienta e remarca; o Atendimento não recebe.
        if (tipos.length) await abrirPericiasDaExigencia(tx, casoId, tipos, quem, agora(), ORIGEM_DESPACHO)
        if (itens.length) await tx.insert(etapa).values({ casoId, diagrama: 'D3', passo: 'D3.E1', situacao: 'aguardando_externo', aguardando: 'cliente responder ou entregar', iniciadaEm: agora() })
      }
      // CA3, CA7: "Pedir a petição" nasce já, na fila das advogadas; com setor pendente, mostra quem falta (GGVP-63 CA1).
      await tx.insert(etapa).values({ casoId, diagrama: 'D3', passo: 'D3.05', situacao: 'aberta', iniciadaEm: agora() })
      await tx.insert(tarefa).values({ casoId, passo: 'D3.05', titulo: 'Pedir a petição', perfilDono: 'advogada', criadoEm: agora() })
      return true
    })
    if (!feito) return negar(resposta, 409, MSG_NADA_A_DESPACHAR)
    await historico(quem, 'caso_despachado', pedido, `caso:${casoId}`, { decisao: d.decisao, setores: itens.map((i) => i.setor), pericias: tipos })
    return resposta.code(201).send({ ok: true })
  })
}

