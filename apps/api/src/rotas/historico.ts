// Histórico de quem fez o quê (GGVP-99): a linha do processo, a recusa de quem tenta mexer no histórico, a exportação
// com a autorização da direção e o relatório de prazos. O banco também recusa alterar ou apagar `evento_auditoria`.
import { HistoricoDoCaso, PedirExportacao, PrazosDoEscritorio, pode, type Erro } from '@ggv/contratos'
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, preHandlerAsyncHookHandler } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { caso, decisao, eventoAuditoria, pessoa, tarefa, usuario } from '../banco/esquema.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'

export const MSG_HISTORICO_IMUTAVEL = 'O histórico não se altera nem se apaga. Uma correção entra como evento novo.'
export const MSG_EXPORTACAO_EM_CURSO = 'Já há um pedido de exportação deste histórico em curso.'
export const TITULO_AUTORIZAR = 'Autorizar exportação do histórico'

/** O que cada evento quer dizer, em palavras da equipe. O que não está aqui sai com o próprio nome, legível. */
const DESCRICAO: Record<string, string> = {
  acesso_negado: 'Tentou uma ação fora do perfil',
  portao_bloqueado: 'Tentou passar por um portão sem o que ele exige',
  conferencia_recusada: 'Aprovação para o INSS recusada pelo portão',
  protocolo_recusado_sem_ok: 'Protocolo no INSS recusado: sem o OK da Sênior (G2)',
  protocolo_bloqueado: 'Protocolo da manifestação recusado: versão não aprovada (G6)',
  pacote_divergente: 'Protocolo na Justiça recusado: o pacote mudou depois da aprovação (G7)',
  caso_aprovado_para_inss: 'Caso aprovado para o INSS',
  caso_reprovado_na_conferencia: 'Caso devolvido na conferência da Sênior',
  caso_liberado_ao_juridico: 'Caso liberado ao Jurídico, para a conferência da Sênior',
  liberacao_recusada: 'Liberação ao Jurídico recusada',
  tarefa_atribuida: 'Tarefa do setor atribuída pelo líder',
  protocolo_registrado: 'Protocolo no Meu INSS registrado',
  pericia_decidida: 'Decisão sobre a perícia',
  exigencia_inss_registrada: 'Exigência do INSS registrada',
  exigencia_inss_decidida: 'Exigência do INSS decidida pela advogada',
  cobranca_registrada: 'Cobrança ao cliente registrada',
  provas_entregues_ao_juridico: 'Provas da exigência entregues ao Jurídico',
  exigencia_inss_respondida: 'Exigência do INSS respondida no portal',
  caso_despachado: 'Caso despachado pela Sênior',
  laco_decidido: 'Decisão da Sênior no laço que passou do limite',
  peticao_pedida: 'Petição inicial pedida',
  peticao_aprovada: 'Petição aprovada pela advogada',
  peticao_protocolada: 'Petição protocolada no tribunal',
  manifestacao_versao_anexada: 'Versão da manifestação anexada',
  manifestacao_aprovada: 'Manifestação aprovada pela advogada',
  manifestacao_protocolada: 'Manifestação protocolada',
  dilacao_autorizada: 'Dilação autorizada pela Sênior',
  caso_encerrado: 'Caso encerrado',
  parecer_dispensado: 'Parecer médico dispensado: a segunda Sênior aprovou (G17)',
  dispensa_parecer_pedida: 'Dispensa do parecer médico pedida pela Sênior (G17)',
  chance_mostrada: 'Chance de êxito mostrada à Sênior (número do sistema, fatores sugeridos pela IA)',
  estudo_revisado: 'Estudo de caso revisado pela Sênior (novo processo ou não)',
  recomendacao_pericia_aprovada: 'Recomendação da perícia aprovada pela advogada (sugerida pela IA)',
  dispensa_parecer_negada: 'Dispensa do parecer médico recusada pela segunda Sênior (G17)',
  dispensa_parecer_recusada: 'Recusado: quem pediu a dispensa do parecer tentou aprová-la (G17)',
  cofre_senha_lida: 'Senha do gov.br revelada pelo cofre',
  cofre_senha_cadastrada: 'Senha do gov.br cadastrada no cofre',
  cofre_senha_trocada: 'Senha do gov.br trocada no cofre',
  cofre_negado: 'Cofre do gov.br: a senha do portal não conferiu',
  cofre_uso_recusado: 'Cofre do gov.br: uso recusado, sem tarefa que use o gov.br',
  cofre_uso_fora_do_padrao: 'Cofre do gov.br: uso fora do padrão',
  ficha_criada: 'Ficha criada no balcão',
  ficha_alterada: 'Ficha do cliente alterada',
  ficha_atendimento_salva: 'Ficha de atendimento salva',
  conversa_aberta: 'Conversa com o cliente aberta',
  conversa_gravada: 'Gravação da conversa começou, depois do aviso (G10)',
  conversa_transcrita: 'Transcrição da conversa pronta',
  conversa_conferida: 'Conversa conferida: o que mudou foi para a ficha e o processo',
  versao_voltada: 'Campo voltou para uma versão anterior (Sênior)',
  pendencia_cumprida: 'Pendência cumprida',
  pendencia_novo_prazo: 'Prazo novo para a pendência da conversa (Sênior)',
  mensagem_enviada: 'Mensagem ao cliente enviada pelo Chatwoot',
  dados_bancarios_pedidos: 'Mudança dos dados bancários pedida',
  dados_bancarios_confirmados: 'Mudança dos dados bancários confirmada por outra pessoa',
  historico_alteracao_recusada: 'Tentou alterar ou apagar o histórico',
  exportacao_pedida: 'Exportação do histórico pedida',
  exportacao_autorizada: 'Exportação do histórico autorizada pela direção',
  historico_exportado: 'Histórico exportado',
  // A documentação médica no servidor (GGVP-132): só o que aconteceu, nunca o conteúdo clínico.
  roteiro_versao_salva: 'Versão nova do roteiro de laudos salva pela Sênior',
  parecer_registrado: 'Parecer médico registrado pelo Jurídico (G17)',
  complemento_tentativa_registrada: 'Tentativa de pedir o complemento ao médico registrada',
  complemento_decidido: 'Complemento ao médico no limite: a Sênior decidiu nova tentativa (G15)',
  deficiencia_registrada: 'Dados da deficiência registrados na linha do tempo',
  acidente_registrado: 'Circunstância do acidente marcada',
  crianca_registrada: 'Condição e terapias da criança marcadas (roteiro infantil)',
  // GGVP-135 (P19 do roteiro de 09/10): os eventos que saíam com o nome técnico, sem acento.
  tentativa_exigencia_juiz: 'Tentativa de cumprir a exigência do juiz',
  exigencia_juiz_nao_vai_conseguir: 'O setor avisou que não vai conseguir cumprir a exigência do juiz',
  exigencia_juiz_item_cumprido: 'Item da exigência do juiz cumprido',
  exigencia_juiz_sem_prova: 'Exigência do juiz: ficou sem a prova, com o motivo',
  tentativa_pendencia: 'Tentativa de cumprir a pendência do despacho',
  pendencia_nao_vai_conseguir: 'O setor avisou que não vai conseguir cumprir a pendência do despacho',
  dilacao_protocolada: 'Pedido de dilação de prazo protocolado',
  item_exigencia_atualizado: 'Item da exigência do INSS atualizado',
  pacote_nao_gerado: 'Pacote do protocolo não gerado: sai de novo na tela do protocolo',
  peticao_versao_nova: 'Petição: versão nova',
  peticao_versao_apos_aprovacao: 'Petição: versão nova depois da aprovação',
  peticao_citado_resolvido: 'Petição: documento citado ligado ao caso',
  peticao_citado_pedido_a_documentacao: 'Petição: documento citado pedido à Documentação',
  publicacao_classificada: 'Publicação classificada',
  publicacao_reclassificada: 'Publicação reclassificada',
  publicacao_vinculada: 'Publicação vinculada ao processo',
  publicacao_fora_do_escritorio: 'Publicação marcada como de outro escritório',
  vigilia_reprocessada: 'Vigília reprocessada',
  exigencia_perdida: 'Exigência do INSS perdida',
  exigencia_dilacao_pedida: 'Exigência do INSS: dilação de prazo pedida',
  exigencia_juiz_perdida: 'Exigência do juiz perdida',
  exigencia_juiz_dilacao_pedida: 'Exigência do juiz: dilação de prazo pedida',
  exigencia_juiz_ciencia: 'Exigência do juiz: só ciência, sem nada a cumprir',
  exigencia_juiz_distribuida: 'Exigência do juiz distribuída aos setores',
  // A Perícia no servidor (GGVP-137).
  pericia_liberada: 'O INSS liberou o agendamento da perícia',
  pericia_tentativa_registrada: 'Tentativa sem sucesso de marcar a perícia',
  pericia_marcada: 'Perícia marcada, com o comprovante do INSS',
  pericia_espera_comprovante: 'Perícia marcada no Meu INSS, esperando o comprovante',
  pericia_remarcada: 'Perícia remarcada',
  pericia_remarcacao_autorizada: 'Mais uma remarcação autorizada pela advogada (G15)',
  pericia_lembrete_enviado: 'Lembrete da véspera da perícia enviado',
  pericia_falta_registrada: 'Falta de documento da perícia justificada',
  pericia_documentos_concluidos: 'Documentos da perícia concluídos',
  pericia_pedido_ao_medico: 'Pedido ao médico do laudo da perícia preparado',
  pericia_pedido_ao_medico_recusado: 'Pedido ao médico recusado pelo portão (G20)',
  pericia_cobranca_enviada: 'Cobrança dos documentos da perícia enviada',
  pericia_cobranca_adiada: 'Cobrança dos documentos da perícia adiada',
  pericia_falta_decidida: 'Decisão da advogada sobre o documento que falta (G15)',
  pericia_perito_ligado: 'Perito ligado à perícia',
  pericia_orientacao_enviada: 'Orientação da perícia passada ao cliente',
  pericia_orientacao_recusada: 'Orientação da perícia recusada pela verificação (G11, G20)',
  pericia_presenca_registrada: 'Confirmação de presença na perícia',
  pericia_comparecimento_registrado: 'Comparecimento na perícia registrado',
  pericia_resultado_disponivel: 'Resultado da perícia disponível',
  pericia_resultado_registrado: 'Resultado da perícia registrado pela advogada',
  pericia_perfil_atualizado: 'Perfil do perito atualizado com o laudo',
  pericia_perito_do_laudo: 'Laudo da perícia ligado ao perito',
  importacao_gravada: 'Planilha do escritório importada (clientes e processos)',
}
const DECISAO: Record<string, string> = {
  aprovacao_inss: 'OK da Sênior para o INSS',
  despacho: 'Despacho da Sênior',
  laco_escalado: 'Decisão da Sênior no laço que passou do limite',
  aprovacao_peticao: 'Aprovação da petição pela advogada (G6)',
  trava_g7: 'Travas do protocolo conferidas (G7)',
  pericia: 'Decisão sobre a perícia',
  protocolo_inss: 'Protocolo no Meu INSS',
  dispensa_parecer: 'Dispensa do parecer médico (duas Sêniores)',
}
const legivel = (nome: string) => nome.replaceAll('_', ' ').replace(/^./, (l) => l.toUpperCase())
const UUID = /^[0-9a-f-]{36}$/
const ESTADOS_DA_EXPORTACAO = ['exportacao_pedida', 'exportacao_autorizada', 'historico_exportado'] as const

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasHistorico(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  const eventosDoCaso = (casoId: string) =>
    banco
      .select()
      .from(eventoAuditoria)
      .where(or(eq(eventoAuditoria.alvo, `caso:${casoId}`), sql`${eventoAuditoria.detalhe}->>'casoId' = ${casoId}`))
      .orderBy(asc(eventoAuditoria.quando))

  /**
   * CA12: o pedido de exportação em curso sai dos próprios eventos, contados (cada ciclo é pedida, autorizada,
   * exportada): mais pedidos que autorizações, está pedida; mais autorizações que exportações, está autorizada.
   */
  async function exportacaoDo(casoId: string) {
    const eventos = await banco
      .select()
      .from(eventoAuditoria)
      .where(and(eq(eventoAuditoria.alvo, `caso:${casoId}`), inArray(eventoAuditoria.acao, [...ESTADOS_DA_EXPORTACAO])))
      .orderBy(asc(eventoAuditoria.quando))
    const quantos = (acao: string) => eventos.filter((e) => e.acao === acao).length
    const [pedidos, autorizadas, exportadas] = ESTADOS_DA_EXPORTACAO.map(quantos)
    const pedido = eventos.filter((e) => e.acao === 'exportacao_pedida').at(-1)
    if (!pedido || pedidos === exportadas) return null
    return { situacao: pedidos > autorizadas ? ('pedida' as const) : ('autorizada' as const), pedido }
  }

  // A direção (o Sócio) não vê o caso: entra só para ver o pedido de exportação e autorizar (CA12).
  const verCaso = exigir(banco, 'caso.ver', agora)
  const verOuAutorizar: preHandlerAsyncHookHandler = async function (pedido, resposta) {
    if (!pode(pedido.perfilAtivo, 'historico.autorizar_exportacao')) return verCaso.call(this, pedido, resposta)
  }

  // CA3, CA7, CA11: a linha do processo, dos eventos e das decisões, em ordem; sem o detalhe interno nem dado de saúde.
  app.get<{ Params: { id: string } }>('/api/casos/:id/historico', { preHandler: verOuAutorizar }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const [c] = await banco.select({ cliente: pessoa.nome }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    const eventos = await eventosDoCaso(casoId)
    const decisoes = await banco.select().from(decisao).where(eq(decisao.casoId, casoId)).orderBy(asc(decisao.decididoEm))
    const ids = [...new Set([...eventos.map((e) => e.quem), ...decisoes.map((d) => d.decididoPor)].filter((q) => UUID.test(q)))]
    const nomes = new Map((ids.length ? await banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, ids)) : []).map((u) => [u.id, u.nome]))
    const linha = [
      ...eventos.map((e) => ({
        quando: e.quando,
        quem: UUID.test(e.quem) ? (nomes.get(e.quem) ?? 'Pessoa removida') : e.quem === 'sistema' ? 'Sistema' : 'Sem sessão',
        origem: e.quem === 'sistema' ? ('sistema' as const) : ('pessoa' as const),
        passo: ((e.detalhe as { passo?: string }).passo ?? null) as string | null,
        descricao: DESCRICAO[e.acao] ?? legivel(e.acao),
      })),
      ...decisoes.map((d) => ({
        quando: d.decididoEm,
        quem: nomes.get(d.decididoPor) ?? 'Pessoa removida',
        origem: 'pessoa' as const,
        passo: d.passo,
        descricao: `${DECISAO[d.tipo] ?? legivel(d.tipo)}: ${legivel(d.resultado).toLowerCase()}`,
      })),
    ].sort((a, b) => a.quando.getTime() - b.quando.getTime())
    const exportacao = await exportacaoDo(casoId)
    return HistoricoDoCaso.parse({
      casoId,
      cliente: c.cliente,
      eventos: pode(pedido.perfilAtivo, 'caso.ver') ? linha.map((l) => ({ ...l, quando: l.quando.toISOString() })) : [],
      exportacao: exportacao && {
        situacao: exportacao.situacao,
        pedidaPor: nomes.get(exportacao.pedido.quem) ?? (await nomeDe(exportacao.pedido.quem)),
        motivo: String((exportacao.pedido.detalhe as { motivo?: string }).motivo ?? ''),
        pedidaEm: exportacao.pedido.quando.toISOString(),
      },
      podePedirExportacao: pode(pedido.perfilAtivo, 'gestao.ver') && !exportacao,
      podeAutorizarExportacao: pode(pedido.perfilAtivo, 'historico.autorizar_exportacao') && exportacao?.situacao === 'pedida',
      podeExportar: exportacao?.situacao === 'autorizada' && exportacao.pedido.quem === pedido.usuario?.id,
    })
  })

  async function nomeDe(id: string) {
    if (!UUID.test(id)) return 'Sem sessão'
    const [u] = await banco.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, id))
    return u?.nome ?? 'Pessoa removida'
  }

  // CA9: ninguém edita nem apaga o histórico, pela tela ou pela API; a tentativa fica registrada (o banco também recusa).
  for (const url of ['/api/casos/:id/historico', '/api/casos/:id/historico/:evento'])
    app.route<{ Params: { id: string } }>({
      method: ['PUT', 'PATCH', 'DELETE'],
      url,
      handler: async (pedido, resposta) => {
        await historico(pedido.usuario?.id ?? 'anonimo', 'historico_alteracao_recusada', pedido, `caso:${pedido.params.id}`, { metodo: pedido.method })
        return negar(resposta, 403, MSG_HISTORICO_IMUTAVEL)
      },
    })

  // CA12 (Lucas, 01/10): a gestão pede a exportação com o motivo; a direção (o Sócio) recebe a tarefa de autorizar.
  app.post<{ Params: { id: string } }>('/api/casos/:id/historico/exportacao', { preHandler: exigir(banco, 'gestao.ver', agora) }, async (pedido, resposta) => {
    const entrada = PedirExportacao.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o pedido.')
    const casoId = pedido.params.id
    const [c] = await banco.select({ id: caso.id }).from(caso).where(eq(caso.id, casoId))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    if (await exportacaoDo(casoId)) return negar(resposta, 409, MSG_EXPORTACAO_EM_CURSO)
    await historico(pedido.usuario!.id, 'exportacao_pedida', pedido, `caso:${casoId}`, { motivo: entrada.data.motivo })
    await banco.insert(tarefa).values({ casoId, passo: 'historico', titulo: TITULO_AUTORIZAR, perfilDono: 'socio', criadoEm: agora() })
    return resposta.code(201).send({ ok: true })
  })

  app.post<{ Params: { id: string } }>(
    '/api/casos/:id/historico/exportacao/autorizacao',
    { preHandler: exigir(banco, 'historico.autorizar_exportacao', agora) },
    async (pedido, resposta) => {
      const casoId = pedido.params.id
      if ((await exportacaoDo(casoId))?.situacao !== 'pedida') return negar(resposta, 409, 'Não há pedido de exportação esperando a autorização.')
      const quem = pedido.usuario!.id
      await historico(quem, 'exportacao_autorizada', pedido, `caso:${casoId}`)
      await banco
        .update(tarefa)
        .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem })
        .where(and(eq(tarefa.casoId, casoId), eq(tarefa.titulo, TITULO_AUTORIZAR), isNull(tarefa.concluidaEm)))
      return resposta.code(201).send({ ok: true })
    },
  )

  // CA12: autorizada, quem pediu baixa a trilha completa (uma vez); a exportação fica no histórico.
  app.get<{ Params: { id: string } }>('/api/casos/:id/historico/exportacao', { preHandler: exigir(banco, 'gestao.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const e = await exportacaoDo(casoId)
    if (e?.situacao !== 'autorizada' || e.pedido.quem !== pedido.usuario?.id) return negar(resposta, 403, 'A exportação precisa da autorização da direção, e só quem pediu exporta.')
    const trilha = {
      casoId,
      exportadoEm: agora().toISOString(),
      eventos: (await eventosDoCaso(casoId)).map((x) => ({ quando: x.quando.toISOString(), quem: x.quem, acao: x.acao, detalhe: x.detalhe })),
      decisoes: (await banco.select().from(decisao).where(eq(decisao.casoId, casoId)).orderBy(asc(decisao.decididoEm))).map((d) => ({
        quando: d.decididoEm.toISOString(),
        quem: d.decididoPor,
        passo: d.passo,
        tipo: d.tipo,
        resultado: d.resultado,
        justificativa: d.justificativa,
      })),
    }
    await historico(pedido.usuario!.id, 'historico_exportado', pedido, `caso:${casoId}`)
    resposta.header('content-disposition', `attachment; filename="historico-${casoId}.json"`).header('cache-control', 'no-store')
    return trilha
  })

  // CA14: prazos cumpridos e perdidos, tirados do histórico, para a gestão.
  const CUMPRIDOS: Record<string, string> = { exigencia_inss_respondida: 'Exigência do INSS respondida', manifestacao_protocolada: 'Exigência do juiz cumprida (manifestação protocolada)' }
  const PERDIDOS: Record<string, string> = { exigencia_perdida: 'Exigência do INSS perdida', exigencia_juiz_perdida: 'Exigência do juiz perdida' }
  app.get('/api/gestao/prazos', { preHandler: exigir(banco, 'gestao.ver', agora) }, async () => {
    // ponytail: os 200 mais recentes; filtro por período quando a gestão pedir.
    const eventos = await banco
      .select()
      .from(eventoAuditoria)
      .where(inArray(eventoAuditoria.acao, [...Object.keys(CUMPRIDOS), ...Object.keys(PERDIDOS)]))
      .orderBy(desc(eventoAuditoria.quando))
      .limit(200)
    const casoDe = (alvo: string) => (alvo.startsWith('caso:') && UUID.test(alvo.slice(5)) ? alvo.slice(5) : null)
    const casoIds = [...new Set(eventos.map((e) => casoDe(e.alvo)).filter((c): c is string => c !== null))]
    const clientes = new Map(
      (casoIds.length ? await banco.select({ id: caso.id, nome: pessoa.nome }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(inArray(caso.id, casoIds)) : []).map(
        (c) => [c.id, c.nome],
      ),
    )
    const itens = eventos.map((e) => {
      const casoId = casoDe(e.alvo)
      return {
        quando: e.quando.toISOString(),
        casoId,
        cliente: casoId ? (clientes.get(casoId) ?? null) : null,
        situacao: e.acao in CUMPRIDOS ? ('cumprido' as const) : ('perdido' as const),
        descricao: CUMPRIDOS[e.acao] ?? PERDIDOS[e.acao],
      }
    })
    return PrazosDoEscritorio.parse({ cumpridos: itens.filter((i) => i.situacao === 'cumprido').length, perdidos: itens.filter((i) => i.situacao === 'perdido').length, itens })
  })
}
