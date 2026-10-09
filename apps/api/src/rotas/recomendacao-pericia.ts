// Recomendação sobre a perícia (GGVP-38, DP.00): antes de marcar, a IA prepara para a advogada o que levar, os pontos
// fortes e fracos e, na perícia do juiz, quesitos e assistente técnico, em segundo plano (sugestão pronta, 07/10). A
// advogada edita e aprova; a IA não marca nada. Sem a jurimetria do perito, que espera a identificação dele (GGVP-59).
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import {
  AprovarRecomendacao,
  PericiasDoCaso,
  ROTULO_BENEFICIO,
  RecomendacaoAprovada,
  RecomendacaoDaIa,
  RecomendacaoDaPericia,
  pode,
  type Beneficio,
  type Erro,
  type FonteDaIa,
} from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { caso, decisao, documento, etapa, exigencia, kitDocumento, parecerMedico, pericia, pessoa, publicacao, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { buscarNoAcervo } from '../ia/acervo.ts'
import { FINALIDADES, lerJson, type ComoSugerir, type Ia } from '../ia/ia.ts'
import type { Preparo } from '../ia/preparo.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'

export const TITULO_CONFERIR = 'Conferir a recomendação da perícia'
export const MSG_JA_APROVADA = 'A recomendação desta perícia já foi aprovada.'
const NOME: Record<string, string> = { medica: 'Perícia médica', social: 'Avaliação social' }
/** A origem vem da etapa que pediu a perícia; só a do juiz (D3a) é judicial (CA3). */
const ORIGEM: Record<string, string> = { D2: 'pedida no INSS', D3: 'pedida no despacho da Sênior', D3a: 'determinada pelo juiz' }

type Opcoes = { banco: Banco; agora?: () => Date; ia: Ia; preparo: Preparo }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasRecomendacaoPericia(app: FastifyInstance, { banco, agora = () => new Date(), ia, preparo }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  async function periciaDe(periciaId: string) {
    const [p] = await banco.select({ pericia, diagrama: etapa.diagrama }).from(pericia).leftJoin(etapa, eq(pericia.chamadaPorEtapaId, etapa.id)).where(eq(pericia.id, periciaId))
    return p ? { ...p.pericia, judicial: p.diagrama === 'D3a', origem: ORIGEM[p.diagrama ?? ''] ?? 'origem não registrada' } : null
  }

  /** As aprovações por perícia: a decisão é do caso, e a justificativa guarda o que a advogada aprovou, com a perícia. */
  async function aprovacoes(casoId?: string) {
    const linhas = await banco
      .select({ justificativa: decisao.justificativa, em: decisao.decididoEm, por: usuario.nome })
      .from(decisao)
      .innerJoin(usuario, eq(decisao.decididoPor, usuario.id))
      .where(and(eq(decisao.tipo, 'recomendacao_pericia'), ...(casoId ? [eq(decisao.casoId, casoId)] : [])))
    return new Map(
      linhas.flatMap((l) => {
        const a = RecomendacaoAprovada.safeParse(lerJson(l.justificativa ?? ''))
        return a.success ? [[a.data.periciaId, { ...a.data, por: l.por, em: l.em.toISOString() }] as const] : []
      }),
    )
  }

  /** CA1, CA3: a recomendação da perícia, com o que o caso tem; quesitos e assistente técnico só na do juiz. */
  async function recomendar(periciaId: string, quem: string | null, como: ComoSugerir = {}) {
    const p = await periciaDe(periciaId)
    if (!p) return null
    const [c] = await banco.select({ beneficio: caso.beneficio }).from(caso).where(eq(caso.id, p.casoId))
    const [parecer] = await banco.select().from(parecerMedico).where(eq(parecerMedico.casoId, p.casoId)).orderBy(desc(parecerMedico.criadoEm)).limit(1)
    const itensDoParecer = ((parecer?.itens as { item: string; atendido: boolean }[] | null) ?? []).map((i) => `${i.item}: ${i.atendido ? 'atendido' : 'não atendido'}`)
    const kit = c?.beneficio
      ? await banco
          .select({ tipo: kitDocumento.tipoDocumento, obrigatorio: kitDocumento.obrigatorio })
          .from(kitDocumento)
          .where(and(eq(kitDocumento.beneficio, c.beneficio), isNull(kitDocumento.revogadoEm)))
      : []
    const docs = await banco
      .select({ nome: documento.nomeOriginal, tipo: documento.tipo })
      .from(documento)
      .where(and(eq(documento.casoId, p.casoId), isNull(documento.excluidoEm)))
      .orderBy(asc(documento.criadoEm))
    const [indeferido] = await banco
      .select({ motivo: resultadoInss.motivoEscrito, motivoInss: resultadoInss.motivoIndeferimento })
      .from(resultadoInss)
      .where(and(eq(resultadoInss.casoId, p.casoId), eq(resultadoInss.resultado, 'indeferido')))
      .orderBy(desc(resultadoInss.criadoEm))
      .limit(1)
    const motivo = [indeferido?.motivoInss, indeferido?.motivo].filter(Boolean).join(' ')
    const [ordem] = p.judicial
      ? await banco
          .select({ texto: publicacao.texto })
          .from(exigencia)
          .innerJoin(publicacao, eq(exigencia.publicacaoId, publicacao.id))
          .where(and(eq(exigencia.casoId, p.casoId), eq(exigencia.origem, 'juizo')))
          .orderBy(desc(exigencia.criadoEm))
          .limit(1)
      : []
    const acervo = await buscarNoAcervo(banco, { casoId: p.casoId, beneficio: c?.beneficio ?? null, consulta: [motivo, ...itensDoParecer, NOME[p.tipo]].join(' '), saude: FINALIDADES.recomendacao_pericia.saude, ia })
    const conteudo = [
      `Benefício: ${c?.beneficio ? (ROTULO_BENEFICIO[c.beneficio as Beneficio] ?? c.beneficio) : 'não definido'}`,
      `Perícia: ${NOME[p.tipo]}, ${p.origem}${p.judicial ? ' (perícia judicial)' : ' (não é judicial)'}`,
      'Perito: não identificado',
      `Parecer médico: ${parecer ? `${parecer.resultado}${itensDoParecer.length ? ` (${itensDoParecer.join('; ')})` : ''}` : 'não há'}`,
      `Documentos que o benefício pede: ${kit.length ? kit.map((k) => `${k.tipo}${k.obrigatorio ? '' : ' (opcional)'}`).join('; ') : 'kit não cadastrado'}`,
      `Documentos do caso: ${docs.length ? docs.map((d) => `${d.nome} (${d.tipo})`).join('; ') : 'nenhum'}`,
      `Indeferimento do INSS: ${motivo || 'não há'}`,
      ...(p.judicial ? [`Ordem do juiz: ${ordem?.texto ?? 'não está no sistema'}`] : []),
      ...(acervo.length ? ['Trechos do acervo da casa (outros casos):', ...acervo.map((a) => `- ${a.trecho}`)] : []),
    ].join('\n')
    const fontes: FonteDaIa[] = [
      { tipo: 'caso', referencia: `pericia:${p.id}` },
      ...(parecer ? [{ tipo: 'caso' as const, referencia: `parecer:${parecer.id}`, trecho: parecer.resultado }] : []),
      ...acervo,
    ]
    const validar = (texto: string) => RecomendacaoDaIa.safeParse(lerJson(texto)).success
    const s = await ia.sugerir('recomendacao_pericia', { casoId: p.casoId, quem, conteudo, fontes }, { ...como, validar })
    if (!s) return RecomendacaoDaPericia.parse({ sugestao: null, recomendacao: null, motivo: 'A IA não respondeu agora: escreva a recomendação pela sua leitura.' })
    const lida = RecomendacaoDaIa.parse(lerJson(s.texto))
    // CA3: quesitos e assistente técnico só na perícia do juiz, mesmo que a IA escreva.
    const recomendacao = p.judicial ? lida : { ...lida, quesitos: [], assistenteTecnico: null }
    return RecomendacaoDaPericia.parse({ sugestao: s, recomendacao, motivo: null })
  }

  /** As perícias do caso que esperam a recomendação aprovada (sem resultado e sem aprovação). */
  async function esperando(casoId?: string) {
    const aprovadas = await aprovacoes(casoId)
    const pendentes = await banco
      .select({ id: pericia.id, casoId: pericia.casoId })
      .from(pericia)
      .where(and(isNull(pericia.resultado), ...(casoId ? [eq(pericia.casoId, casoId)] : [])))
    return pendentes.filter((p) => !aprovadas.has(p.id))
  }

  // CA1: em segundo plano, a recomendação de cada perícia que espera; feita, nasce a tarefa da advogada, uma por caso.
  preparo.registrar(
    async () => (await esperando()).map((p) => p.id),
    async (periciaId) => {
      const r = await recomendar(periciaId, null, { soPreparar: true })
      const p = r?.recomendacao ? await periciaDe(periciaId) : null
      if (!p) return
      const [aberta] = await banco.select({ id: tarefa.id }).from(tarefa).where(and(eq(tarefa.casoId, p.casoId), eq(tarefa.passo, 'DP.00'), isNull(tarefa.concluidaEm))).limit(1)
      if (!aberta) await banco.insert(tarefa).values({ casoId: p.casoId, passo: 'DP.00', titulo: TITULO_CONFERIR, perfilDono: 'advogada', criadoEm: agora() })
    },
  )

  // As perícias do caso, com a recomendação aprovada de cada uma. O Jurídico vê (a recomendação sai do parecer e dos laudos).
  app.get<{ Params: { id: string } }>('/api/casos/:id/pericias', { preHandler: exigir(banco, 'dado_saude.ver_detalhe', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const [c] = await banco.select({ nome: pessoa.nome }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    const lista = await banco
      .select({ pericia, diagrama: etapa.diagrama })
      .from(pericia)
      .leftJoin(etapa, eq(pericia.chamadaPorEtapaId, etapa.id))
      .where(eq(pericia.casoId, casoId))
      .orderBy(asc(pericia.criadoEm))
    const aprovadas = await aprovacoes(casoId)
    return PericiasDoCaso.parse({
      casoId,
      cliente: c.nome,
      pericias: lista.map(({ pericia: p, diagrama }) => {
        const a = aprovadas.get(p.id)
        return {
          id: p.id,
          tipo: p.tipo,
          judicial: diagrama === 'D3a',
          origem: ORIGEM[diagrama ?? ''] ?? 'origem não registrada',
          resultado: p.resultado,
          aprovada: a ? { oQueLevar: a.oQueLevar, quesitos: a.quesitos, assistenteTecnico: a.assistenteTecnico, por: a.por, em: a.em } : null,
        }
      }),
      podeAprovar: pode(pedido.perfilAtivo, 'pericia.decidir'),
    })
  })

  // Sugestão pronta: a recomendação que o preparo deixou (sem nova chamada), ou feita agora, se ainda não havia.
  app.post<{ Params: { id: string } }>('/api/pericias/:id/recomendacao/sugestao', { preHandler: exigir(banco, 'dado_saude.ver_detalhe', agora) }, async (pedido, resposta) => {
    return (await recomendar(pedido.params.id, pedido.usuario!.id)) ?? negar(resposta, 404, 'Perícia não encontrada.')
  })

  // CA4: só a advogada aprova; grava o que ela aprovou, com a chamada da IA à parte; sem outra esperando, a tarefa fecha.
  app.post<{ Params: { id: string } }>('/api/pericias/:id/recomendacao', { preHandler: exigir(banco, 'pericia.decidir', agora) }, async (pedido, resposta) => {
    const entrada = AprovarRecomendacao.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira a recomendação.')
    const p = await periciaDe(pedido.params.id)
    if (!p) return negar(resposta, 404, 'Perícia não encontrada.')
    if ((await aprovacoes(p.casoId)).has(p.id)) return negar(resposta, 409, MSG_JA_APROVADA)
    const d = entrada.data
    const aprovada = RecomendacaoAprovada.parse({
      periciaId: p.id,
      oQueLevar: d.oQueLevar,
      quesitos: p.judicial ? d.quesitos : [],
      assistenteTecnico: p.judicial ? d.assistenteTecnico : null,
    })
    const quem = pedido.usuario!.id
    await banco.insert(decisao).values({
      casoId: p.casoId,
      passo: 'DP.00',
      tipo: 'recomendacao_pericia',
      resultado: 'aprovada',
      justificativa: JSON.stringify(aprovada),
      sugestaoIa: d.chamadaIaId ? { chamadaId: d.chamadaIaId } : null,
      decididoPor: quem,
      perfil: pedido.perfilAtivo!,
      decididoEm: agora(),
    })
    if (!(await esperando(p.casoId)).length)
      await banco
        .update(tarefa)
        .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem })
        .where(and(eq(tarefa.casoId, p.casoId), eq(tarefa.passo, 'DP.00'), isNull(tarefa.concluidaEm)))
    await historico(quem, 'recomendacao_pericia_aprovada', pedido, `caso:${p.casoId}`, { pericia: p.id, itens: aprovada.oQueLevar.length, quesitos: aprovada.quesitos.length })
    return resposta.code(201).send({ ok: true })
  })
}
