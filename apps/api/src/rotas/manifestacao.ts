// Manifestar e protocolar (GGVP-87): com todos os itens provados (G21), a advogada anexa a versão, aprova (G6) e
// registra o protocolo; o processo volta para a vigília. Dilação com o OK da Sênior e tribunal fora do ar (CA12, CA13).
import { createHash } from 'node:crypto'
import { and, asc, desc, eq, gte, inArray, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import {
  AprovarVersao,
  AutorizarDilacao,
  EncerrarSemProva,
  Manifestacao,
  ProtocolarManifestacao,
  ROTULO_SETOR,
  RegistrarIndisponibilidade,
  pode,
  type Erro,
} from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import {
  caso,
  decisao,
  documento,
  etapa,
  exigencia,
  exigenciaItem,
  pericia,
  pessoa,
  peticao,
  peticaoVersao,
  prazo,
  protocoloJudicial,
  publicacao,
  tarefa,
  usuario,
} from '../banco/esquema.ts'
import { ORIGEM_JUIZ } from '../fluxo/exigencia.ts'
import { REGRA_INDISPONIBILIDADE, feriadosDoProcesso, prazoDepoisDaIndisponibilidade, tribunalDoCnj } from '../fluxo/prazo-judicial.ts'
import { exigir, registrarBloqueio, registrarHistorico } from '../sessao/rotas.ts'
import { TIPOS_DE_ANEXO, guardarArquivo, lerFormulario } from './formulario.ts'

export const MSG_SEM_EXIGENCIA_JUIZ = 'Este caso não tem exigência do juiz em cumprimento.'
export const MSG_VERSAO_NAO_APROVADA = 'Só a versão aprovada é protocolada: aprove a última versão antes (G6).'
export const MSG_COMPROVANTE = 'Anexe o comprovante do protocolo (PDF ou imagem, até 25 MB).'

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const EM_CURSO = ['aberta', 'dilacao_pedida', 'vencida'] as const

const NOME_PERICIA = { medica: 'Perícia médica', social: 'Avaliação social' } as Record<string, string>

/** Item encerrado sem a prova pela advogada: o motivo é a prova em texto (GGVP-68 CA2; ajuste do Mateus, 06/10). */
const semProva = (i: typeof exigenciaItem.$inferSelect) => i.situacao === 'nao_cumprido' && Boolean(i.motivo) && Boolean(i.cumpridoPor)

/**
 * A exigência do juiz em curso do caso, com o que falta (G21, CA5): itens sem documento e perícias sem resultado, a não
 * ser que a advogada tenha encerrado com o motivo, que fica como a prova em texto do item.
 */
export async function situacaoDaExigenciaJuiz(banco: Banco, casoId: string) {
  const [x] = await banco
    .select()
    .from(exigencia)
    .where(and(eq(exigencia.casoId, casoId), eq(exigencia.origem, 'juizo'), inArray(exigencia.situacao, [...EM_CURSO])))
    .orderBy(desc(exigencia.criadoEm))
    .limit(1)
  if (!x) return null
  const itens = await banco.select().from(exigenciaItem).where(eq(exigenciaItem.exigenciaId, x.id)).orderBy(asc(exigenciaItem.descricao))
  const [eP] = await banco
    .select({ id: etapa.id })
    .from(etapa)
    .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, ORIGEM_JUIZ.passo), gte(etapa.iniciadaEm, x.criadoEm)))
    .limit(1)
  const pericias = eP ? await banco.select().from(pericia).where(eq(pericia.chamadaPorEtapaId, eP.id)) : []
  // A perícia encerrada sem resultado fica numa decisão da advogada, com o motivo (a tabela da perícia é do épico Perícia).
  const dispensas = await banco
    .select()
    .from(decisao)
    .where(and(eq(decisao.casoId, casoId), eq(decisao.passo, 'D3a.04'), eq(decisao.tipo, 'pericia_sem_resultado'), gte(decisao.decididoEm, x.criadoEm)))
  const dispensada = new Map(dispensas.map((d) => [d.resultado, d] as const))
  const pendentes = itens.filter((i) => !(i.situacao === 'cumprido' && i.provaDocumentoId) && !semProva(i))
  const periciasPendentes = pericias.filter((p) => p.resultado === null && !dispensada.has(p.id))
  const faltam = [
    ...new Set(pendentes.map((i) => ROTULO_SETOR[i.perfilResponsavel as keyof typeof ROTULO_SETOR] ?? i.perfilResponsavel)),
    ...(periciasPendentes.length ? ['Perícia'] : []),
  ]
  const encerradosSemProva = [
    ...itens.filter(semProva).map((i) => ({ descricao: i.descricao, motivo: i.motivo!, por: i.cumpridoPor!, em: i.cumpridoEm! })),
    ...pericias
      .filter((p) => dispensada.has(p.id))
      .map((p) => ({ descricao: NOME_PERICIA[p.tipo] ?? p.tipo, motivo: dispensada.get(p.id)!.justificativa ?? '', por: dispensada.get(p.id)!.decididoPor, em: dispensada.get(p.id)!.decididoEm })),
  ]
  return { exigencia: x, pendentes, periciasPendentes, pericias, faltam, encerradosSemProva }
}

/**
 * CA1: quando nada falta, a espera do cliente termina e "Manifestar no processo" fica pronta para a advogada (a tarefa
 * nasce na distribuição, com o prazo do processo; se não houver, nasce aqui, uma vez).
 */
export async function abrirManifestacaoSePronta(banco: Banco, casoId: string, agora: Date) {
  const s = await situacaoDaExigenciaJuiz(banco, casoId)
  if (!s || s.faltam.length) return false
  const [ja] = await banco.select({ id: tarefa.id }).from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3a.04'), gte(tarefa.criadoEm, s.exigencia.criadoEm)))
  if (!ja) await banco.insert(tarefa).values({ casoId, passo: 'D3a.04', titulo: 'Manifestar no processo', perfilDono: 'advogada', prazo: s.exigencia.prazo, criadoEm: agora })
  await banco
    .update(etapa)
    .set({ situacao: 'concluida', concluidaEm: agora })
    .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D3a.E2'), isNull(etapa.concluidaEm)))
  return true
}

export function registrarRotasManifestacao(app: FastifyInstance, { banco, armazenamento, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const bloqueio = registrarBloqueio(banco, agora)

  /** A petição desta exigência (manifestação ou dilação), criada na primeira versão. */
  const peticaoDa = async (casoId: string, desde: Date) =>
    (
      await banco
        .select()
        .from(peticao)
        .where(and(eq(peticao.casoId, casoId), inArray(peticao.tipo, ['manifestacao', 'dilacao']), gte(peticao.criadoEm, desde)))
        .orderBy(desc(peticao.criadoEm))
        .limit(1)
    )[0] ?? null

  const cnjDa = async (publicacaoId: string | null) =>
    publicacaoId ? ((await banco.select({ cnj: publicacao.numeroCnj }).from(publicacao).where(eq(publicacao.id, publicacaoId)))[0]?.cnj ?? null) : null

  const versoesDa = (peticaoId: string) => banco.select().from(peticaoVersao).where(eq(peticaoVersao.peticaoId, peticaoId)).orderBy(asc(peticaoVersao.numero))

  const dilacaoAutorizada = async (casoId: string, desde: Date) =>
    Boolean(
      (
        await banco
          .select({ id: decisao.id })
          .from(decisao)
          .where(and(eq(decisao.casoId, casoId), eq(decisao.passo, 'D3a.04'), eq(decisao.tipo, 'dilacao'), gte(decisao.decididoEm, desde)))
      )[0],
    )

  // CA1, CA5, CA7, CA10: as versões, o que falta, a dilação e o protocolo.
  app.get<{ Params: { id: string } }>('/api/casos/:id/manifestacao', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const [c] = await banco.select({ nome: pessoa.nome }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
    const [x] = c
      ? await banco
          .select()
          .from(exigencia)
          .where(and(eq(exigencia.casoId, casoId), eq(exigencia.origem, 'juizo')))
          .orderBy(desc(exigencia.criadoEm))
          .limit(1)
      : []
    if (!c || !x) return negar(resposta, 404, MSG_SEM_EXIGENCIA_JUIZ)
    const s = await situacaoDaExigenciaJuiz(banco, casoId)
    const p = await peticaoDa(casoId, x.criadoEm)
    const versoes = p ? await versoesDa(p.id) : []
    const nomes = new Map((await banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario)).map((u) => [u.id, u.nome] as const))
    const docs = new Map(
      versoes.length
        ? (await banco.select({ id: documento.id, nome: documento.nomeOriginal }).from(documento).where(inArray(documento.id, versoes.map((v) => v.documentoId!).filter(Boolean)))).map(
            (d) => [d.id, d.nome] as const,
          )
        : [],
    )
    const [prot] = versoes.length
      ? await banco
          .select({ p: protocoloJudicial, numero: peticaoVersao.numero })
          .from(protocoloJudicial)
          .innerJoin(peticaoVersao, eq(protocoloJudicial.peticaoVersaoId, peticaoVersao.id))
          .where(inArray(protocoloJudicial.peticaoVersaoId, versoes.map((v) => v.id)))
      : []
    const [pz] = x.publicacaoId ? await banco.select().from(prazo).where(eq(prazo.publicacaoId, x.publicacaoId)).orderBy(desc(prazo.criadoEm)).limit(1) : []
    const ultima = versoes.at(-1)
    const autorizada = await dilacaoAutorizada(casoId, x.criadoEm)
    const emCurso = Boolean(s) && !prot
    return Manifestacao.parse({
      casoId,
      cliente: c.nome,
      prazo: { fim: x.prazo ?? pz?.fim ?? '', regra: pz?.regra ?? '' },
      faltam: s?.faltam ?? [],
      pendentes: [
        ...(s?.pendentes ?? []).map((i) => ({
          alvo: 'item' as const,
          id: i.id,
          setor: ROTULO_SETOR[i.perfilResponsavel as keyof typeof ROTULO_SETOR] ?? i.perfilResponsavel,
          descricao: i.descricao,
          prazoInterno: i.prazo,
        })),
        ...(s?.periciasPendentes ?? []).map((p) => ({
          alvo: 'pericia' as const,
          id: p.id,
          setor: 'Jurídico administrativo',
          descricao: NOME_PERICIA[p.tipo] ?? p.tipo,
          prazoInterno: null,
        })),
      ],
      semProva: (s?.encerradosSemProva ?? []).map((e) => ({ descricao: e.descricao, motivo: e.motivo, por: nomes.get(e.por) ?? '', em: e.em.toISOString() })),
      versoes: versoes.map((v) => ({
        numero: v.numero,
        tipo: p!.tipo,
        arquivo: v.documentoId ? (docs.get(v.documentoId) ?? null) : null,
        por: v.geradaPor,
        em: v.criadoEm.toISOString(),
        aprovadaPor: v.aprovadaPor ? (nomes.get(v.aprovadaPor) ?? null) : null,
        aprovadaEm: v.aprovadaEm?.toISOString() ?? null,
      })),
      dilacaoAutorizada: autorizada,
      protocolo: prot ? { em: prot.p.protocoladoEm.toISOString(), versao: prot.numero, tipo: p!.tipo, por: nomes.get(prot.p.protocoladoPor) ?? '' } : null,
      podeAnexar: pode(pedido.perfilAtivo, 'exigencia_juiz.manifestar') && emCurso,
      podeProtocolar:
        pode(pedido.perfilAtivo, 'exigencia_juiz.manifestar') && emCurso && Boolean(ultima?.aprovadaEm) && (p?.tipo === 'dilacao' ? autorizada : (s?.faltam.length ?? 1) === 0),
      podeAutorizarDilacao: pode(pedido.perfilAtivo, 'exigencia_juiz.autorizar_dilacao') && emCurso && !autorizada && (s?.faltam.length ?? 0) > 0,
      podeEncerrarSemProva: pode(pedido.perfilAtivo, 'exigencia_juiz.manifestar') && emCurso && (s?.faltam.length ?? 0) > 0,
    })
  })

  // Ajuste do Mateus (06/10): o documento não existe ou a perícia não tem como ser feita. A advogada encerra o item,
  // ou a perícia, com o motivo obrigatório; o motivo é a prova em texto (GGVP-68 CA2) e fica com quem e quando.
  app.post<{ Params: { id: string } }>('/api/casos/:id/manifestacao/sem-prova', { preHandler: exigir(banco, 'exigencia_juiz.manifestar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = EncerrarSemProva.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const s = await situacaoDaExigenciaJuiz(banco, casoId)
    if (!s) return negar(resposta, 409, MSG_SEM_EXIGENCIA_JUIZ)
    const d = entrada.data
    const quem = pedido.usuario!.id
    if (d.alvo === 'item') {
      const item = s.pendentes.find((i) => i.id === d.id)
      if (!item) return negar(resposta, 404, 'Este item não está pendente nesta exigência.')
      await banco.transaction(async (tx) => {
        await tx.update(exigenciaItem).set({ situacao: 'nao_cumprido', motivo: d.motivo, cumpridoPor: quem, cumpridoEm: agora() }).where(eq(exigenciaItem.id, item.id))
        // O setor para de cobrar: a tarefa dele é cancelada e o lembrete some.
        if (item.tarefaId)
          await tx
            .update(tarefa)
            .set({ situacao: 'cancelada', concluidaEm: agora(), concluidaPor: quem, prazo: null })
            .where(and(eq(tarefa.id, item.tarefaId), isNull(tarefa.concluidaEm)))
      })
    } else {
      const p = s.periciasPendentes.find((x) => x.id === d.id)
      if (!p) return negar(resposta, 404, 'Esta perícia não está pendente nesta exigência.')
      await banco.insert(decisao).values({
        casoId,
        passo: 'D3a.04',
        tipo: 'pericia_sem_resultado',
        resultado: p.id,
        justificativa: d.motivo,
        decididoPor: quem,
        perfil: pedido.perfilAtivo!,
        decididoEm: agora(),
      })
      // Sem nenhuma perícia pendente, a tarefa de marcar (do Jurídico administrativo) não faz mais sentido.
      if (s.periciasPendentes.length === 1)
        await banco
          .update(tarefa)
          .set({ situacao: 'cancelada', concluidaEm: agora(), concluidaPor: quem })
          .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'DP.01'), gte(tarefa.criadoEm, s.exigencia.criadoEm), isNull(tarefa.concluidaEm)))
    }
    await historico(quem, 'exigencia_juiz_sem_prova', pedido, `caso:${casoId}`, { alvo: d.alvo, id: d.id, motivo: d.motivo })
    await abrirManifestacaoSePronta(banco, casoId, agora())
    return resposta.code(201).send({ ok: true })
  })

  // CA6, CA7: a advogada anexa a versão a qualquer momento (sem IA, redige fora do portal); cada uma é numerada.
  app.post<{ Params: { id: string } }>('/api/casos/:id/manifestacao/versoes', { preHandler: exigir(banco, 'exigencia_juiz.manifestar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const formulario = await lerFormulario(pedido)
    const arquivo = formulario?.arquivo
    if (!arquivo || !TIPOS_DE_ANEXO.includes(arquivo.mime)) return negar(resposta, 400, 'Anexe a versão da manifestação (PDF ou imagem, até 25 MB).')
    const tipo = formulario!.campos.tipo === 'dilacao' ? 'dilacao' : 'manifestacao'
    const s = await situacaoDaExigenciaJuiz(banco, casoId)
    if (!s) return negar(resposta, 409, MSG_SEM_EXIGENCIA_JUIZ)
    const quem = pedido.usuario!.id
    const [u] = await banco.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, quem))
    const atual = await peticaoDa(casoId, s.exigencia.criadoEm)
    // Trocar de manifestação para dilação (ou o contrário) começa outra petição, com a numeração do zero.
    const p = atual && atual.tipo === tipo ? atual : null
    const dados = await guardarArquivo(armazenamento, casoId, arquivo, tipo)
    const numero = await banco.transaction(async (tx) => {
      const pet = p ?? (await tx.insert(peticao).values({ casoId, tipo, pedidaPor: quem, criadoEm: agora() }).returning())[0]
      const anteriores = await tx.select({ numero: peticaoVersao.numero }).from(peticaoVersao).where(eq(peticaoVersao.peticaoId, pet.id))
      const n = anteriores.length + 1
      const [doc] = await tx.insert(documento).values({ casoId, tipo: `${tipo}_versao`, origem: 'portal', recebidoPor: quem, ...dados }).returning()
      await tx.insert(peticaoVersao).values({
        peticaoId: pet.id,
        numero: n,
        conteudo: `Versão ${n} anexada: ${arquivo.nome}`,
        hash: createHash('sha256').update(arquivo.conteudo).digest('hex'),
        geradaPor: u?.nome ?? 'advogada',
        documentoId: doc.id,
      })
      return n
    })
    await historico(quem, 'manifestacao_versao_anexada', pedido, `caso:${casoId}`, { tipo, numero })
    return resposta.code(201).send({ ok: true, numero })
  })

  // G6, CA9: a advogada aprova a última versão; aprovar uma antiga não vale.
  app.post<{ Params: { id: string; n: string } }>(
    '/api/casos/:id/manifestacao/versoes/:n/aprovacao',
    { preHandler: exigir(banco, 'exigencia_juiz.manifestar', agora) },
    async (pedido, resposta) => {
      const entrada = AprovarVersao.safeParse(pedido.body)
      if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Marque a aprovação.')
      const s = await situacaoDaExigenciaJuiz(banco, pedido.params.id)
      const p = s ? await peticaoDa(pedido.params.id, s.exigencia.criadoEm) : null
      const ultima = p ? (await versoesDa(p.id)).at(-1) : undefined
      if (!ultima || ultima.numero !== Number(pedido.params.n)) return negar(resposta, 409, 'Aprove a última versão anexada.')
      await banco.update(peticaoVersao).set({ aprovadaPor: pedido.usuario!.id, aprovadaEm: agora() }).where(eq(peticaoVersao.id, ultima.id))
      await historico(pedido.usuario!.id, 'manifestacao_aprovada', pedido, `caso:${pedido.params.id}`, { versao: ultima.numero, hash: ultima.hash })
      return resposta.code(201).send({ ok: true })
    },
  )

  // CA12: a Sênior autoriza o pedido de dilação, com o motivo.
  app.post<{ Params: { id: string } }>('/api/casos/:id/manifestacao/dilacao', { preHandler: exigir(banco, 'exigencia_juiz.autorizar_dilacao', agora) }, async (pedido, resposta) => {
    const entrada = AutorizarDilacao.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Escreva o motivo.')
    const s = await situacaoDaExigenciaJuiz(banco, pedido.params.id)
    if (!s) return negar(resposta, 409, MSG_SEM_EXIGENCIA_JUIZ)
    await banco.insert(decisao).values({
      casoId: pedido.params.id,
      passo: 'D3a.04',
      tipo: 'dilacao',
      resultado: 'autorizada',
      justificativa: entrada.data.motivo,
      decididoPor: pedido.usuario!.id,
      perfil: pedido.perfilAtivo!,
      decididoEm: agora(),
    })
    await historico(pedido.usuario!.id, 'dilacao_autorizada', pedido, `caso:${pedido.params.id}`, { motivo: entrada.data.motivo, pendentes: s.faltam })
    return resposta.code(201).send({ ok: true })
  })

  // CA2, CA3, CA9, CA10, CA12 (G6, G21): protocola só a versão aprovada, com data e comprovante, e volta para a vigília.
  app.post<{ Params: { id: string } }>('/api/casos/:id/manifestacao/protocolo', { preHandler: exigir(banco, 'exigencia_juiz.manifestar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const formulario = await lerFormulario(pedido)
    if (!formulario) return negar(resposta, 400, MSG_COMPROVANTE)
    const entrada = ProtocolarManifestacao.safeParse(formulario.campos)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const s = await situacaoDaExigenciaJuiz(banco, casoId)
    if (!s) return negar(resposta, 409, MSG_SEM_EXIGENCIA_JUIZ)
    const quem = pedido.usuario!.id
    const p = await peticaoDa(casoId, s.exigencia.criadoEm)
    const ultima = p ? (await versoesDa(p.id)).at(-1) : undefined
    if (!p || !ultima?.aprovadaEm) {
      await bloqueio(pedido, casoId, 'G6', 'D3a.04', { motivo: 'versao_nao_aprovada', versao: ultima?.numero ?? null }, 'protocolo_bloqueado')
      return negar(resposta, 409, MSG_VERSAO_NAO_APROVADA)
    }
    const dilacao = p.tipo === 'dilacao'
    if (dilacao && !(await dilacaoAutorizada(casoId, s.exigencia.criadoEm))) return negar(resposta, 409, 'O pedido de dilação precisa do OK da Sênior.')
    if (!dilacao && s.faltam.length) {
      await bloqueio(pedido, casoId, 'G21', 'D3a.04', { faltam: s.faltam.length })
      return negar(resposta, 409, `Sem prova em todos os itens, não se manifesta (G21). Falta: ${s.faltam.join(', ')}.`)
    }
    const arquivo = formulario.arquivo
    if (!arquivo || !TIPOS_DE_ANEXO.includes(arquivo.mime)) return negar(resposta, 400, MSG_COMPROVANTE)
    const dados = await guardarArquivo(armazenamento, casoId, arquivo, 'comprovante-protocolo-judicial')
    const cnj = await cnjDa(s.exigencia.publicacaoId)
    const fechar = { situacao: 'concluida' as const, concluidaEm: agora(), concluidaPor: quem }
    await banco.transaction(async (tx) => {
      const [doc] = await tx.insert(documento).values({ casoId, tipo: 'comprovante_protocolo_judicial', origem: 'portal', recebidoPor: quem, ...dados }).returning()
      await tx.insert(protocoloJudicial).values({
        peticaoVersaoId: ultima.id,
        tribunal: tribunalDoCnj(cnj) ?? 'não informado',
        protocoladoEm: new Date(`${entrada.data.dataProtocolo}T12:00:00-03:00`),
        comprovanteDocumentoId: doc.id,
        protocoladoPor: quem,
      })
      if (dilacao) {
        // CA12: a dilação não fecha a exigência; os setores seguem.
        await tx.update(exigencia).set({ situacao: 'dilacao_pedida' }).where(eq(exigencia.id, s.exigencia.id))
        return
      }
      // CA2: manifestado, a exigência se cumpre e o processo volta para a vigília (a próxima publicação recomeça o ciclo).
      await tx.update(exigencia).set({ situacao: 'cumprida' }).where(eq(exigencia.id, s.exigencia.id))
      await tx
        .update(tarefa)
        .set(fechar)
        .where(and(eq(tarefa.casoId, casoId), inArray(tarefa.passo, ['D3a.03', 'D3a.03s', 'D3a.04']), isNull(tarefa.concluidaEm)))
      await tx
        .update(etapa)
        .set(fechar)
        .where(and(eq(etapa.casoId, casoId), eq(etapa.diagrama, 'D3a'), isNull(etapa.concluidaEm)))
    })
    // CA10: a manifestação entra na linha do processo (histórico) com autora, data e versão.
    await historico(quem, dilacao ? 'dilacao_protocolada' : 'manifestacao_protocolada', pedido, `caso:${casoId}`, {
      versao: ultima.numero,
      hash: ultima.hash,
      data: entrada.data.dataProtocolo,
      semProva: s.encerradosSemProva.map((e) => ({ descricao: e.descricao, motivo: e.motivo })),
    })
    return resposta.code(201).send({ ok: true, tipo: p.tipo })
  })

  // CA13: sistema do tribunal fora do ar no último dia: com a prova e a data da volta, o prazo vai para o dia útil seguinte.
  app.post<{ Params: { id: string } }>(
    '/api/casos/:id/manifestacao/indisponibilidade',
    { preHandler: exigir(banco, 'exigencia_juiz.manifestar', agora) },
    async (pedido, resposta) => {
      const casoId = pedido.params.id
      const formulario = await lerFormulario(pedido)
      const entrada = RegistrarIndisponibilidade.safeParse(formulario?.campos ?? {})
      if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
      const arquivo = formulario?.arquivo
      if (!arquivo || !TIPOS_DE_ANEXO.includes(arquivo.mime)) return negar(resposta, 400, 'Anexe a prova da indisponibilidade (PDF ou imagem, até 25 MB).')
      const s = await situacaoDaExigenciaJuiz(banco, casoId)
      if (!s?.exigencia.publicacaoId) return negar(resposta, 409, MSG_SEM_EXIGENCIA_JUIZ)
      const [pz] = await banco.select().from(prazo).where(eq(prazo.publicacaoId, s.exigencia.publicacaoId)).orderBy(desc(prazo.criadoEm)).limit(1)
      const novoFim = prazoDepoisDaIndisponibilidade(entrada.data.voltouEm, await feriadosDoProcesso(banco, await cnjDa(s.exigencia.publicacaoId)))
      const quem = pedido.usuario!.id
      const dados = await guardarArquivo(armazenamento, casoId, arquivo, 'indisponibilidade-tribunal')
      await banco.transaction(async (tx) => {
        await tx.insert(documento).values({ casoId, tipo: 'indisponibilidade_tribunal', origem: 'portal', recebidoPor: quem, ...dados })
        await tx.insert(prazo).values({
          casoId,
          origem: 'indisponibilidade_tribunal',
          publicacaoId: s.exigencia.publicacaoId,
          inicio: pz?.inicio ?? entrada.data.voltouEm,
          fim: novoFim,
          regra: REGRA_INDISPONIBILIDADE.texto,
          regraVersao: REGRA_INDISPONIBILIDADE.versao,
        })
        await tx.update(exigencia).set({ prazo: novoFim }).where(eq(exigencia.id, s.exigencia.id))
        await tx
          .update(tarefa)
          .set({ prazo: novoFim })
          .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3a.04'), isNull(tarefa.concluidaEm)))
      })
      await historico(quem, 'indisponibilidade_registrada', pedido, `caso:${casoId}`, { voltouEm: entrada.data.voltouEm, novoFim })
      return resposta.code(201).send({ ok: true, prazo: novoFim })
    },
  )
}
