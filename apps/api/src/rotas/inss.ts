// Via administrativa no INSS, grupo 1 (GGVP-27 protocolar no Meu INSS, GGVP-31 decidir perícia) e a Central do perfil.
import { createHash, randomUUID } from 'node:crypto'
import fastifyMultipart from '@fastify/multipart'
import bcrypt from 'bcryptjs'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import {
  CasoParaProtocolo,
  DecidirPericia,
  RegistrarProtocolo,
  TIPOS_COMPROVANTE,
  TarefaDaCentral,
  type Erro,
  type SenhaDoCofre,
} from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import {
  caso,
  credencialGovbr,
  decisao,
  documento,
  etapa,
  identificadorCaso,
  pericia,
  pessoa,
  requerimentoInss,
  tarefa,
} from '../banco/esquema.ts'
import type { Cofre } from '../cofre.ts'
import { okDaSenior } from '../fluxo/conferencia.ts'
import { avancarJuncaoD2 } from '../fluxo/juncao-d2.ts'
import { alertasDeExigencia } from '../fluxo/exigencia.ts'
import { PASSOS_COM_GOVBR, alertarUsoForaDoPadrao } from '../fluxo/cofre.ts'
import { itensDaFila } from '../vigilia/fila.ts'
import { alarmesDaVigilia } from './vigilia-diario.ts'
import { exigir, registrarBloqueio, registrarHistorico } from '../sessao/rotas.ts'

export const MSG_SEM_OK_SENIOR = 'Só protocola depois do OK da Sênior (G2).'
export const MSG_COMPROVANTE = 'Anexe o comprovante do protocolo (PDF ou imagem, até 25 MB).'
export const SEGUNDOS_SENHA = 60
export const MSG_COFRE_SEM_TAREFA = 'A senha do gov.br só abre com uma tarefa aberta que use o gov.br: protocolar no Meu INSS ou marcar a perícia.'
const TAMANHO_MAXIMO = 25 * 1024 * 1024

/** Tela de cada passo, quando já existe. */
const TELA_DO_PASSO: Record<string, (casoId: string) => string> = {
  'D2.01': (id) => `/casos/${id}/conferencia`,
  'D2.02': (id) => `/casos/${id}/protocolo`,
  'D2.03': (id) => `/casos/${id}/pericia`,
  'D2.04': (id) => `/casos/${id}/vigilia`,
  'D2.05': (id) => `/casos/${id}/exigencia`,
  'D2.05d': (id) => `/casos/${id}/exigencia/documentos`,
  'D2.05r': (id) => `/casos/${id}/exigencia`,
  'D2.06': (id) => `/casos/${id}/prestacao`,
  'D2.06r': (id) => `/casos/${id}/prestacao/recebimento`,
  'D2.06b': (id) => `/casos/${id}/banco`,
  'D3b.06r': (id) => `/casos/${id}/resultado`,
  'D3b.06': (id) => `/casos/${id}/resultado`,
  'D3.03': (id) => `/casos/${id}/despacho`,
  'D3.04': (id) => `/casos/${id}/pendencias`,
  'D3.04s': (id) => `/casos/${id}/despacho`,
  'D3.05': (id) => `/casos/${id}/peticao`,
  'D3.06': (id) => `/casos/${id}/peticao`,
  'D3.07': (id) => `/casos/${id}/peticao`,
  // GGVP-99 CA12: o Sócio autoriza a exportação na linha do processo; GGVP-103 CA7: o alerta do cofre abre o mesmo lugar.
  historico: (id) => `/casos/${id}/historico`,
  cofre: (id) => `/casos/${id}/historico`,
  'D3a.01': (id) => `/casos/${id}/publicacoes`,
  'D3a.02': (id) => `/casos/${id}/exigencia-juiz`,
  'D3a.03': (id) => `/casos/${id}/exigencia-juiz/setor`,
  'D3a.03s': (id) => `/casos/${id}/exigencia-juiz`,
  'D3a.04': (id) => `/casos/${id}/manifestacao`,
  'D4.02': (id) => `/casos/${id}/publicacoes`,
}

type Opcoes = { banco: Banco; cofre: Cofre; armazenamento: Armazenamento; agora?: () => Date }

const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const hoje = (agora: Date) => agora.toISOString().slice(0, 10)

export function registrarRotasInss(app: FastifyInstance, { banco, cofre, armazenamento, agora = () => new Date() }: Opcoes) {
  app.register(fastifyMultipart, { limits: { fileSize: TAMANHO_MAXIMO, files: 1, fields: 10 } })
  const historico = registrarHistorico(banco, agora)
  const bloqueio = registrarBloqueio(banco, agora)

  /** G2: o OK é a última decisão D2.01 aprovada (fluxo/conferencia.ts). */
  async function okDaSeniorAprovado(casoId: string) {
    const d = await okDaSenior(banco, casoId)
    return d?.resultado === 'aprovado' ? { por: d.por, em: d.em.toISOString() } : null
  }

  async function concluirTarefa(casoId: string, passo: string, por: string) {
    await banco
      .update(tarefa)
      .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: por })
      .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, passo), isNull(tarefa.concluidaEm)))
  }

  // Central do perfil (GGVP-78): tarefas abertas da raia do perfil ativo. Protocolo sem OK da Sênior não aparece (GGVP-27 CA5).
  app.get('/api/tarefas', async (pedido) => {
    const linhas = await banco
      .select({ tarefa, cliente: { id: pessoa.id, nome: pessoa.nome }, beneficio: caso.beneficio })
      .from(tarefa)
      .innerJoin(caso, eq(tarefa.casoId, caso.id))
      .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
      .where(and(eq(tarefa.perfilDono, pedido.perfilAtivo!), inArray(tarefa.situacao, ['aberta', 'em_andamento'])))
      .orderBy(asc(tarefa.prazo), asc(tarefa.criadoEm))
    const visiveis = []
    for (const l of linhas) {
      if (l.tarefa.passo === 'D2.02' && !(await okDaSeniorAprovado(l.tarefa.casoId))) continue
      visiveis.push(
        TarefaDaCentral.parse({
          id: l.tarefa.id,
          casoId: l.tarefa.casoId,
          passo: l.tarefa.passo,
          cliente: l.cliente,
          titulo: l.tarefa.titulo,
          detalhe: (l.beneficio ?? 'benefício a definir').replaceAll('_', ' '),
          tela: l.tarefa.passo && TELA_DO_PASSO[l.tarefa.passo] ? TELA_DO_PASSO[l.tarefa.passo](l.tarefa.casoId) : null,
          prazo: l.tarefa.prazo,
          // Pensão por morte em destaque na fila da Sênior (regra dos 90 dias do óbito; resposta do revisor de 05/10).
          urgente: (l.tarefa.prazo !== null && l.tarefa.prazo <= hoje(agora())) || (l.tarefa.passo === 'D2.01' && l.beneficio === 'pensao_morte'),
        }),
      )
    }
    // GGVP-68 CA4 (Lucas, 02/10): os alertas de vencimento da exigência vão à Sênior e ao líder do administrativo.
    if (pedido.perfilAtivo !== 'senior' && pedido.perfilAtivo !== 'atendimento_lider') return visiveis
    // GGVP-39 CA14: a 5 dias úteis, alerta; a 2 ou menos (ou vencida), no topo da fila.
    const linha = (a: Awaited<ReturnType<typeof alertasDeExigencia>>[number]) =>
      TarefaDaCentral.parse({
        id: a.exigenciaId,
        casoId: a.casoId,
        passo: a.origem === 'juizo' ? 'D3a.02' : 'D2.05',
        cliente: a.cliente,
        titulo:
          a.diasUteis < 0
            ? `Exigência ${a.origem === 'juizo' ? 'do juiz' : 'do INSS'} vencida: pedir dilação ou registrar a perda`
            : `Exigência ${a.origem === 'juizo' ? 'do juiz' : 'do INSS'} perto do prazo: ${a.diasUteis === 0 ? 'vence hoje' : a.diasUteis === 1 ? '1 dia útil' : `${a.diasUteis} dias úteis`}`,
        detalhe: (a.beneficio ?? 'benefício a definir').replaceAll('_', ' '),
        tela: TELA_DO_PASSO[a.origem === 'juizo' ? 'D3a.02' : 'D2.05'](a.casoId),
        prazo: a.prazo,
        urgente: true,
      })
    const alertas = await alertasDeExigencia(banco, hoje(agora()))
    if (pedido.perfilAtivo === 'atendimento_lider')
      return [...alertas.filter((a) => a.diasUteis <= 2).map(linha), ...visiveis, ...alertas.filter((a) => a.diasUteis > 2).map(linha)]
    // GGVP-26 CA3, CA12: cada item da fila de revisão é "Casar publicação", com o contexto no lugar do cliente;
    // com o prazo mínimo a 2 dias úteis ou menos, vai para o topo.
    const fila = (await itensDaFila(banco, agora())).map((f) => ({
      urgente: f.diasUteisAtePrazo <= 2,
      linha: TarefaDaCentral.parse({
        id: f.id,
        casoId: null,
        passo: 'D4.01',
        cliente: null,
        contexto: 'Fila de revisão',
        titulo: 'Casar publicação',
        detalhe: `${f.motivo} · ${f.fonte}${f.idadeEmDias >= 1 ? ` · há ${f.idadeEmDias} dia${f.idadeEmDias > 1 ? 's' : ''} na fila` : ''}`,
        tela: '/vigilia',
        prazo: f.prazoMinimo.fim,
        urgente: f.diasUteisAtePrazo <= 2 || f.idadeEmDias >= 1,
      }),
    }))
    return [
      // GGVP-30 CA1, CA11: rodada com falha vem antes de tudo.
      ...(await alarmesDaVigilia(banco, agora())),
      ...alertas.filter((a) => a.diasUteis <= 2).map(linha),
      ...fila.filter((f) => f.urgente).map((f) => f.linha),
      ...visiveis,
      ...alertas.filter((a) => a.diasUteis > 2).map(linha),
      ...fila.filter((f) => !f.urgente).map((f) => f.linha),
    ]
  })

  const comCaso = { preHandler: exigir(banco, 'protocolo_inss.registrar', agora) }

  // GGVP-27 CA1: o caso com os documentos na ordem (só tipo e nome) e se há senha no cofre.
  app.get<{ Params: { id: string } }>('/api/casos/:id/protocolo', comCaso, async (pedido, resposta) => {
    const [c] = await banco
      .select({ id: caso.id, beneficio: caso.beneficio, cliente: pessoa.nome, pessoaId: pessoa.id })
      .from(caso)
      .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
      .where(eq(caso.id, pedido.params.id))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    const docs = await banco
      .select({ id: documento.id, tipo: documento.tipo, nome: documento.nomeOriginal })
      .from(documento)
      .where(and(eq(documento.casoId, c.id), isNull(documento.excluidoEm)))
      .orderBy(asc(documento.criadoEm))
    const [senha] = await banco.select({ id: credencialGovbr.id }).from(credencialGovbr).where(eq(credencialGovbr.pessoaId, c.pessoaId))
    const [protocolo] = await banco.select({ id: requerimentoInss.id }).from(requerimentoInss).where(eq(requerimentoInss.casoId, c.id))
    return CasoParaProtocolo.parse({
      casoId: c.id,
      cliente: c.cliente,
      beneficio: c.beneficio,
      okSenior: await okDaSeniorAprovado(c.id),
      documentos: docs,
      temSenhaNoCofre: Boolean(senha),
      pessoaId: c.pessoaId,
      jaProtocolado: Boolean(protocolo),
    })
  })

  // GGVP-27 CA2 a CA4, CA7: registrar o protocolo com número, DER, conferência e comprovante.
  app.post<{ Params: { id: string } }>('/api/casos/:id/protocolo', comCaso, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const campos: Record<string, string> = {}
    let arquivo: { conteudo: Buffer; mime: string; nome: string } | null = null
    try {
      for await (const parte of pedido.parts()) {
        if (parte.type === 'file') arquivo = { conteudo: await parte.toBuffer(), mime: parte.mimetype, nome: parte.filename }
        else campos[parte.fieldname] = String(parte.value)
      }
    } catch {
      return negar(resposta, 400, MSG_COMPROVANTE)
    }
    const entrada = RegistrarProtocolo.safeParse({ ...campos, revisado: campos.revisado === 'true' })
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Dados do protocolo inválidos.')
    if (!arquivo || !(TIPOS_COMPROVANTE as readonly string[]).includes(arquivo.mime)) return negar(resposta, 400, MSG_COMPROVANTE)

    const [c] = await banco.select({ id: caso.id }).from(caso).where(eq(caso.id, casoId))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    if (!(await okDaSeniorAprovado(casoId))) {
      await bloqueio(pedido, casoId, 'G2', 'D2.02', {}, 'protocolo_recusado_sem_ok')
      return negar(resposta, 409, MSG_SEM_OK_SENIOR)
    }
    const [jaTem] = await banco.select({ id: requerimentoInss.id }).from(requerimentoInss).where(eq(requerimentoInss.casoId, casoId))
    if (jaTem) return negar(resposta, 409, 'Este caso já foi protocolado.')
    const [numeroEmOutroCaso] = await banco
      .select({ id: identificadorCaso.id })
      .from(identificadorCaso)
      .where(and(eq(identificadorCaso.tipo, 'protocolo_inss'), eq(identificadorCaso.valor, entrada.data.numero)))
    if (numeroEmOutroCaso) return negar(resposta, 409, 'Esse número de requerimento já está em outro caso.')

    const chave = `casos/${casoId}/${randomUUID()}-comprovante-protocolo`
    await armazenamento.salvar(chave, arquivo.conteudo, arquivo.mime)
    const quem = pedido.usuario!.id
    await banco.transaction(async (tx) => {
      const [doc] = await tx
        .insert(documento)
        .values({
          casoId,
          tipo: 'comprovante_protocolo_inss',
          chaveArmazenamento: chave,
          nomeOriginal: arquivo.nome,
          mime: arquivo.mime,
          tamanho: arquivo.conteudo.length,
          hashSha256: createHash('sha256').update(arquivo.conteudo).digest('hex'),
          origem: 'portal',
          recebidoPor: quem,
        })
        .returning()
      await tx.insert(requerimentoInss).values({
        casoId,
        numero: entrada.data.numero,
        der: entrada.data.der,
        comprovanteDocumentoId: doc.id,
        revisadoAntesDeEnviar: true,
        registradoPor: quem,
      })
      await tx.insert(identificadorCaso).values({ casoId, tipo: 'protocolo_inss', valor: entrada.data.numero })
      // CA7: o caso passa a esperar o INSS (espera D2.E1, código proposto).
      await tx.insert(etapa).values({ casoId, diagrama: 'D2', passo: 'D2.E1', situacao: 'aguardando_externo', aguardando: 'INSS receber o requerimento', iniciadaEm: agora() })
    })
    await concluirTarefa(casoId, 'D2.02', quem)
    await historico(quem, 'protocolo_registrado', pedido, `caso:${casoId}`, { numero: entrada.data.numero })
    const juncao = await avancarJuncaoD2(banco, casoId, agora())
    return resposta.code(201).send({ ok: true, juncao })
  })

  // GGVP-27 CA6 (G9): a senha do gov.br só depois de a pessoa confirmar a própria senha do portal; tempo limitado; histórico.
  app.post<{ Params: { id: string }; Body: { senhaDoPortal?: string } }>('/api/casos/:id/cofre', comCaso, async (pedido, resposta) => {
    const quem = pedido.usuario!
    // GGVP-103 CA5: só com tarefa aberta no caso que use o gov.br; a tarefa é o motivo que vai para o histórico (CA6).
    const [tarefaDoGov] = await banco
      .select({ passo: tarefa.passo, titulo: tarefa.titulo })
      .from(tarefa)
      .where(and(eq(tarefa.casoId, pedido.params.id), inArray(tarefa.passo, [...PASSOS_COM_GOVBR]), isNull(tarefa.concluidaEm)))
    if (!tarefaDoGov) {
      await historico(quem.id, 'cofre_uso_recusado', pedido, `caso:${pedido.params.id}`)
      return negar(resposta, 403, MSG_COFRE_SEM_TAREFA)
    }
    if (!pedido.body?.senhaDoPortal || !(await bcrypt.compare(pedido.body.senhaDoPortal, quem.senhaHash))) {
      await historico(quem.id, 'cofre_negado', pedido, `caso:${pedido.params.id}`)
      return negar(resposta, 403, 'A senha do portal não confere.')
    }
    const [credencial] = await banco
      .select({ senhaCifrada: credencialGovbr.senhaCifrada, iv: credencialGovbr.iv, pessoaId: credencialGovbr.pessoaId })
      .from(caso)
      .innerJoin(credencialGovbr, eq(credencialGovbr.pessoaId, caso.pessoaId))
      .where(eq(caso.id, pedido.params.id))
    if (!credencial) return negar(resposta, 404, 'Este cliente não tem senha do gov.br no cofre.')
    await historico(quem.id, 'cofre_senha_lida', pedido, `caso:${pedido.params.id}`, { pessoa: credencial.pessoaId, motivo: tarefaDoGov.titulo, passo: tarefaDoGov.passo })
    // GGVP-103 CA7: uso fora do padrão (volume ou horário) avisa a Sênior.
    await alertarUsoForaDoPadrao(banco, quem.id, pedido.params.id, agora())
    resposta.header('cache-control', 'no-store')
    return { senha: cofre.decifrar(credencial), segundos: SEGUNDOS_SENHA } satisfies SenhaDoCofre
  })

  // GGVP-31: a advogada decide; o sistema abre a tarefa de perícia para o Jurídico administrativo.
  app.post<{ Params: { id: string } }>('/api/casos/:id/pericia', { preHandler: exigir(banco, 'pericia.decidir', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = DecidirPericia.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Responda se o caso precisa de perícia')
    const [c] = await banco.select({ id: caso.id }).from(caso).where(eq(caso.id, casoId))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    if (!(await okDaSeniorAprovado(casoId))) return negar(resposta, 409, 'A perícia é decidida depois do OK da Sênior.')
    const [jaDecidida] = await banco
      .select({ id: etapa.id })
      .from(etapa)
      .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D2.03'), eq(etapa.situacao, 'concluida')))
    if (jaDecidida) return negar(resposta, 409, 'A perícia deste caso já foi decidida.')

    const quem = pedido.usuario!.id
    const tipos = entrada.data.precisa ? entrada.data.tipos : []
    await banco.transaction(async (tx) => {
      const [e] = await tx
        .insert(etapa)
        .values({ casoId, diagrama: 'D2', passo: 'D2.03', situacao: 'concluida', iniciadaEm: agora(), concluidaEm: agora(), concluidaPor: quem })
        .returning()
      // CA6: autora e horário.
      await tx.insert(decisao).values({
        casoId,
        passo: 'D2.03',
        tipo: 'pericia',
        resultado: tipos.length ? 'com_pericia' : 'sem_pericia',
        justificativa: tipos.join(',') || null,
        decididoPor: quem,
        perfil: pedido.perfilAtivo!,
        decididoEm: agora(),
      })
      if (tipos.length) {
        for (const tipo of tipos) await tx.insert(pericia).values({ casoId, tipo, chamadaPorEtapaId: e.id })
        // CA1: aberta pelo sistema, para a raia do Jurídico administrativo (DP.01).
        const nomes = tipos.map((t) => (t === 'medica' ? 'perícia médica' : 'avaliação social')).join(' e ')
        await tx.insert(tarefa).values({ casoId, passo: 'DP.01', titulo: `Marcar ${nomes}`, perfilDono: 'juridico_adm' })
      }
    })
    await concluirTarefa(casoId, 'D2.03', quem)
    await historico(quem, 'pericia_decidida', pedido, `caso:${casoId}`, { tipos })
    const juncao = await avancarJuncaoD2(banco, casoId, agora())
    return resposta.code(201).send({ ok: true, juncao })
  })
}
