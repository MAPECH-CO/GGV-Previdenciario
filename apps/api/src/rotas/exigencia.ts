// Exigência do INSS (GGVP-39): a advogada decide o que a exigência pede (G5), a Documentação cobra (G15), junta a
// prova de cada item e responde no portal (G21); a Sênior decide a vencida. O prazo é contado em código (G12).
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { CumprirItem, DecidirExigencia, DecidirLaco, DecidirVencida, ExigenciaDoCaso, RegistrarCobranca, ResponderExigencia, pode, type Erro } from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { caso, decisao, documento, etapa, exigencia, exigenciaItem, pericia, pessoa, tarefa, tentativa, usuario } from '../banco/esquema.ts'
import { EXIGENCIA_EM_CURSO, abrirPericiasDaExigencia, esperarAnaliseDoInss, lembreteDescrito, lembreteDoLaco, limitesDeCobranca, tiposDecididos } from '../fluxo/exigencia.ts'
import { REGRA_PRAZO_INSS, feriadosNacionais, prazoInss } from '../fluxo/prazo-inss.ts'
import { exigir, registrarBloqueio, registrarHistorico } from '../sessao/rotas.ts'
import { TIPOS_DE_ANEXO, guardarArquivo, lerFormulario } from './formulario.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { provaEhSensivel } from '../fluxo/prova-medica.ts'
import { TIPOS_DE_DOCUMENTO } from '../../../web/src/dados/catalogos.ts'

export const MSG_TIPO_DE_DOCUMENTO = 'Escolha um tipo de documento da lista.'
/** O tipo do item é opcional; quando vem, é do catálogo das telas (bloco 5d). */
export const tipoDeDocumentoValido = (tipo: string | null) => tipo === null || TIPOS_DE_DOCUMENTO.some((t) => t.id === tipo)

export const MSG_SEM_EXIGENCIA = 'Este caso não tem exigência do INSS aberta.'
export const MSG_JA_DECIDIDA = 'Esta exigência já foi decidida.'
export const MSG_SEM_CARD = 'Esta exigência não tem card da Documentação aberto.'
export const MSG_G21 = 'Só responde com documento anexado em todos os itens (G21).'
export const MSG_COMPROVANTE_RESPOSTA = 'Anexe o comprovante da resposta no portal (PDF ou imagem, até 25 MB).'
export const MSG_PROVA = 'Anexe o documento do item (PDF ou imagem, até 25 MB).'
export const MSG_SEM_ENTREGA = 'A Documentação ainda não entregou as provas ao Jurídico.'
/** A tarefa da Sênior quando a cobrança passa do limite (G15). */
const TITULO_ESCALADA = 'Cobrança sem retorno: exigência do INSS'

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const hoje = hojeEmBrasilia // CA7 (GGVP-118): o dia de Brasília, não o de UTC
const br = (iso: string) => iso.split('-').reverse().join('/')
const ABERTAS = ['aberta', 'em_andamento', 'aguardando'] as const

export function registrarRotasExigencia(app: FastifyInstance, { banco, armazenamento, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const bloqueio = registrarBloqueio(banco, agora)

  const ultimaExigencia = async (casoId: string) =>
    (
      await banco
        .select()
        .from(exigencia)
        .where(and(eq(exigencia.casoId, casoId), eq(exigencia.origem, 'inss')))
        .orderBy(desc(exigencia.criadoEm))
        .limit(1)
    )[0] ?? null

  const cardAberto = async (casoId: string) =>
    (
      await banco
        .select()
        .from(tarefa)
        .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D2.05d'), inArray(tarefa.situacao, [...ABERTAS])))
        .limit(1)
    )[0] ?? null

  const respostaPendente = async (casoId: string) =>
    (
      await banco
        .select({ id: tarefa.id })
        .from(tarefa)
        .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D2.05r'), isNull(tarefa.concluidaEm)))
        .limit(1)
    )[0] ?? null

  const itensDa = (exigenciaId: string) => banco.select().from(exigenciaItem).where(eq(exigenciaItem.exigenciaId, exigenciaId)).orderBy(asc(exigenciaItem.descricao))

  // CA7, CA11, CA12: a exigência, o prazo contado em código e o card. `?dias=` mostra o prazo antes de decidir.
  app.get<{ Params: { id: string }; Querystring: { dias?: string } }>(
    '/api/casos/:id/exigencia',
    { preHandler: exigir(banco, 'caso.ver', agora) },
    async (pedido, resposta) => {
      const casoId = pedido.params.id
      const [c] = await banco
        .select({ beneficio: caso.beneficio, cliente: pessoa.nome })
        .from(caso)
        .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
        .where(eq(caso.id, casoId))
      if (!c) return negar(resposta, 404, 'Caso não encontrado.')
      const x = await ultimaExigencia(casoId)
      if (!x) return negar(resposta, 404, MSG_SEM_EXIGENCIA)
      const feriados = await feriadosNacionais(banco)
      const diasPrevia = Number(pedido.query.dias)
      const dias = x.diasInss ?? (Number.isInteger(diasPrevia) && diasPrevia >= 1 && diasPrevia <= 120 ? diasPrevia : null)
      const prazo = x.prazo ?? (dias ? prazoInss(x.recebidaEm, dias, feriados) : null)
      const itens = await banco
        .select({ item: exigenciaItem, prova: documento.nomeOriginal })
        .from(exigenciaItem)
        .leftJoin(documento, eq(exigenciaItem.provaDocumentoId, documento.id))
        .where(eq(exigenciaItem.exigenciaId, x.id))
        .orderBy(asc(exigenciaItem.descricao))
      const [eD205] = await banco
        .select({ id: etapa.id })
        .from(etapa)
        .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D2.05')))
        .orderBy(desc(etapa.iniciadaEm))
        .limit(1)
      const pericias = eD205 ? await banco.select({ tipo: pericia.tipo, resultado: pericia.resultado }).from(pericia).where(eq(pericia.chamadaPorEtapaId, eD205.id)) : []
      const [card] = await banco
        .select()
        .from(tarefa)
        .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D2.05d')))
        .orderBy(desc(tarefa.criadoEm))
        .limit(1)
      const cobrancas = card
        ? await banco
            .select({ quando: tentativa.quando, canal: tentativa.canal, resultado: tentativa.resultado, quem: usuario.nome })
            .from(tentativa)
            .innerJoin(usuario, eq(tentativa.registradaPor, usuario.id))
            .where(eq(tentativa.tarefaId, card.id))
            .orderBy(asc(tentativa.quando))
        : []
      const pendente = itens.some((i) => i.item.situacao !== 'cumprido')
      const vencida = (EXIGENCIA_EM_CURSO as readonly string[]).includes(x.situacao) && prazo !== null && prazo < hoje(agora()) && (itens.length === 0 || pendente)
      const cardAtivo = card && (ABERTAS as readonly string[]).includes(card.situacao)
      return ExigenciaDoCaso.parse({
        casoId,
        exigenciaId: x.id,
        cliente: c.cliente,
        beneficio: c.beneficio,
        texto: x.descricao,
        data: x.recebidaEm,
        diasInss: dias,
        prazo,
        regraPrazo: prazo ? REGRA_PRAZO_INSS : null,
        feriadosCadastrados: feriados.size > 0,
        pede: x.pede,
        situacao: x.situacao,
        vencida,
        itens: itens.map((i) => ({ id: i.item.id, descricao: i.item.descricao, situacao: i.item.situacao, motivo: i.item.motivo, prova: i.prova })),
        pericias,
        card: card
          ? {
              prazoEntrega: itens[0]?.item.prazo ?? null,
              proximoLembrete: cardAtivo ? card.prazo : null,
              lembrete: cardAtivo ? lembreteDescrito(card, 'Documentação', card.tentativas) : null,
              tentativas: card.tentativas,
              limite: card.limiteTentativas,
              escalada: card.escaladaEm !== null,
              cobrancas: cobrancas.map((t) => ({ quando: t.quando.toISOString(), canal: t.canal ?? '', resultado: t.resultado, quem: t.quem })),
            }
          : null,
        podeDecidir: pode(pedido.perfilAtivo, 'exigencia_inss.tratar') && x.pede === null && x.situacao === 'aberta',
        podeCumprir: pode(pedido.perfilAtivo, 'exigencia_inss.cumprir') && Boolean(cardAtivo),
        podeResponder: pode(pedido.perfilAtivo, 'exigencia_inss.tratar') && Boolean(await respostaPendente(casoId)),
        podeDecidirVencida: pode(pedido.perfilAtivo, 'exigencia_inss.decidir_vencida') && vencida,
        podeDecidirLaco: pode(pedido.perfilAtivo, 'exigencia_inss.decidir_vencida') && Boolean(cardAtivo && card?.escaladaEm),
      })
    },
  )

  // CA1, CA2, CA6, CA8, CA9, CA10: a advogada decide; o sistema abre o card da Documentação ou a perícia.
  app.post<{ Params: { id: string } }>('/api/casos/:id/exigencia', { preHandler: exigir(banco, 'exigencia_inss.tratar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = DecidirExigencia.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const x = await ultimaExigencia(casoId)
    if (!x || x.situacao !== 'aberta') return negar(resposta, 404, MSG_SEM_EXIGENCIA)
    if (x.pede !== null) return negar(resposta, 409, MSG_JA_DECIDIDA)
    const d = entrada.data
    if (!d.itens.every((i) => tipoDeDocumentoValido(i.tipoDocumento))) return negar(resposta, 400, MSG_TIPO_DE_DOCUMENTO)
    const prazo = prazoInss(x.recebidaEm, d.diasInss, await feriadosNacionais(banco))
    if (d.prazoEntrega && d.prazoEntrega > prazo) return negar(resposta, 400, `O prazo de entrega não pode passar do prazo do INSS (${br(prazo)}).`)
    const quem = pedido.usuario!.id
    const { limite } = await limitesDeCobranca(banco)
    await banco.transaction(async (tx) => {
      await tx.update(exigencia).set({ pede: d.pede, diasInss: d.diasInss, prazo, analisadaPor: quem }).where(eq(exigencia.id, x.id))
      // G5 e CA10: quem decide é a advogada; a decisão fica com autora e horário.
      await tx.insert(decisao).values({
        casoId,
        passo: 'D2.05',
        tipo: 'exigencia_inss',
        resultado: d.pede,
        justificativa: d.tiposPericia.join(',') || null,
        decididoPor: quem,
        perfil: pedido.perfilAtivo!,
        decididoEm: agora(),
      })
      await tx
        .update(tarefa)
        .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem })
        .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D2.05'), eq(tarefa.perfilDono, 'advogada'), isNull(tarefa.concluidaEm)))
      if (d.pede === 'pericia') return abrirPericiasDaExigencia(tx, casoId, d.tiposPericia, quem, agora())
      // CA1, CA6, CA9: card da Documentação com os itens, o prazo de entrega e o próximo lembrete (Q1).
      for (const i of d.itens)
        await tx.insert(exigenciaItem).values({ exigenciaId: x.id, descricao: i.descricao, tipoDocumento: i.tipoDocumento, perfilResponsavel: 'documentacao', prazo: d.prazoEntrega })
      const lembrete = await lembreteDoLaco(tx, hoje(agora()), d.prazoEntrega ?? null, limite ?? 1)
      await tx.insert(tarefa).values({
        casoId,
        passo: 'D2.05d',
        titulo: 'Cumprir exigência do INSS',
        perfilDono: 'documentacao',
        prazo: lembrete,
        limiteTentativas: limite,
      })
      await tx.insert(etapa).values({ casoId, diagrama: 'D2', passo: 'D2.E3', situacao: 'aguardando_externo', aguardando: 'cliente entregar o documento', iniciadaEm: agora() })
    })
    await historico(quem, 'exigencia_inss_decidida', pedido, `caso:${casoId}`, { pede: d.pede, itens: d.itens.length, prazo })
    return resposta.code(201).send({ ok: true, prazo })
  })

  // GGVP-94 CA8 a CA10 (G15): a cobrança que passou do limite volta para a Documentação com o que a Sênior decidiu.
  app.post<{ Params: { id: string } }>(
    '/api/casos/:id/exigencia/cobrancas/decisao',
    { preHandler: exigir(banco, 'exigencia_inss.decidir_vencida', agora) },
    async (pedido, resposta) => {
      const casoId = pedido.params.id
      const entrada = DecidirLaco.safeParse(pedido.body)
      if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
      const card = await cardAberto(casoId)
      if (!card?.escaladaEm) return negar(resposta, 409, 'A cobrança deste caso não está com a Sênior.')
      const quem = pedido.usuario!.id
      const [primeiro] = await itensDa((await ultimaExigencia(casoId))!.id)
      const lembrete = (await lembreteDoLaco(banco, hoje(agora()), primeiro?.prazo ?? null, card.limiteTentativas ?? 1)) ?? card.prazo
      await banco.transaction(async (tx) => {
        await tx.insert(tentativa).values({ tarefaId: card.id, quando: agora(), canal: 'decisao_senior', resultado: entrada.data.oQueFazer, registradaPor: quem })
        await tx.update(tarefa).set({ tentativas: 0, escaladaEm: null, escaladaPara: null, prazo: lembrete }).where(eq(tarefa.id, card.id))
        await tx.insert(decisao).values({ casoId, passo: 'D2.05', tipo: 'laco_escalado', resultado: 'volta_ao_setor', justificativa: entrada.data.oQueFazer, decididoPor: quem, perfil: pedido.perfilAtivo! })
        await tx
          .update(tarefa)
          .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem })
          .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D2.05'), eq(tarefa.perfilDono, 'senior'), eq(tarefa.titulo, TITULO_ESCALADA), isNull(tarefa.concluidaEm)))
      })
      await historico(quem, 'laco_decidido', pedido, `caso:${casoId}`, { origem: 'inss' })
      return resposta.code(201).send({ ok: true, proximoLembrete: lembrete })
    },
  )

  // CA5, CA12 (G15): cada cobrança conta no limite; passou dele sem entrega, sobe para a Sênior.
  app.post<{ Params: { id: string } }>(
    '/api/casos/:id/exigencia/cobrancas',
    { preHandler: exigir(banco, 'exigencia_inss.cumprir', agora) },
    async (pedido, resposta) => {
      const casoId = pedido.params.id
      const entrada = RegistrarCobranca.safeParse(pedido.body)
      if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
      const card = await cardAberto(casoId)
      if (!card) return negar(resposta, 409, MSG_SEM_CARD)
      const quem = pedido.usuario!.id
      const x = (await ultimaExigencia(casoId))!
      const [primeiro] = await itensDa(x.id)
      const tentativas = card.tentativas + 1
      const escala = card.limiteTentativas !== null && tentativas >= card.limiteTentativas && entrada.data.resultado !== 'entregou' && card.escaladaEm === null
      const restantes = Math.max(1, (card.limiteTentativas ?? tentativas + 1) - tentativas)
      const lembrete = (await lembreteDoLaco(banco, hoje(agora()), primeiro?.prazo ?? null, restantes)) ?? card.prazo
      await banco.transaction(async (tx) => {
        await tx.insert(tentativa).values({ tarefaId: card.id, quando: agora(), canal: entrada.data.canal, resultado: entrada.data.resultado, registradaPor: quem })
        await tx
          .update(tarefa)
          .set({
            tentativas,
            prazo: lembrete,
            ...(escala ? { escaladaEm: agora(), escaladaPara: 'senior' } : {}),
          })
          .where(eq(tarefa.id, card.id))
        if (escala) await tx.insert(tarefa).values({ casoId, passo: 'D2.05', titulo: TITULO_ESCALADA, perfilDono: 'senior' })
      })
      await historico(quem, 'cobranca_registrada', pedido, `caso:${casoId}`, { ...entrada.data, tentativas, escalada: escala })
      return resposta.code(201).send({ ok: true, tentativas, escalada: escala })
    },
  )

  // CA11: o item vira cumprido com a prova anexada, ou não cumprido com o motivo.
  app.post<{ Params: { id: string; item: string } }>(
    '/api/casos/:id/exigencia/itens/:item',
    { preHandler: exigir(banco, 'exigencia_inss.cumprir', agora) },
    async (pedido, resposta) => {
      const casoId = pedido.params.id
      const formulario = await lerFormulario(pedido)
      if (!formulario) return negar(resposta, 400, MSG_PROVA)
      const entrada = CumprirItem.safeParse(formulario.campos)
      if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
      if (!(await cardAberto(casoId))) return negar(resposta, 409, MSG_SEM_CARD)
      const x = (await ultimaExigencia(casoId))!
      const [item] = await banco
        .select()
        .from(exigenciaItem)
        .where(and(eq(exigenciaItem.id, pedido.params.item), eq(exigenciaItem.exigenciaId, x.id)))
      if (!item) return negar(resposta, 404, 'Item não encontrado nesta exigência.')
      const quem = pedido.usuario!.id
      if (entrada.data.acao === 'nao_cumprido') {
        await banco.update(exigenciaItem).set({ situacao: 'nao_cumprido', motivo: entrada.data.motivo, provaDocumentoId: null }).where(eq(exigenciaItem.id, item.id))
      } else {
        const arquivo = formulario.arquivo
        if (!arquivo || !TIPOS_DE_ANEXO.includes(arquivo.mime)) return negar(resposta, 400, MSG_PROVA)
        const dados = await guardarArquivo(armazenamento, casoId, arquivo, 'exigencia-item')
        await banco.transaction(async (tx) => {
          // GGVP-39 CA15: laudo, atestado ou exame sobe como sensível (dado de saúde).
          const sensivel = provaEhSensivel(item.descricao, formulario.campos.medico)
          const [doc] = await tx.insert(documento).values({ casoId, tipo: 'prova_exigencia', origem: 'portal', recebidoPor: quem, sensivel, ...dados }).returning()
          await tx
            .update(exigenciaItem)
            .set({ situacao: 'cumprido', motivo: null, provaDocumentoId: doc.id, cumpridoEm: agora(), cumpridoPor: quem })
            .where(eq(exigenciaItem.id, item.id))
        })
      }
      await historico(quem, 'item_exigencia_atualizado', pedido, `caso:${casoId}`, { item: item.id, acao: entrada.data.acao })
      return resposta.code(201).send({ ok: true })
    },
  )

  // CA13 (G21): a Documentação entrega as provas ao Jurídico só com documento em todos os itens. Quem acessa o portal do
  // INSS do cliente é o Jurídico, então a resposta é da advogada (ajuste do Mateus em 05/10).
  app.post<{ Params: { id: string } }>(
    '/api/casos/:id/exigencia/entrega',
    { preHandler: exigir(banco, 'exigencia_inss.cumprir', agora) },
    async (pedido, resposta) => {
      const casoId = pedido.params.id
      const card = await cardAberto(casoId)
      if (!card) return negar(resposta, 409, MSG_SEM_CARD)
      const x = (await ultimaExigencia(casoId))!
      const itens = await itensDa(x.id)
      const semProva = itens.filter((i) => i.situacao !== 'cumprido' || !i.provaDocumentoId).length
      if (itens.length === 0 || semProva) {
        await bloqueio(pedido, casoId, 'G21', 'D2.05', { faltam: semProva })
        return negar(resposta, 409, MSG_G21)
      }
      const quem = pedido.usuario!.id
      const fechar = { situacao: 'concluida' as const, concluidaEm: agora(), concluidaPor: quem }
      await banco.transaction(async (tx) => {
        await tx.update(tarefa).set(fechar).where(eq(tarefa.id, card.id))
        await tx
          .update(etapa)
          .set(fechar)
          .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D2.E3'), isNull(etapa.concluidaEm)))
        await tx.insert(tarefa).values({ casoId, passo: 'D2.05r', titulo: 'Responder exigência no portal do INSS', perfilDono: 'advogada' })
      })
      await historico(quem, 'provas_entregues_ao_juridico', pedido, `caso:${casoId}`, { itens: itens.length })
      return resposta.code(201).send({ ok: true })
    },
  )

  // CA3, CA4, CA6 (advogada): com as provas entregues, responde no portal; com perícia pedida, abre a perícia; senão, vigília.
  app.post<{ Params: { id: string } }>(
    '/api/casos/:id/exigencia/resposta',
    { preHandler: exigir(banco, 'exigencia_inss.tratar', agora) },
    async (pedido, resposta) => {
      const casoId = pedido.params.id
      const formulario = await lerFormulario(pedido)
      if (!formulario) return negar(resposta, 400, MSG_COMPROVANTE_RESPOSTA)
      const entrada = ResponderExigencia.safeParse(formulario.campos)
      if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
      if (!(await respostaPendente(casoId))) return negar(resposta, 409, MSG_SEM_ENTREGA)
      const x = (await ultimaExigencia(casoId))!
      const itens = await itensDa(x.id)
      const semProva = itens.filter((i) => i.situacao !== 'cumprido' || !i.provaDocumentoId).length
      if (itens.length === 0 || semProva) {
        await bloqueio(pedido, casoId, 'G21', 'D2.05', { faltam: semProva })
        return negar(resposta, 409, MSG_G21)
      }
      const arquivo = formulario.arquivo
      if (!arquivo || !TIPOS_DE_ANEXO.includes(arquivo.mime)) return negar(resposta, 400, MSG_COMPROVANTE_RESPOSTA)
      const quem = pedido.usuario!.id
      const dados = await guardarArquivo(armazenamento, casoId, arquivo, 'resposta-exigencia')
      const tipos = x.pede === 'pericia_e_documentos' ? await tiposDecididos(banco, casoId) : []
      const fechar = { situacao: 'concluida' as const, concluidaEm: agora(), concluidaPor: quem }
      await banco.transaction(async (tx) => {
        await tx.insert(documento).values({ casoId, tipo: 'resposta_exigencia_inss', origem: 'portal', recebidoPor: quem, ...dados })
        await tx.update(exigencia).set({ situacao: tipos.length ? 'aberta' : 'cumprida' }).where(eq(exigencia.id, x.id))
        await tx
          .update(tarefa)
          .set(fechar)
          .where(and(eq(tarefa.casoId, casoId), inArray(tarefa.passo, ['D2.05', 'D2.05d', 'D2.05r']), isNull(tarefa.concluidaEm)))
        if (tipos.length) await abrirPericiasDaExigencia(tx, casoId, tipos, quem, agora())
        else await esperarAnaliseDoInss(tx, casoId, agora())
      })
      await historico(quem, 'exigencia_inss_respondida', pedido, `caso:${casoId}`, { dataResposta: entrada.data.dataResposta, pericia: tipos })
      return resposta.code(201).send({ ok: true, aberto: tipos.length ? 'pericia' : 'vigilia' })
    },
  )

  // CA14 (resposta do revisor de 05/10): vencida com item pendente, a Sênior pede dilação ou registra a perda.
  app.post<{ Params: { id: string } }>(
    '/api/casos/:id/exigencia/vencida',
    { preHandler: exigir(banco, 'exigencia_inss.decidir_vencida', agora) },
    async (pedido, resposta) => {
      const casoId = pedido.params.id
      const entrada = DecidirVencida.safeParse(pedido.body)
      if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
      const x = await ultimaExigencia(casoId)
      if (!x || !(EXIGENCIA_EM_CURSO as readonly string[]).includes(x.situacao) || !x.prazo || x.prazo >= hoje(agora())) return negar(resposta, 409, 'A exigência não está vencida.')
      const quem = pedido.usuario!.id
      const d = entrada.data
      await banco.transaction(async (tx) => {
        if (d.decisao === 'dilacao') {
          await tx.update(exigencia).set({ situacao: 'dilacao_pedida', prazo: d.novoPrazo }).where(eq(exigencia.id, x.id))
        } else {
          await tx.update(exigencia).set({ situacao: 'vencida' }).where(eq(exigencia.id, x.id))
          await tx
            .update(tarefa)
            .set({ situacao: 'cancelada', concluidaEm: agora(), concluidaPor: quem })
            .where(and(eq(tarefa.casoId, casoId), inArray(tarefa.passo, ['D2.05', 'D2.05d', 'D2.05r']), isNull(tarefa.concluidaEm)))
        }
      })
      await historico(quem, d.decisao === 'dilacao' ? 'exigencia_dilacao_pedida' : 'exigencia_perdida', pedido, `caso:${casoId}`, d)
      return resposta.code(201).send({ ok: true })
    },
  )
}
