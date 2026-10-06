// Exigência do juiz (GGVP-79, 83, 87): a advogada analisa e distribui aos setores (G5); cada setor cumpre com
// tentativas limitadas e prova (G15, G21); com tudo provado, a advogada manifesta. Reaproveita `exigencia` com a
// origem `juizo`, os itens, a cobrança e a perícia da exigência do INSS.
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { AnalisarExigenciaJuiz, ExigenciaDoJuiz, ROTULO_SETOR, pode, type Erro } from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { caso, decisao, documento, etapa, exigencia, exigenciaItem, pericia, pessoa, prazo, publicacao, tarefa } from '../banco/esquema.ts'
import { ORIGEM_JUIZ, abrirPericiasDaExigencia, limitesDeCobranca } from '../fluxo/exigencia.ts'
import { somarDias } from '../fluxo/prazo-inss.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'

export const MSG_NADA_A_ANALISAR = 'Não há exigência do juiz esperando a análise neste caso.'

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const hoje = (agora: Date) => new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)
const br = (iso: string) => iso.split('-').reverse().join('/')
const SITUACAO = { aberta: 'em_cumprimento', cumprida: 'cumprida', vencida: 'vencida', dilacao_pedida: 'dilacao_pedida' } as const

export function registrarRotasExigenciaJuiz(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
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

}
