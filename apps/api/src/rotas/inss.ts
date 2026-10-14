// Via administrativa no INSS, grupo 1 (GGVP-27 protocolar no Meu INSS, GGVP-31 decidir perícia) e a Central do perfil.
import { createHash, randomUUID } from 'node:crypto'
import fastifyMultipart from '@fastify/multipart'
import bcrypt from 'bcryptjs'
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  CasoParaProtocolo,
  DecidirPericia,
  RegistrarProtocolo,
  SEGUNDOS_SENHA,
  TIPOS_COMPROVANTE,
  TarefaDaCentral,
  nomeDoBeneficio,
  pode,
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
  usuario,
} from '../banco/esquema.ts'
import type { Cofre } from '../cofre.ts'
import { okDaSenior } from '../fluxo/conferencia.ts'
import { avancarJuncaoD2 } from '../fluxo/juncao-d2.ts'
import { alertasDeExigencia } from '../fluxo/exigencia.ts'
import { esperasDeFora, esperasQueChamamHoje } from '../fluxo/esperas.ts'
import { anosSemFeriados } from '../fluxo/feriados-ao-subir.ts'
import { PASSOS_COM_GOVBR, alertarUsoForaDoPadrao } from '../fluxo/cofre.ts'
import { ID_CONFERIR_DESFECHOS, conferenciaDoAcervo } from '../fluxo/acervo.ts'
import { daRecepcao } from '../fluxo/tarefas-da-recepcao.ts'
import { hojeEmBrasilia, itensDaFila } from '../vigilia/fila.ts'
import { alarmesDaVigilia } from './vigilia-diario.ts'
import { aposErro, estaTravado } from '../sessao/regras.ts'
import { MSG_TRAVADO, exigir, registrarBloqueio, registrarHistorico } from '../sessao/rotas.ts'
import { podeMarcar, type Pericia } from '../../../web/src/regras/periciaNoCaso.ts'
import type { TarefasPorArea } from '../fluxo/tarefasPorArea.ts'

export const MSG_SEM_OK_SENIOR = 'Só protocola depois do OK da Sênior (G2).'
export const MSG_COMPROVANTE = 'Anexe o comprovante do protocolo (PDF ou imagem, até 25 MB).'
export const MSG_COFRE_SEM_TAREFA = 'A senha do gov.br só abre com uma tarefa aberta que use o gov.br: protocolar no Meu INSS ou marcar a perícia.'
const TAMANHO_MAXIMO = 25 * 1024 * 1024

/** Tela de cada passo, quando já existe. */
export const TELA_DO_PASSO: Record<string, (casoId: string) => string> = {
  // GGVP-127: o caso devolvido pela Sênior, com o motivo e o prazo, para ajustar e liberar de novo.
  'D1.ajuste': (id) => `/casos/${id}/ajuste`,
  // Bloco 5d (GGVP-125): "Liberar ao Jurídico" do caso da Recepção, que nasce com o checklist conferido completo.
  'D1.24': (id) => `/casos/${id}/liberar`,
  'D2.01': (id) => `/casos/${id}/conferencia`,
  'D2.02': (id) => `/casos/${id}/protocolo`,
  // A decisão da perícia tem tela própria; /casos/:id/pericia é a página da perícia, para todos os perfis do caso.
  'D2.03': (id) => `/casos/${id}/pericia/decidir`,
  'D2.04': (id) => `/casos/${id}/vigilia`,
  'D2.05': (id) => `/casos/${id}/exigencia`,
  'D2.05d': (id) => `/casos/${id}/exigencia/documentos`,
  'D2.05r': (id) => `/casos/${id}/exigencia`,
  'D2.06': (id) => `/casos/${id}/prestacao`,
  'D2.06r': (id) => `/casos/${id}/prestacao/recebimento`,
  'D2.06b': (id) => `/casos/${id}/banco`,
  // GGVP-100: "Vale recorrer?" e, com "Recorrer", a tarefa do recurso abre a mesma tela (a decisão e o prazo).
  'D3b.04': (id) => `/casos/${id}/recurso`,
  'D3b.04r': (id) => `/casos/${id}/recurso`,
  // GGVP-98 (P3 do roteiro de 09/10): quem do Atendimento leva o cliente ao banco.
  'D2.06l': (id) => `/casos/${id}/banco/levar`,
  'D3b.06r': (id) => `/casos/${id}/resultado`,
  'D3b.06': (id) => `/casos/${id}/resultado`,
  // GGVP-19 CA3: a revisão do estudo é na tela de estudos.
  'D3b.05': () => '/estudos',
  // GGVP-38: a recomendação da perícia, para a advogada conferir.
  'DP.00': (id) => `/casos/${id}/pericias`,
  // GGVP-59: "Quesitos e assistente técnico", da nomeação de perito, abre onde ficam os quesitos.
  'DP.05': (id) => `/casos/${id}/pericias`,
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
  // GGVP-90: confirmar o desfecho e "Acompanhar pagamento" abrem a mesma tela.
  'D4.02': (id) => `/casos/${id}/desfecho`,
  'D3b.01': (id) => `/casos/${id}/desfecho`,
  // A tarefa "Marcar perícia" que o sistema abre (DP.01): a tela de marcar do caso, onde o Jurídico administrativo também
  // registra que o INSS liberou o agendamento.
  'DP.01': (id) => `/casos/${id}/pericia/marcar`,
}

type Opcoes = { banco: Banco; cofre: Cofre; armazenamento: Armazenamento; agora?: () => Date; tarefasPorArea?: TarefasPorArea }

const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const hoje = hojeEmBrasilia // CA7 (GGVP-118): o dia de Brasília, não o de UTC

/**
 * GGVP-127 CA3: o ajuste com prazo fica com a cor de ação a partir destes dias antes de vencer. O cartão diz "perto de
 * vencer" sem número: é parâmetro, a confirmar com o Lucas.
 */
export const DIAS_DE_AVISO_DO_AJUSTE = 2
export const MSG_SEM_ESPERA = 'Este caso não está esperando ninguém de fora.'
const pertoDeVencer = (prazo: string, agora: Date) => prazo <= hoje(new Date(agora.getTime() + DIAS_DE_AVISO_DO_AJUSTE * 86_400_000))

export function registrarRotasInss(app: FastifyInstance, { banco, cofre, armazenamento, agora = () => new Date(), tarefasPorArea }: Opcoes) {
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

  /** As tarefas do banco abertas na raia do perfil, como a Central mostra. */
  async function tarefasDoPerfil(perfil: string): Promise<TarefaDaCentral[]> {
    // GGVP-158 P7.2: a tarefa da pessoa que ainda não tem caso (o fechamento do lead) também entra, com o cliente da linha.
    const linhas = await banco
      .select({ tarefa, casoId: caso.id, cliente: { id: pessoa.id, nome: pessoa.nome }, beneficio: caso.beneficio })
      .from(tarefa)
      .leftJoin(caso, eq(tarefa.casoId, caso.id))
      .innerJoin(pessoa, sql`${pessoa.id} = coalesce(${tarefa.pessoaId}, ${caso.pessoaId})`)
      // GGVP-158 P6.7: as tarefas da conversa (D5) chegam à Central pela rota da conversa, como antes; aqui não repetem.
      .where(and(eq(tarefa.perfilDono, perfil), inArray(tarefa.situacao, ['aberta', 'em_andamento']), sql`coalesce(${tarefa.passo}, '') not like 'D5.%'`))
      .orderBy(asc(tarefa.prazo), asc(tarefa.criadoEm))
    const visiveis: TarefaDaCentral[] = []
    for (const l of linhas) {
      if (l.tarefa.passo === 'D2.02' && (!l.casoId || !(await okDaSeniorAprovado(l.casoId)))) continue
      // As da Recepção levam o id que a tela já usa (a atribuição do líder, GGVP-147, segue valendo) e a tela delas.
      const daTela = daRecepcao(l.tarefa)
      const alvo = l.casoId ?? l.cliente.id
      visiveis.push(
        TarefaDaCentral.parse({
          id: daTela ? daTela.id(alvo) : l.tarefa.id,
          casoId: l.casoId,
          passo: l.tarefa.passo,
          cliente: l.cliente,
          titulo: l.tarefa.titulo,
          detalhe: l.tarefa.detalhe ?? (l.beneficio ? nomeDoBeneficio(l.beneficio) : 'benefício a definir'),
          tela: daTela ? daTela.tela(alvo) : l.casoId && l.tarefa.passo && TELA_DO_PASSO[l.tarefa.passo] ? TELA_DO_PASSO[l.tarefa.passo](l.casoId) : null,
          prazo: l.tarefa.prazo,
          // Pensão por morte em destaque na fila da Sênior (regra dos 90 dias do óbito; resposta do revisor de 05/10).
          urgente:
            (l.tarefa.prazo !== null && l.tarefa.prazo <= hoje(agora())) ||
            (l.tarefa.passo === 'D2.01' && l.beneficio === 'pensao_morte') ||
            (l.tarefa.passo === 'D1.ajuste' && l.tarefa.prazo !== null && pertoDeVencer(l.tarefa.prazo, agora())),
        }),
      )
    }
    return perfil === 'advogada' ? comAsEsperas(visiveis) : visiveis
  }

  /**
   * GGVP-158 P5.4: cada espera de fora é uma linha da advogada, no topo no dia útil até alguém olhar no dia. A espera que
   * já tem a tarefa dela ("Trazer a resposta do INSS") usa a própria linha, sem repetir.
   */
  async function comAsEsperas(visiveis: TarefaDaCentral[]): Promise<TarefaDaCentral[]> {
    const chama = await esperasQueChamamHoje(banco, hoje(agora()))
    const topo: TarefaDaCentral[] = []
    const fim: TarefaDaCentral[] = []
    for (const e of await esperasDeFora(banco)) {
      const daTarefa = e.passo === 'D2.04' ? visiveis.find((t) => t.casoId === e.casoId && t.passo === 'D2.04') : undefined
      if (daTarefa) {
        if (chama(e.id)) topo.push({ ...visiveis.splice(visiveis.indexOf(daTarefa), 1)[0], urgente: true })
        continue
      }
      const desde = hoje(e.desde)
      const linha = TarefaDaCentral.parse({
        id: e.id,
        casoId: e.casoId,
        passo: e.passo,
        cliente: e.cliente,
        titulo: `Olhar a espera: ${e.oQue}`,
        detalhe: `${e.beneficio ? nomeDoBeneficio(e.beneficio) : 'benefício a definir'} · esperando desde ${desde.slice(8, 10)}/${desde.slice(5, 7)} · lembrete diário`,
        tela: e.passo === 'DP.E4' ? `/casos/${e.casoId}/pericia` : TELA_DO_PASSO['D2.04'](e.casoId),
        prazo: null,
        urgente: chama(e.id),
      })
      ;(linha.urgente ? topo : fim).push(linha)
    }
    return [...topo, ...visiveis, ...fim]
  }

  // GGVP-158 P5.4: "Olhei, sem novidade": as esperas de fora do caso saem do topo até o próximo dia útil.
  app.post<{ Params: { id: string } }>('/api/casos/:id/esperas/olhada', { preHandler: exigir(banco, 'tarefa.cumprir', agora) }, async (pedido, resposta) => {
    const esperas = await esperasDeFora(banco, pedido.params.id)
    if (!esperas.length) return negar(resposta, 409, MSG_SEM_ESPERA)
    for (const e of esperas) await historico(pedido.usuario!.id, 'espera_olhada', pedido, `caso:${e.casoId}`, { espera: e.id, oQue: e.oQue })
    return resposta.code(201).send({ ok: true })
  })
  // GGVP-147: as tarefas do banco entram nas tarefas do setor, no formato da linha da Central.
  tarefasPorArea?.registrar(async (perfil) =>
    (await tarefasDoPerfil(perfil)).map((t) => ({
      id: t.id,
      codigo: t.passo ?? '',
      cliente: t.cliente,
      ...(t.contexto && { contexto: t.contexto }),
      acao: t.titulo,
      detalhe: t.detalhe,
      ...(t.prazo && { prazo: `até ${t.prazo.slice(8, 10)}/${t.prazo.slice(5, 7)}` }),
      urgente: t.urgente,
      ...(t.tela && { href: t.tela }),
    })),
  )

  // Central do perfil (GGVP-78): tarefas abertas da raia do perfil ativo. Protocolo sem OK da Sênior não aparece (GGVP-27 CA5).
  app.get('/api/tarefas', { preHandler: exigir(banco, 'tarefa.ver', agora) }, async (pedido) => {
    const visiveis = await tarefasDoPerfil(pedido.perfilAtivo!)
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
        detalhe: a.beneficio ? nomeDoBeneficio(a.beneficio) : 'benefício a definir',
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
    // GGVP-55 CA7: a conferência dos desfechos do acervo aparece só enquanto houver processo esperando.
    const acervo = (await conferenciaDoAcervo(banco)).pendentes
    const conferir = acervo.length
      ? [
          TarefaDaCentral.parse({
            id: ID_CONFERIR_DESFECHOS,
            casoId: null,
            passo: 'D4.05',
            cliente: null,
            contexto: 'Acervo',
            titulo: 'Conferir desfechos do lote',
            detalhe: `${acervo.length} ${acervo.length === 1 ? 'processo' : 'processos'}`,
            tela: '/acervo/conferencia',
            prazo: null,
            urgente: false,
          }),
        ]
      : []
    // GGVP-158 P5.11: o ano sem feriados; o corrente vai ao topo, o seguinte (em dezembro), ao fim.
    const feriados = await anosSemFeriados(banco, hoje(agora()))
    return [
      // GGVP-30 CA1, CA11: rodada com falha vem antes de tudo.
      ...(await alarmesDaVigilia(banco, agora())),
      ...feriados.filter((f) => f.urgente),
      ...alertas.filter((a) => a.diasUteis <= 2).map(linha),
      ...fila.filter((f) => f.urgente).map((f) => f.linha),
      ...visiveis,
      ...conferir,
      ...alertas.filter((a) => a.diasUteis > 2).map(linha),
      ...fila.filter((f) => !f.urgente).map((f) => f.linha),
      ...feriados.filter((f) => !f.urgente),
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
  // GGVP-103 CA12 (orquestrador, 09/10): além do Jurídico administrativo, revela quem trata a exigência do INSS, porque
  // responde no portal do INSS do cliente (D2.05r). A matriz não muda: vale a permissão de tratar a exigência.
  const soProtocolo = exigir(banco, 'protocolo_inss.registrar', agora)
  const podeRevelar = {
    preHandler: async (pedido: FastifyRequest, resposta: FastifyReply) => (pode(pedido.perfilAtivo, 'exigencia_inss.tratar') ? undefined : soProtocolo.call(app, pedido, resposta)),
  }
  app.post<{ Params: { id: string }; Body: { senhaDoPortal?: string } }>('/api/casos/:id/cofre', podeRevelar, async (pedido, resposta) => {
    const quem = pedido.usuario!
    // GGVP-103 CA13: a senha do portal errada conta para a mesma trava do login (5 erros, 15 minutos), mesmo com a certa depois.
    const [conta] = await banco.select({ tentativas: usuario.tentativasErradas, travadoAte: usuario.travadoAte }).from(usuario).where(eq(usuario.id, quem.id))
    if (estaTravado(conta?.travadoAte ?? null, agora())) {
      await historico(quem.id, 'cofre_travado', pedido, `caso:${pedido.params.id}`)
      return negar(resposta, 423, MSG_TRAVADO)
    }
    // GGVP-103 CA5: só com tarefa aberta no caso que use o gov.br; a tarefa é o motivo que vai para o histórico (CA6).
    const [daTabela] = await banco
      .select({ passo: tarefa.passo, titulo: tarefa.titulo })
      .from(tarefa)
      .where(and(eq(tarefa.casoId, pedido.params.id), inArray(tarefa.passo, [...PASSOS_COM_GOVBR]), isNull(tarefa.concluidaEm)))
    // A perícia que voltou a marcar (remarcação, autorização da advogada) é tarefa calculada da perícia, sem linha em `tarefa`.
    const paraMarcar =
      !daTabela && (await banco.select({ documento: pericia.documento }).from(pericia).where(eq(pericia.casoId, pedido.params.id))).some((l) => l.documento && podeMarcar(l.documento as Pericia))
    const tarefaDoGov = daTabela ?? (paraMarcar ? { passo: 'DP.02', titulo: 'Marcar perícia' } : undefined)
    if (!tarefaDoGov) {
      await historico(quem.id, 'cofre_uso_recusado', pedido, `caso:${pedido.params.id}`)
      return negar(resposta, 403, MSG_COFRE_SEM_TAREFA)
    }
    if (!pedido.body?.senhaDoPortal || !(await bcrypt.compare(pedido.body.senhaDoPortal, quem.senhaHash))) {
      const depois = aposErro(conta?.tentativas ?? 0, agora())
      await banco.update(usuario).set(depois).where(eq(usuario.id, quem.id))
      await historico(quem.id, depois.travadoAte ? 'cofre_travado' : 'cofre_negado', pedido, `caso:${pedido.params.id}`)
      return depois.travadoAte ? negar(resposta, 423, MSG_TRAVADO) : negar(resposta, 403, 'A senha do portal não confere.')
    }
    if (conta?.tentativas) await banco.update(usuario).set({ tentativasErradas: 0 }).where(eq(usuario.id, quem.id))
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
