// Do indeferido ao despacho (GGVP-52, 54): quem viu o indeferido escreve o motivo com as suas palavras, que vai para
// o banco de motivos (`resultado_inss`), e a Sênior recebe o caso para despachar (G4). Sem IA até o épico IA jurídica.
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { Despachar, Despacho, Indeferimento, ROTULO_SETOR, RegistrarMotivo, pode, type Erro } from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { caso, decisao, documento, etapa, exigencia, exigenciaItem, pericia, pessoa, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { ORIGEM_DESPACHO, abrirPericiasDaExigencia, limitesDeCobranca } from '../fluxo/exigencia.ts'
import { somarDias } from '../fluxo/prazo-inss.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { TIPOS_DE_ANEXO, guardarArquivo, lerFormulario } from './formulario.ts'
import { MSG_CARTA } from './vigilia.ts'

export const MSG_SEM_INDEFERIMENTO = 'Este caso não tem indeferimento registrado.'
export const MSG_MOTIVO_JA_REGISTRADO = 'O motivo deste indeferimento já foi registrado.'
export const MSG_NADA_A_DESPACHAR = 'Este caso não está esperando o despacho da Sênior.'

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const hoje = (agora: Date) => new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)

export function registrarRotasIndeferimento(app: FastifyInstance, { banco, armazenamento, agora = () => new Date() }: Opcoes) {
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

  // GGVP-52 CA3, CA7: a carta, o motivo do INSS e o motivo escrito, com quem e quando.
  app.get<{ Params: { id: string } }>('/api/casos/:id/indeferimento', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const l = await indeferimentoDo(casoId)
    if (!l) return negar(resposta, 404, MSG_SEM_INDEFERIMENTO)
    const r = l.resultado
    return Indeferimento.parse({
      casoId,
      cliente: l.cliente,
      beneficio: l.beneficio,
      dataDecisao: r.dataDecisao,
      motivoInss: r.motivoIndeferimento,
      ...(await cartaEMotivo(r)),
      podeRegistrar: pode(pedido.perfilAtivo, 'inss.registrar_resposta') && Boolean(await tarefaAberta(casoId, 'D3.01')),
    })
  })

  // GGVP-52 CA1, CA2, CA4 a CA7: motivo e carta obrigatórios; grava no banco de motivos sem duplicar e o despacho nasce.
  app.post<{ Params: { id: string } }>('/api/casos/:id/indeferimento/motivo', { preHandler: exigir(banco, 'inss.registrar_resposta', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const formulario = await lerFormulario(pedido)
    if (!formulario) return negar(resposta, 400, MSG_CARTA)
    const entrada = RegistrarMotivo.safeParse({ motivo: formulario.campos.motivo })
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Escreva o motivo.')
    const l = await indeferimentoDo(casoId)
    if (!l) return negar(resposta, 404, MSG_SEM_INDEFERIMENTO)
    const registro = await tarefaAberta(casoId, 'D3.01')
    if (!registro) return negar(resposta, 409, MSG_MOTIVO_JA_REGISTRADO)
    // CA4: a carta do registro do indeferido vale; o arquivo só é pedido se ela faltar.
    const arquivo = formulario.arquivo
    if (!l.resultado.documentoId && !(arquivo && TIPOS_DE_ANEXO.includes(arquivo.mime))) return negar(resposta, 400, MSG_CARTA)
    const quem = pedido.usuario!.id
    const carta = !l.resultado.documentoId && arquivo ? await guardarArquivo(armazenamento, casoId, arquivo, 'carta-indeferimento') : null
    const fechar = { situacao: 'concluida' as const, concluidaEm: agora(), concluidaPor: quem }
    const feito = await banco.transaction(async (tx) => {
      // CA5: duas confirmações ao mesmo tempo não duplicam: só uma conclui a tarefa.
      const [t] = await tx
        .update(tarefa)
        .set(fechar)
        .where(and(eq(tarefa.id, registro.id), isNull(tarefa.concluidaEm)))
        .returning()
      if (!t) return false
      const [doc] = carta ? await tx.insert(documento).values({ casoId, tipo: 'carta_indeferimento', origem: 'portal', recebidoPor: quem, ...carta }).returning() : []
      await tx
        .update(resultadoInss)
        .set({ motivoEscrito: entrada.data.motivo, motivoEscritoPor: quem, motivoEscritoEm: agora(), ...(doc ? { documentoId: doc.id } : {}) })
        .where(eq(resultadoInss.id, l.resultado.id))
      await tx
        .update(etapa)
        .set(fechar)
        .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D3.01'), isNull(etapa.concluidaEm)))
      // CA6: sem IA, o despacho da Sênior nasce direto (GGVP-54).
      await tx.insert(etapa).values({ casoId, diagrama: 'D3', passo: 'D3.03', situacao: 'aberta', iniciadaEm: agora() })
      await tx.insert(tarefa).values({ casoId, passo: 'D3.03', titulo: 'Despachar caso', perfilDono: 'senior', criadoEm: agora() })
      return true
    })
    if (!feito) return negar(resposta, 409, MSG_MOTIVO_JA_REGISTRADO)
    // CA7: na linha do processo, com autor e data (o texto fica no banco de motivos, não no histórico).
    await historico(quem, 'indeferimento_motivo_registrado', pedido, `caso:${casoId}`, { resultado: l.resultado.id })
    return resposta.code(201).send({ ok: true })
  })

  /** O que a Sênior mandou buscar: os itens da exigência `despacho` e as perícias do D3 (GGVP-58 CA3, CA11). */
  async function situacaoDoDespacho(casoId: string) {
    const [x] = await banco
      .select()
      .from(exigencia)
      .where(and(eq(exigencia.casoId, casoId), eq(exigencia.origem, 'despacho')))
      .orderBy(desc(exigencia.criadoEm))
      .limit(1)
    const itens = x
      ? await banco
          .select({ item: exigenciaItem, escaladaEm: tarefa.escaladaEm })
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
    const s = await situacaoDoDespacho(casoId)
    const aguardando = Boolean(await tarefaAberta(casoId, 'D3.03'))
    return Despacho.parse({
      casoId,
      cliente: l.cliente,
      beneficio: l.beneficio,
      indeferimento: { dataDecisao: l.resultado.dataDecisao, motivoInss: l.resultado.motivoIndeferimento, ...(await cartaEMotivo(l.resultado)) },
      despacho: d ? { decisao: d.resultado, por: d.por, em: d.em.toISOString() } : null,
      setores: s.itens.map((i) => ({ setor: i.item.perfilResponsavel, descricao: i.item.descricao, prazo: i.item.prazo, situacao: i.item.situacao, escalada: Boolean(i.escaladaEm) })),
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
    const { limite, intervaloDias } = await limitesDeCobranca(banco)
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
          const lembrete = intervaloDias ? somarDias(hoje(agora()), intervaloDias) : null
          const prazo = lembrete && i.prazo ? (lembrete < i.prazo ? lembrete : i.prazo) : (lembrete ?? i.prazo)
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

