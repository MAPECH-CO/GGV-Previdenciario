// Exigência do juiz (GGVP-79, 83, 87): a advogada analisa e distribui aos setores (G5); cada setor cumpre com
// tentativas limitadas e prova (G15, G21); com tudo provado, a advogada manifesta. Reaproveita `exigencia` com a
// origem `juizo`, os itens, a cobrança e a perícia da exigência do INSS.
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { AnalisarExigenciaJuiz, DecidirVencida, ExigenciaDoJuiz, ItensDoSetor, NaoVouConseguir, ROTULO_SETOR, RegistrarTentativa, pode, type Erro } from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { caso, decisao, documento, etapa, exigencia, exigenciaItem, pericia, pessoa, prazo, publicacao, tarefa, tentativa, usuario } from '../banco/esquema.ts'
import { ORIGEM_JUIZ, abrirPericiasDaExigencia, limitesDeCobranca } from '../fluxo/exigencia.ts'
import { somarDias } from '../fluxo/prazo-inss.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { TIPOS_DE_ANEXO, guardarArquivo, lerFormulario } from './formulario.ts'
import { abrirManifestacaoSePronta } from './manifestacao.ts'

export const MSG_NADA_A_ANALISAR = 'Não há exigência do juiz esperando a análise neste caso.'
export const MSG_EVIDENCIA = 'Anexe o documento do item (PDF ou imagem, até 25 MB).'
export const MSG_ITEM_DE_OUTRO_SETOR = 'Este item é de outro setor.'

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const hoje = (agora: Date) => new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)
const br = (iso: string) => iso.split('-').reverse().join('/')
const SITUACAO = { aberta: 'em_cumprimento', cumprida: 'cumprida', vencida: 'vencida', dilacao_pedida: 'dilacao_pedida' } as const

export function registrarRotasExigenciaJuiz(app: FastifyInstance, { banco, armazenamento, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  /** A exigência do juiz do caso: a que espera a análise (tarefa D3a.02 aberta) ou a última distribuída. */
  async function exigenciaDoCaso(casoId: string) {
    const [analise] = await banco
      .select({ tarefa, prazo, publicacao })
      .from(tarefa)
      .innerJoin(prazo, eq(tarefa.prazoProcessualId, prazo.id))
      .innerJoin(publicacao, eq(prazo.publicacaoId, publicacao.id))
      .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3a.02'), isNull(tarefa.concluidaEm)))
      .orderBy(desc(tarefa.criadoEm))
      .limit(1)
    if (analise) return { tarefaAnalise: analise.tarefa, prazo: analise.prazo, publicacao: analise.publicacao, exigencia: null }
    const [x] = await banco
      .select()
      .from(exigencia)
      .where(and(eq(exigencia.casoId, casoId), eq(exigencia.origem, 'juizo')))
      .orderBy(desc(exigencia.criadoEm))
      .limit(1)
    if (!x?.publicacaoId) return null
    const [p] = await banco.select().from(publicacao).where(eq(publicacao.id, x.publicacaoId))
    const [pz] = await banco.select().from(prazo).where(eq(prazo.publicacaoId, x.publicacaoId)).orderBy(desc(prazo.criadoEm)).limit(1)
    return p && pz ? { tarefaAnalise: null, prazo: pz, publicacao: p, exigencia: x } : null
  }

  // GGVP-79 CA5 e GGVP-83 CA2, CA3, CA10: o texto, o prazo com a regra, os itens, o status de cada setor e quem falta.
  app.get<{ Params: { id: string } }>('/api/casos/:id/exigencia-juiz', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const [c] = await banco.select({ nome: pessoa.nome }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
    const e = c ? await exigenciaDoCaso(casoId) : null
    if (!c || !e) return negar(resposta, 404, MSG_NADA_A_ANALISAR)
    const [ciencia] = await banco
      .select({ id: decisao.id })
      .from(decisao)
      .where(and(eq(decisao.casoId, casoId), eq(decisao.passo, 'D3a.02'), eq(decisao.resultado, 'ciencia'), eq(decisao.justificativa, e.publicacao.id)))
    const itens = e.exigencia
      ? await banco
          .select({ item: exigenciaItem, prova: documento.nomeOriginal, tarefa })
          .from(exigenciaItem)
          .leftJoin(documento, eq(exigenciaItem.provaDocumentoId, documento.id))
          .leftJoin(tarefa, eq(exigenciaItem.tarefaId, tarefa.id))
          .where(eq(exigenciaItem.exigenciaId, e.exigencia.id))
          .orderBy(asc(exigenciaItem.perfilResponsavel), asc(exigenciaItem.descricao))
      : []
    const [eP] = e.exigencia
      ? await banco
          .select({ id: etapa.id })
          .from(etapa)
          .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, ORIGEM_JUIZ.passo), eq(etapa.situacao, 'concluida')))
          .orderBy(desc(etapa.iniciadaEm))
          .limit(1)
      : []
    const pericias = eP ? await banco.select({ tipo: pericia.tipo, resultado: pericia.resultado }).from(pericia).where(eq(pericia.chamadaPorEtapaId, eP.id)) : []
    const faltam = [
      ...new Set(itens.filter((i) => i.item.situacao !== 'cumprido').map((i) => ROTULO_SETOR[i.item.perfilResponsavel as keyof typeof ROTULO_SETOR] ?? i.item.perfilResponsavel)),
      ...(pericias.some((p) => p.resultado === null) ? ['Perícia'] : []),
    ]
    const situacao = e.exigencia ? SITUACAO[e.exigencia.situacao as keyof typeof SITUACAO] : ciencia ? 'ciencia' : 'a_analisar'
    const vencida =
      Boolean(e.exigencia && ['aberta', 'dilacao_pedida'].includes(e.exigencia.situacao) && e.exigencia.prazo && e.exigencia.prazo < hoje(agora())) &&
      itens.some((i) => i.item.situacao !== 'cumprido')
    return ExigenciaDoJuiz.parse({
      casoId,
      cliente: c.nome,
      publicacaoId: e.publicacao.id,
      texto: e.publicacao.texto,
      disponibilizadaEm: e.publicacao.disponibilizadaEm,
      prazo: { inicio: e.prazo.inicio, fim: e.prazo.fim, regra: e.prazo.regra, versao: e.prazo.regraVersao },
      situacao,
      itens: itens.map((i) => ({
        id: i.item.id,
        setor: i.item.perfilResponsavel,
        descricao: i.item.descricao,
        provaEsperada: i.item.provaEsperada,
        prazoInterno: i.item.prazo,
        situacao: i.item.situacao,
        prova: i.prova,
        tentativas: i.tarefa?.tentativas ?? 0,
        limite: i.tarefa?.limiteTentativas ?? null,
        escalada: Boolean(i.tarefa?.escaladaEm),
      })),
      pericias,
      faltam,
      podeDistribuir: pode(pedido.perfilAtivo, 'exigencia_juiz.distribuir') && situacao === 'a_analisar',
      vencida,
      podeDecidirVencida: pode(pedido.perfilAtivo, 'exigencia_inss.decidir_vencida') && vencida,
    })
  })

  // GGVP-79 CA1, CA2, CA6 a CA10, CA13: "só ciência" ou "precisa cumprir", com os itens por setor (G5, G21).
  app.post<{ Params: { id: string } }>('/api/casos/:id/exigencia-juiz', { preHandler: exigir(banco, 'exigencia_juiz.distribuir', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = AnalisarExigenciaJuiz.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const e = await exigenciaDoCaso(casoId)
    if (!e?.tarefaAnalise) return negar(resposta, 409, MSG_NADA_A_ANALISAR)
    const d = entrada.data
    const fim = e.prazo.fim
    // CA7: o prazo interno não passa do prazo do processo.
    if (d.decisao === 'cumprir' && d.itens.some((i) => i.prazoInterno > fim)) return negar(resposta, 400, `O prazo interno não pode passar do prazo do processo (${br(fim)}).`)
    const quem = pedido.usuario!.id
    const fechar = { situacao: 'concluida' as const, concluidaEm: agora(), concluidaPor: quem }
    const { limite, intervaloDias } = await limitesDeCobranca(banco)
    await banco.transaction(async (tx) => {
      // G5: a decisão fica com quem decidiu e quando (a publicação vai na justificativa, para achar a ciência depois).
      await tx.insert(decisao).values({
        casoId,
        passo: 'D3a.02',
        tipo: 'exigencia_juiz',
        resultado: d.decisao,
        justificativa: e.publicacao.id,
        decididoPor: quem,
        perfil: pedido.perfilAtivo!,
        decididoEm: agora(),
      })
      await tx.update(tarefa).set(fechar).where(eq(tarefa.id, e.tarefaAnalise!.id))
      await tx
        .update(etapa)
        .set(fechar)
        .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D3a.02'), isNull(etapa.concluidaEm)))
      // CA2, CA6: só ciência, nenhuma tarefa; o processo segue na vigília.
      if (d.decisao === 'ciencia') return
      const temItens = d.itens.length > 0
      const [x] = await tx
        .insert(exigencia)
        .values({
          casoId,
          origem: 'juizo',
          descricao: e.publicacao.texto,
          recebidaEm: e.publicacao.disponibilizadaEm,
          prazo: fim,
          publicacaoId: e.publicacao.id,
          pede: temItens ? (d.tiposPericia.length ? 'pericia_e_documentos' : 'documentos') : 'pericia',
          analisadaPor: quem,
          criadoEm: agora(),
        })
        .returning()
      // CA1, CA10, CA13: um item e uma tarefa por pedido, na Central do setor, com o prazo interno e o processual ao lado.
      for (const i of d.itens) {
        const lembrete = intervaloDias ? somarDias(hoje(agora()), intervaloDias) : i.prazoInterno
        const [t] = await tx
          .insert(tarefa)
          .values({
            casoId,
            passo: 'D3a.03',
            titulo: 'Cumprir exigência do juiz',
            perfilDono: i.setor,
            prazo: lembrete < i.prazoInterno ? lembrete : i.prazoInterno,
            prazoProcessualId: e.prazo.id,
            limiteTentativas: limite,
          })
          .returning()
        await tx
          .insert(exigenciaItem)
          .values({ exigenciaId: x.id, descricao: i.descricao, perfilResponsavel: i.setor, prazo: i.prazoInterno, provaEsperada: i.provaEsperada, tarefaId: t.id })
      }
      // CA8: a perícia pedida pelo juiz abre sozinha a tarefa do Jurídico administrativo, com a origem D3a.
      if (d.tiposPericia.length) await abrirPericiasDaExigencia(tx, casoId, d.tiposPericia, quem, agora(), ORIGEM_JUIZ)
      if (temItens) await tx.insert(etapa).values({ casoId, diagrama: 'D3a', passo: 'D3a.E2', situacao: 'aguardando_externo', aguardando: 'cliente responder ou entregar', iniciadaEm: agora() })
    })
    await historico(quem, d.decisao === 'ciencia' ? 'exigencia_juiz_ciencia' : 'exigencia_juiz_distribuida', pedido, `caso:${casoId}`, {
      publicacao: e.publicacao.id,
      itens: d.decisao === 'cumprir' ? d.itens.length : 0,
    })
    return resposta.code(201).send({ ok: true })
  })

  /** O setor do perfil ativo: o líder do Atendimento cumpre o que é do Atendimento. */
  const setorDo = (perfil: string | null | undefined) => (perfil === 'atendimento_lider' ? 'atendimento' : (perfil ?? ''))

  /** O item, da exigência do juiz aberta do caso, e a tarefa do setor que o cumpre. */
  async function itemDoCaso(casoId: string, itemId: string) {
    const [l] = await banco
      .select({ item: exigenciaItem, exigencia, tarefa })
      .from(exigenciaItem)
      .innerJoin(exigencia, eq(exigenciaItem.exigenciaId, exigencia.id))
      .leftJoin(tarefa, eq(exigenciaItem.tarefaId, tarefa.id))
      .where(and(eq(exigenciaItem.id, itemId), eq(exigencia.casoId, casoId), eq(exigencia.origem, 'juizo')))
    return l ?? null
  }

  async function subirParaSenior(casoId: string, tarefaId: string, motivo: string) {
    await banco.update(tarefa).set({ escaladaEm: agora(), escaladaPara: 'senior' }).where(eq(tarefa.id, tarefaId))
    await banco.insert(tarefa).values({ casoId, passo: 'D3a.03s', titulo: `Exigência do juiz sem retorno: ${motivo}`, perfilDono: 'senior' })
  }

  // GGVP-83 CA4, CA13: os itens do setor, com o pedido, quem pediu, o prazo interno, o processual e as tentativas.
  app.get<{ Params: { id: string } }>('/api/casos/:id/exigencia-juiz/setor', { preHandler: exigir(banco, 'exigencia_juiz.cumprir', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const setor = setorDo(pedido.perfilAtivo)
    const [c] = await banco.select({ nome: pessoa.nome }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
    const [x] = await banco
      .select()
      .from(exigencia)
      .where(and(eq(exigencia.casoId, casoId), eq(exigencia.origem, 'juizo')))
      .orderBy(desc(exigencia.criadoEm))
      .limit(1)
    if (!c || !x) return negar(resposta, 404, 'Não há exigência do juiz para o seu setor neste caso.')
    const linhas = await banco
      .select({ item: exigenciaItem, prova: documento.nomeOriginal, tarefa })
      .from(exigenciaItem)
      .leftJoin(documento, eq(exigenciaItem.provaDocumentoId, documento.id))
      .leftJoin(tarefa, eq(exigenciaItem.tarefaId, tarefa.id))
      .where(and(eq(exigenciaItem.exigenciaId, x.id), eq(exigenciaItem.perfilResponsavel, setor)))
      .orderBy(asc(exigenciaItem.descricao))
    const [quem] = x.analisadaPor ? await banco.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, x.analisadaPor)) : []
    const itens = []
    for (const l of linhas) {
      const tentativas = l.tarefa
        ? await banco
            .select({ quando: tentativa.quando, canal: tentativa.canal, resultado: tentativa.resultado, quem: usuario.nome })
            .from(tentativa)
            .innerJoin(usuario, eq(tentativa.registradaPor, usuario.id))
            .where(eq(tentativa.tarefaId, l.tarefa.id))
            .orderBy(asc(tentativa.quando))
        : []
      itens.push({
        id: l.item.id,
        descricao: l.item.descricao,
        provaEsperada: l.item.provaEsperada,
        prazoInterno: l.item.prazo,
        situacao: l.item.situacao,
        prova: l.prova,
        proximoLembrete: l.tarefa && !l.tarefa.concluidaEm ? l.tarefa.prazo : null,
        limite: l.tarefa?.limiteTentativas ?? null,
        escalada: Boolean(l.tarefa?.escaladaEm),
        tentativas: tentativas.map((t) => ({ quando: t.quando.toISOString(), canal: t.canal ?? '', resultado: t.resultado, quem: t.quem })),
      })
    }
    return ItensDoSetor.parse({ casoId, cliente: c.nome, setor, pedidoPor: quem?.nome ?? null, prazoProcessual: x.prazo, itens })
  })

  /** Confere que o item é do setor de quem pede e ainda está aberto. */
  async function itemDoSetor(casoId: string, itemId: string, perfil: string | null | undefined, resposta: FastifyReply) {
    const l = await itemDoCaso(casoId, itemId)
    if (!l || !l.tarefa) return void negar(resposta, 404, 'Item não encontrado.')
    if (l.item.perfilResponsavel !== setorDo(perfil)) return void negar(resposta, 403, MSG_ITEM_DE_OUTRO_SETOR)
    if (l.item.situacao === 'cumprido') return void negar(resposta, 409, 'Este item já foi cumprido.')
    return l as typeof l & { tarefa: NonNullable<typeof l.tarefa> }
  }

  // GGVP-83 CA5, CA7, CA8 (G15): a tentativa conta no limite; no limite, sobe para a Sênior e continua com o setor.
  app.post<{ Params: { id: string; item: string } }>(
    '/api/casos/:id/exigencia-juiz/itens/:item/tentativas',
    { preHandler: exigir(banco, 'exigencia_juiz.cumprir', agora) },
    async (pedido, resposta) => {
      const entrada = RegistrarTentativa.safeParse(pedido.body)
      if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
      const l = await itemDoSetor(pedido.params.id, pedido.params.item, pedido.perfilAtivo, resposta)
      if (!l) return resposta
      const quem = pedido.usuario!.id
      const { intervaloDias } = await limitesDeCobranca(banco)
      const numero = l.tarefa.tentativas + 1
      const lembrete = intervaloDias ? somarDias(hoje(agora()), intervaloDias) : l.tarefa.prazo
      const escala = l.tarefa.limiteTentativas !== null && numero >= l.tarefa.limiteTentativas && !l.tarefa.escaladaEm
      await banco.insert(tentativa).values({ tarefaId: l.tarefa.id, quando: agora(), canal: entrada.data.canal, resultado: entrada.data.resultado, registradaPor: quem })
      await banco
        .update(tarefa)
        .set({ tentativas: numero, prazo: lembrete && l.item.prazo && lembrete > l.item.prazo ? l.item.prazo : lembrete })
        .where(eq(tarefa.id, l.tarefa.id))
      if (escala) await subirParaSenior(pedido.params.id, l.tarefa.id, `${l.item.descricao} (limite de tentativas)`)
      await historico(quem, 'tentativa_exigencia_juiz', pedido, `caso:${pedido.params.id}`, { item: l.item.id, numero, escalada: escala })
      return resposta.code(201).send({ ok: true, tentativas: numero, escalada: escala })
    },
  )

  // GGVP-83 CA14: o setor que sabe que não vai conseguir sobe antes do limite, com o motivo.
  app.post<{ Params: { id: string; item: string } }>(
    '/api/casos/:id/exigencia-juiz/itens/:item/nao-vou-conseguir',
    { preHandler: exigir(banco, 'exigencia_juiz.cumprir', agora) },
    async (pedido, resposta) => {
      const entrada = NaoVouConseguir.safeParse(pedido.body)
      if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Escreva o motivo.')
      const l = await itemDoSetor(pedido.params.id, pedido.params.item, pedido.perfilAtivo, resposta)
      if (!l) return resposta
      if (l.tarefa.escaladaEm) return negar(resposta, 409, 'Este item já está com a Sênior.')
      await banco.update(exigenciaItem).set({ motivo: entrada.data.motivo }).where(eq(exigenciaItem.id, l.item.id))
      await subirParaSenior(pedido.params.id, l.tarefa.id, `${l.item.descricao}: ${entrada.data.motivo}`)
      await historico(pedido.usuario!.id, 'exigencia_juiz_nao_vai_conseguir', pedido, `caso:${pedido.params.id}`, { item: l.item.id })
      return resposta.code(201).send({ ok: true })
    },
  )

  // GGVP-83 CA1, CA6, CA11 (G21): só sai do laço cumprindo, com o documento, que vira a prova do item.
  app.post<{ Params: { id: string; item: string } }>(
    '/api/casos/:id/exigencia-juiz/itens/:item/prova',
    { preHandler: exigir(banco, 'exigencia_juiz.cumprir', agora) },
    async (pedido, resposta) => {
      const formulario = await lerFormulario(pedido)
      const arquivo = formulario?.arquivo
      if (!arquivo || !TIPOS_DE_ANEXO.includes(arquivo.mime)) return negar(resposta, 400, MSG_EVIDENCIA)
      const casoId = pedido.params.id
      const l = await itemDoSetor(casoId, pedido.params.item, pedido.perfilAtivo, resposta)
      if (!l) return resposta
      const quem = pedido.usuario!.id
      const dados = await guardarArquivo(armazenamento, casoId, arquivo, 'prova-exigencia-juiz')
      await banco.transaction(async (tx) => {
        const [doc] = await tx.insert(documento).values({ casoId, tipo: 'prova_exigencia_juiz', origem: 'portal', recebidoPor: quem, ...dados }).returning()
        await tx
          .update(exigenciaItem)
          .set({ situacao: 'cumprido', provaDocumentoId: doc.id, cumpridoEm: agora(), cumpridoPor: quem })
          .where(eq(exigenciaItem.id, l.item.id))
        // CA11: concluída, a tarefa não tem mais lembrete.
        await tx
          .update(tarefa)
          .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem, prazo: null, evidenciaDocumentoId: doc.id })
          .where(eq(tarefa.id, l.tarefa.id))
      })
      await historico(quem, 'exigencia_juiz_item_cumprido', pedido, `caso:${casoId}`, { item: l.item.id })
      // GGVP-87 CA1: com o último item provado (e a perícia resolvida), nasce "Manifestar no processo".
      await abrirManifestacaoSePronta(banco, casoId, agora())
      return resposta.code(201).send({ ok: true })
    },
  )

  // GGVP-87 CA4 (resposta do revisor de 06/10): vencida com item sem prova, a Sênior pede dilação ou registra a perda.
  app.post<{ Params: { id: string } }>('/api/casos/:id/exigencia-juiz/vencida', { preHandler: exigir(banco, 'exigencia_inss.decidir_vencida', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = DecidirVencida.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const [x] = await banco
      .select()
      .from(exigencia)
      .where(and(eq(exigencia.casoId, casoId), eq(exigencia.origem, 'juizo')))
      .orderBy(desc(exigencia.criadoEm))
      .limit(1)
    if (!x || !['aberta', 'dilacao_pedida'].includes(x.situacao) || !x.prazo || x.prazo >= hoje(agora())) return negar(resposta, 409, 'A exigência não está vencida.')
    const quem = pedido.usuario!.id
    const d = entrada.data
    await banco.transaction(async (tx) => {
      if (d.decisao === 'dilacao') return void (await tx.update(exigencia).set({ situacao: 'dilacao_pedida', prazo: d.novoPrazo }).where(eq(exigencia.id, x.id)))
      await tx.update(exigencia).set({ situacao: 'vencida' }).where(eq(exigencia.id, x.id))
      await tx
        .update(tarefa)
        .set({ situacao: 'cancelada', concluidaEm: agora(), concluidaPor: quem })
        .where(and(eq(tarefa.casoId, casoId), inArray(tarefa.passo, ['D3a.03', 'D3a.03s', 'D3a.04']), isNull(tarefa.concluidaEm)))
    })
    await historico(quem, d.decisao === 'dilacao' ? 'exigencia_juiz_dilacao_pedida' : 'exigencia_juiz_perdida', pedido, `caso:${casoId}`, d)
    return resposta.code(201).send({ ok: true })
  })
}
