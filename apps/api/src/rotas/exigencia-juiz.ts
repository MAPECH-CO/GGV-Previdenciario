// Exigência do juiz (GGVP-79, 83, 87): a advogada analisa e distribui aos setores (G5); cada setor cumpre com
// tentativas limitadas e prova (G15, G21); com tudo provado, a advogada manifesta. Reaproveita `exigencia` com a
// origem `juizo`, os itens, a cobrança e a perícia da exigência do INSS.
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { AnaliseDaExigenciaPelaIa, AnalisarExigenciaJuiz, DecidirLaco, ROTULO_BENEFICIO, SugestaoDaExigencia, type Beneficio, type FonteDaIa, DecidirVencida, ExigenciaDoJuiz, ItensDoSetor, NaoVouConseguir, ROTULO_SETOR, RegistrarTentativa, SubirInformacao, pode, type Erro } from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { caso, decisao, documento, etapa, exigencia, exigenciaItem, pericia, pessoa, peticao, peticaoVersao, prazo, protocoloJudicial, publicacao, tarefa, tentativa, usuario } from '../banco/esquema.ts'
import { ORIGEM_JUIZ, abrirPericiasDaExigencia, lacosDas, lembreteDescrito, lembreteDoLaco, limitesDeCobranca } from '../fluxo/exigencia.ts'
import { MSG_SEM_REFERENCIA, buscarNoAcervo } from '../ia/acervo.ts'
import { FINALIDADES, lerJson, type ComoSugerir, type Ia } from '../ia/ia.ts'
import { casosComTarefaAberta, type Preparo } from '../ia/preparo.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { TIPOS_DE_ANEXO, guardarArquivo, lerFormulario } from './formulario.ts'
import { abrirManifestacaoSePronta, situacaoDaExigenciaJuiz } from './manifestacao.ts'
import { dataDoJuizoNaPublicacao } from '../../../web/src/regras/pericia.ts'

export const MSG_NADA_A_ANALISAR = 'Não há exigência do juiz esperando a análise neste caso.'
export const MSG_IA_SEM_SUGESTAO = 'A IA não respondeu agora: analise pela sua leitura.'
export const MSG_EVIDENCIA = 'Anexe o documento do item (PDF ou imagem, até 25 MB).'
export const MSG_ITEM_DE_OUTRO_SETOR = 'Este item é de outro setor.'
export const MSG_INFORMACAO = 'Escreva a informação que conseguiu com o cliente ou anexe um documento (PDF ou imagem, até 25 MB).'

/**
 * O laço do setor serve duas origens (decisão 32): a exigência do juiz e o que a Sênior mandou buscar no despacho
 * (GGVP-58), cada uma no seu endereço e com a sua permissão. No despacho não há prazo processual.
 */
const LACOS = [
  { base: 'exigencia-juiz', origem: 'juizo', acao: 'exigencia_juiz.cumprir', decidir: 'exigencia_juiz.autorizar_dilacao', passo: 'D3a.03' },
  { base: 'pendencias', origem: 'despacho', acao: 'pendencia.cumprir', decidir: 'caso.despachar_indeferimento', passo: 'D3.04' },
] as const
type Origem = (typeof LACOS)[number]['origem']
const ESCALADA = {
  juizo: { passo: 'D3a.03s', titulo: 'Exigência do juiz sem retorno' },
  despacho: { passo: 'D3.04s', titulo: 'Pendência sem retorno' },
} as const
const HISTORICO = {
  juizo: { tentativa: 'tentativa_exigencia_juiz', naoVai: 'exigencia_juiz_nao_vai_conseguir', cumprido: 'exigencia_juiz_item_cumprido', prova: 'prova_exigencia_juiz' },
  despacho: { tentativa: 'tentativa_pendencia', naoVai: 'pendencia_nao_vai_conseguir', cumprido: 'pendencia_cumprida', prova: 'prova_pendencia' },
} as const

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date; ia: Ia; preparo: Preparo }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const hoje = (agora: Date) => new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)
const br = (iso: string) => iso.split('-').reverse().join('/')
const SITUACAO = { aberta: 'em_cumprimento', cumprida: 'cumprida', vencida: 'vencida', dilacao_pedida: 'dilacao_pedida' } as const

export function registrarRotasExigenciaJuiz(app: FastifyInstance, { banco, armazenamento, agora = () => new Date(), ia, preparo }: Opcoes) {
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
    const emCurso = e.exigencia ? await situacaoDaExigenciaJuiz(banco, casoId) : null
    // GGVP-68 CA14 e GGVP-94 CA8: o laço de cada item; CA5: a manifestação protocolada depois da exigência é a peça que cumpriu.
    const lacos = await lacosDas(banco, itens.flatMap((i) => (i.tarefa ? [i.tarefa.id] : [])))
    const decide = pode(pedido.perfilAtivo, 'exigencia_juiz.autorizar_dilacao')
    const [peca] = e.exigencia
      ? await banco
          .select({ versao: peticaoVersao.numero, protocoladaEm: protocoloJudicial.protocoladoEm })
          .from(protocoloJudicial)
          .innerJoin(peticaoVersao, eq(protocoloJudicial.peticaoVersaoId, peticaoVersao.id))
          .innerJoin(peticao, eq(peticaoVersao.peticaoId, peticao.id))
          .where(and(eq(peticao.casoId, casoId), eq(peticao.tipo, 'manifestacao'), gte(peticao.criadoEm, e.exigencia.criadoEm)))
          .orderBy(desc(protocoloJudicial.protocoladoEm))
          .limit(1)
      : []
    const faltam = emCurso?.faltam ?? [
      ...new Set(itens.filter((i) => i.item.situacao === 'pendente').map((i) => ROTULO_SETOR[i.item.perfilResponsavel as keyof typeof ROTULO_SETOR] ?? i.item.perfilResponsavel)),
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
        motivo: i.item.motivo,
        prova: i.prova,
        tentativas: i.tarefa?.tentativas ?? 0,
        limite: i.tarefa?.limiteTentativas ?? null,
        escalada: Boolean(i.tarefa?.escaladaEm),
        acionadoEm: i.tarefa?.criadoEm.toISOString() ?? null,
        historicoDoLaco: (i.tarefa && lacos.get(i.tarefa.id)) || [],
        podeDecidir: decide && Boolean(i.tarefa?.escaladaEm) && !i.tarefa?.concluidaEm,
      })),
      peca: peca ? { versao: peca.versao, protocoladaEm: peca.protocoladaEm.toISOString() } : null,
      // Perícia encerrada pela advogada sem resultado aparece como tal, não como "aguardando".
      pericias: pericias.map((p) =>
        p.resultado === null && emCurso && !emCurso.periciasPendentes.some((x) => x.tipo === p.tipo) ? { ...p, resultado: 'encerrada sem resultado' } : p,
      ),
      faltam,
      podeDistribuir: pode(pedido.perfilAtivo, 'exigencia_juiz.distribuir') && situacao === 'a_analisar',
      vencida,
      podeDecidirVencida: pode(pedido.perfilAtivo, 'exigencia_inss.decidir_vencida') && vencida,
    })
  })

  // Épico IA (GGVP-79 CA3, G5): a IA lê a publicação com o caso e o acervo e sugere "só ciência" ou os itens por setor.
  // Não grava nada: a sugestão só preenche o formulário, e quem decide é a advogada. Sugestão pronta (07/10): a mesma
  // função serve à rota e ao preparo em segundo plano.
  app.post<{ Params: { id: string } }>('/api/casos/:id/exigencia-juiz/sugestao', { preHandler: exigir(banco, 'exigencia_juiz.distribuir', agora) }, async (pedido, resposta) => {
    return (await sugerirTarefas(pedido.params.id, pedido.usuario!.id)) ?? negar(resposta, 409, MSG_NADA_A_ANALISAR)
  })
  preparo.registrar(
    () => casosComTarefaAberta(banco, 'D3a.02'),
    (casoId) => sugerirTarefas(casoId, null, { soPreparar: true }),
  )

  async function sugerirTarefas(casoId: string, quem: string | null, como: ComoSugerir = {}) {
    const e = await exigenciaDoCaso(casoId)
    if (!e?.tarefaAnalise) return null
    const [c] = await banco.select({ beneficio: caso.beneficio }).from(caso).where(eq(caso.id, casoId))
    const docs = await banco
      .select({ nome: documento.nomeOriginal, tipo: documento.tipo })
      .from(documento)
      .where(and(eq(documento.casoId, casoId), isNull(documento.excluidoEm)))
      .orderBy(asc(documento.criadoEm))
    const acervo = await buscarNoAcervo(banco, { casoId, beneficio: c?.beneficio ?? null, consulta: e.publicacao.texto, saude: FINALIDADES.analisar_exigencia_juiz.saude, ia })
    const conteudo = [
      `Benefício: ${c?.beneficio ? (ROTULO_BENEFICIO[c.beneficio as Beneficio] ?? c.beneficio) : 'não definido'}`,
      `Prazo do processo contado pelo sistema: até ${e.prazo.fim}`,
      `Publicação de ${e.publicacao.disponibilizadaEm}:`,
      e.publicacao.texto,
      `Documentos do caso: ${docs.length ? docs.map((d) => `${d.nome} (${d.tipo})`).join('; ') : 'nenhum'}`,
      ...(acervo.length ? ['Trechos do acervo da casa (outros casos):', ...acervo.map((a) => `- ${a.trecho}`)] : []),
    ].join('\n')
    const fontes: FonteDaIa[] = [{ tipo: 'publicacao', referencia: `publicacao:${e.publicacao.id}` }, ...acervo]
    const aviso = acervo.length ? null : MSG_SEM_REFERENCIA
    const validar = (texto: string) => AnaliseDaExigenciaPelaIa.safeParse(lerJson(texto)).success
    const s = await ia.sugerir('analisar_exigencia_juiz', { casoId, quem, conteudo, fontes }, { ...como, validar })
    if (!s) return SugestaoDaExigencia.parse({ sugestao: null, leitura: null, motivo: MSG_IA_SEM_SUGESTAO, aviso })
    const leitura = AnaliseDaExigenciaPelaIa.parse(lerJson(s.texto))
    return SugestaoDaExigencia.parse({ sugestao: { ...s, texto: leitura.resumo }, leitura, motivo: null, aviso })
  }

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
    const { limite } = await limitesDeCobranca(banco)
    await banco.transaction(async (tx) => {
      // G5: a decisão fica com quem decidiu e quando (a publicação vai na justificativa, para achar a ciência depois).
      await tx.insert(decisao).values({
        casoId,
        passo: 'D3a.02',
        tipo: 'exigencia_juiz',
        resultado: d.decisao,
        justificativa: e.publicacao.id,
        // Épico IA (CA3): a decisão que partiu da sugestão guarda a chamada; a saída da IA fica em `chamada_ia`.
        sugestaoIa: d.chamadaIaId ? { chamadaId: d.chamadaIaId } : null,
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
        const lembrete = await lembreteDoLaco(tx, hoje(agora()), i.prazoInterno, limite ?? 1)
        const [t] = await tx
          .insert(tarefa)
          .values({
            casoId,
            passo: 'D3a.03',
            titulo: 'Cumprir exigência do juiz',
            perfilDono: i.setor,
            prazo: lembrete,
            prazoProcessualId: e.prazo.id,
            limiteTentativas: limite,
            criadoEm: agora(),
          })
          .returning()
        await tx
          .insert(exigenciaItem)
          .values({ exigenciaId: x.id, descricao: i.descricao, perfilResponsavel: i.setor, prazo: i.prazoInterno, provaEsperada: i.provaEsperada, tarefaId: t.id })
      }
      // CA8: a perícia pedida pelo juiz abre sozinha a tarefa do Jurídico administrativo, com a origem D3a.
      if (d.tiposPericia.length) {
        const marcar = await abrirPericiasDaExigencia(tx, casoId, d.tiposPericia, quem, agora(), ORIGEM_JUIZ)
        // GGVP-137: com a data de cada perícia pedida na publicação, o sistema já as pôs na agenda (DP.04): não há o que
        // marcar, e a tarefa de marcar desta exigência fecha pelo sistema. Faltando a data de uma, fica aberta: o Jurídico
        // administrativo registra a data do juízo na tela de marcar.
        if (d.tiposPericia.every((t) => dataDoJuizoNaPublicacao(e.publicacao.texto, t)))
          await tx.update(tarefa).set({ situacao: 'concluida', concluidaEm: agora() }).where(eq(tarefa.id, marcar))
      }
      if (temItens) await tx.insert(etapa).values({ casoId, diagrama: 'D3a', passo: 'D3a.E2', situacao: 'aguardando_externo', aguardando: 'cliente responder ou entregar', iniciadaEm: agora() })
      // GGVP-87 (ajuste do Mateus, 06/10): a advogada acompanha desde já, com o prazo do processo; o protocolo só libera
      // com todos os itens provados, por documento ou pela justificativa dela (G21).
      await tx.insert(tarefa).values({ casoId, passo: 'D3a.04', titulo: 'Manifestar no processo', perfilDono: 'advogada', prazo: fim, criadoEm: agora() })
    })
    await historico(quem, d.decisao === 'ciencia' ? 'exigencia_juiz_ciencia' : 'exigencia_juiz_distribuida', pedido, `caso:${casoId}`, {
      publicacao: e.publicacao.id,
      itens: d.decisao === 'cumprir' ? d.itens.length : 0,
    })
    return resposta.code(201).send({ ok: true })
  })

  /** O setor do perfil ativo: o líder do Atendimento cumpre o que é do Atendimento. */
  const setorDo = (perfil: string | null | undefined) => (perfil === 'atendimento_lider' ? 'atendimento' : (perfil ?? ''))

  /** O item, da exigência do caso na origem do laço, e a tarefa do setor que o cumpre. */
  async function itemDoCaso(casoId: string, itemId: string, origem: Origem) {
    const [l] = await banco
      .select({ item: exigenciaItem, exigencia, tarefa })
      .from(exigenciaItem)
      .innerJoin(exigencia, eq(exigenciaItem.exigenciaId, exigencia.id))
      .leftJoin(tarefa, eq(exigenciaItem.tarefaId, tarefa.id))
      .where(and(eq(exigenciaItem.id, itemId), eq(exigencia.casoId, casoId), eq(exigencia.origem, origem)))
    return l ?? null
  }

  async function subirParaSenior(casoId: string, tarefaId: string, motivo: string, origem: Origem) {
    await banco.update(tarefa).set({ escaladaEm: agora(), escaladaPara: 'senior' }).where(eq(tarefa.id, tarefaId))
    await banco.insert(tarefa).values({ casoId, passo: ESCALADA[origem].passo, titulo: `${ESCALADA[origem].titulo}: ${motivo}`, perfilDono: 'senior' })
  }

  /** GGVP-58 CA3, CA8: com todos os itens do despacho provados, a espera do cliente (D3.E1) fecha. A perícia segue à parte. */
  async function fecharEsperaDoDespacho(casoId: string) {
    const [x] = await banco
      .select()
      .from(exigencia)
      .where(and(eq(exigencia.casoId, casoId), eq(exigencia.origem, 'despacho')))
      .orderBy(desc(exigencia.criadoEm))
      .limit(1)
    if (!x) return
    const pendentes = await banco
      .select({ id: exigenciaItem.id })
      .from(exigenciaItem)
      .where(and(eq(exigenciaItem.exigenciaId, x.id), eq(exigenciaItem.situacao, 'pendente')))
    if (pendentes.length) return
    await banco.update(exigencia).set({ situacao: 'cumprida' }).where(eq(exigencia.id, x.id))
    await banco
      .update(etapa)
      .set({ situacao: 'concluida', concluidaEm: agora() })
      .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D3.E1'), isNull(etapa.concluidaEm)))
  }

  /** Confere que o item é do setor de quem pede e ainda está aberto. */
  async function itemDoSetor(casoId: string, itemId: string, perfil: string | null | undefined, origem: Origem, resposta: FastifyReply) {
    const l = await itemDoCaso(casoId, itemId, origem)
    if (!l || !l.tarefa) return void negar(resposta, 404, 'Item não encontrado.')
    if (l.item.perfilResponsavel !== setorDo(perfil)) return void negar(resposta, 403, MSG_ITEM_DE_OUTRO_SETOR)
    if (l.item.situacao === 'cumprido') return void negar(resposta, 409, 'Este item já foi cumprido.')
    if (l.item.situacao === 'nao_cumprido') return void negar(resposta, 409, 'Este item foi encerrado pela advogada, sem a prova.')
    return l as typeof l & { tarefa: NonNullable<typeof l.tarefa> }
  }

  for (const { base, origem, acao, decidir, passo } of LACOS) {
    // GGVP-83 CA4, CA13 e GGVP-58 CA5, CA13: os itens do setor, com o pedido, quem pediu, o prazo de entrega, o
    // processual (só na exigência do juiz) e as tentativas.
    app.get<{ Params: { id: string } }>(`/api/casos/:id/${base}/setor`, { preHandler: exigir(banco, acao, agora) }, async (pedido, resposta) => {
      const casoId = pedido.params.id
      const setor = setorDo(pedido.perfilAtivo)
      const [c] = await banco.select({ nome: pessoa.nome }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
      const [x] = await banco
        .select()
        .from(exigencia)
        .where(and(eq(exigencia.casoId, casoId), eq(exigencia.origem, origem)))
        .orderBy(desc(exigencia.criadoEm))
        .limit(1)
      if (!c || !x) return negar(resposta, 404, origem === 'juizo' ? 'Não há exigência do juiz para o seu setor neste caso.' : 'Não há pendência do despacho para o seu setor neste caso.')
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
          motivo: l.item.motivo,
          prova: l.prova,
          informacao: l.item.informacao,
          proximoLembrete: l.tarefa && !l.tarefa.concluidaEm ? l.tarefa.prazo : null,
          lembrete: lembreteDescrito(l.tarefa, ROTULO_SETOR[setor as keyof typeof ROTULO_SETOR] ?? setor, l.tarefa?.tentativas ?? 0),
          limite: l.tarefa?.limiteTentativas ?? null,
          escalada: Boolean(l.tarefa?.escaladaEm),
          tentativas: tentativas.map((t) => ({ quando: t.quando.toISOString(), canal: t.canal ?? '', resultado: t.resultado, quem: t.quem })),
        })
      }
      return ItensDoSetor.parse({ origem, casoId, cliente: c.nome, setor, pedidoPor: quem?.nome ?? null, prazoProcessual: x.prazo, itens })
    })

    // GGVP-83 CA5, CA7, CA8 e GGVP-58 CA4, CA6, CA9 (G15): a tentativa conta no limite; no limite, sobe para a Sênior e
    // continua com o setor.
    app.post<{ Params: { id: string; item: string } }>(`/api/casos/:id/${base}/itens/:item/tentativas`, { preHandler: exigir(banco, acao, agora) }, async (pedido, resposta) => {
      const entrada = RegistrarTentativa.safeParse(pedido.body)
      if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
      const l = await itemDoSetor(pedido.params.id, pedido.params.item, pedido.perfilAtivo, origem, resposta)
      if (!l) return resposta
      const quem = pedido.usuario!.id
      const numero = l.tarefa.tentativas + 1
      const restantes = Math.max(1, (l.tarefa.limiteTentativas ?? numero + 1) - numero)
      const lembrete = (await lembreteDoLaco(banco, hoje(agora()), l.item.prazo, restantes)) ?? l.tarefa.prazo
      const escala = l.tarefa.limiteTentativas !== null && numero >= l.tarefa.limiteTentativas && !l.tarefa.escaladaEm
      await banco.insert(tentativa).values({ tarefaId: l.tarefa.id, quando: agora(), canal: entrada.data.canal, resultado: entrada.data.resultado, registradaPor: quem })
      await banco
        .update(tarefa)
        .set({ tentativas: numero, prazo: lembrete })
        .where(eq(tarefa.id, l.tarefa.id))
      if (escala) await subirParaSenior(pedido.params.id, l.tarefa.id, `${l.item.descricao} (limite de tentativas)`, origem)
      await historico(quem, HISTORICO[origem].tentativa, pedido, `caso:${pedido.params.id}`, { item: l.item.id, numero, escalada: escala })
      return resposta.code(201).send({ ok: true, tentativas: numero, escalada: escala })
    })

    // GGVP-83 CA14: o setor que sabe que não vai conseguir sobe antes do limite, com o motivo.
    app.post<{ Params: { id: string; item: string } }>(`/api/casos/:id/${base}/itens/:item/nao-vou-conseguir`, { preHandler: exigir(banco, acao, agora) }, async (pedido, resposta) => {
      const entrada = NaoVouConseguir.safeParse(pedido.body)
      if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Escreva o motivo.')
      const l = await itemDoSetor(pedido.params.id, pedido.params.item, pedido.perfilAtivo, origem, resposta)
      if (!l) return resposta
      if (l.tarefa.escaladaEm) return negar(resposta, 409, 'Este item já está com a Sênior.')
      await banco.update(exigenciaItem).set({ motivo: entrada.data.motivo }).where(eq(exigenciaItem.id, l.item.id))
      await subirParaSenior(pedido.params.id, l.tarefa.id, `${l.item.descricao}: ${entrada.data.motivo}`, origem)
      await historico(pedido.usuario!.id, HISTORICO[origem].naoVai, pedido, `caso:${pedido.params.id}`, { item: l.item.id })
      return resposta.code(201).send({ ok: true })
    })

    // GGVP-83 CA1, CA6, CA11 e GGVP-58 CA1, CA2, CA7, CA12 (G21): só sai do laço com a prova: o documento ou, no despacho,
    // a informação escrita do Atendimento. Concluída, a tarefa não tem mais lembrete.
    app.post<{ Params: { id: string; item: string } }>(`/api/casos/:id/${base}/itens/:item/prova`, { preHandler: exigir(banco, acao, agora) }, async (pedido, resposta) => {
      const formulario = await lerFormulario(pedido)
      const arquivo = formulario?.arquivo && TIPOS_DE_ANEXO.includes(formulario.arquivo.mime) ? formulario.arquivo : null
      const escrita = origem === 'despacho' && setorDo(pedido.perfilAtivo) === 'atendimento' ? SubirInformacao.safeParse({ informacao: formulario?.campos.informacao }) : null
      if (!arquivo && !escrita?.success) return negar(resposta, 400, escrita ? MSG_INFORMACAO : MSG_EVIDENCIA)
      const casoId = pedido.params.id
      const l = await itemDoSetor(casoId, pedido.params.item, pedido.perfilAtivo, origem, resposta)
      if (!l) return resposta
      const quem = pedido.usuario!.id
      const dados = arquivo ? await guardarArquivo(armazenamento, casoId, arquivo, HISTORICO[origem].prova.replaceAll('_', '-')) : null
      await banco.transaction(async (tx) => {
        const [doc] = dados ? await tx.insert(documento).values({ casoId, tipo: HISTORICO[origem].prova, origem: 'portal', recebidoPor: quem, ...dados }).returning() : []
        await tx
          .update(exigenciaItem)
          .set({ situacao: 'cumprido', provaDocumentoId: doc?.id ?? null, informacao: escrita?.success ? escrita.data.informacao : null, cumpridoEm: agora(), cumpridoPor: quem })
          .where(eq(exigenciaItem.id, l.item.id))
        // GGVP-83 CA11 e GGVP-58 CA12: concluída, a tarefa não tem mais lembrete.
        await tx
          .update(tarefa)
          .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem, prazo: null, evidenciaDocumentoId: doc?.id ?? null })
          .where(eq(tarefa.id, l.tarefa.id))
      })
      await historico(quem, HISTORICO[origem].cumprido, pedido, `caso:${casoId}`, { item: l.item.id })
      // GGVP-87 CA1: com o último item provado (e a perícia resolvida), nasce "Manifestar no processo". No despacho, a
      // espera do cliente fecha (GGVP-58 CA8) e "Pedir a petição" libera (GGVP-63 CA1).
      if (origem === 'juizo') await abrirManifestacaoSePronta(banco, casoId, agora())
      else await fecharEsperaDoDespacho(casoId)
      return resposta.code(201).send({ ok: true })
    })

    // GGVP-94 CA8 a CA10 (G15): o item que passou do limite volta para o setor com o que a Sênior decidiu. A decisão entra
    // no laço (canal "decisao_senior") e na tabela de decisões; a contagem zera e o próximo lembrete é marcado.
    app.post<{ Params: { id: string; item: string } }>(`/api/casos/:id/${base}/itens/:item/decisao`, { preHandler: exigir(banco, decidir, agora) }, async (pedido, resposta) => {
      const entrada = DecidirLaco.safeParse(pedido.body)
      if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
      const casoId = pedido.params.id
      const [l] = await banco
        .select({ item: exigenciaItem, tarefa })
        .from(exigenciaItem)
        .innerJoin(exigencia, eq(exigenciaItem.exigenciaId, exigencia.id))
        .innerJoin(tarefa, eq(exigenciaItem.tarefaId, tarefa.id))
        .where(and(eq(exigenciaItem.id, pedido.params.item), eq(exigencia.casoId, casoId), eq(exigencia.origem, origem)))
      if (!l) return negar(resposta, 404, 'Item não encontrado.')
      if (!l.tarefa.escaladaEm || l.tarefa.concluidaEm) return negar(resposta, 409, 'Este item não está com a Sênior.')
      const quem = pedido.usuario!.id
      const lembrete = (await lembreteDoLaco(banco, hoje(agora()), l.item.prazo, l.tarefa.limiteTentativas ?? 1)) ?? l.tarefa.prazo
      await banco.transaction(async (tx) => {
        await tx.insert(tentativa).values({ tarefaId: l.tarefa.id, quando: agora(), canal: 'decisao_senior', resultado: entrada.data.oQueFazer, registradaPor: quem })
        await tx.update(tarefa).set({ tentativas: 0, escaladaEm: null, escaladaPara: null, prazo: lembrete }).where(eq(tarefa.id, l.tarefa.id))
        await tx.insert(decisao).values({
          casoId,
          passo: ESCALADA[origem].passo,
          tipo: 'laco_escalado',
          resultado: 'volta_ao_setor',
          justificativa: entrada.data.oQueFazer,
          decididoPor: quem,
          perfil: pedido.perfilAtivo!,
        })
        // A tarefa da Sênior fecha quando não sobra item do laço com ela.
        const comElaAinda = await tx
          .select({ id: tarefa.id })
          .from(tarefa)
          .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, passo), isNotNull(tarefa.escaladaEm), isNull(tarefa.concluidaEm)))
        if (!comElaAinda.length)
          await tx
            .update(tarefa)
            .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem })
            .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, ESCALADA[origem].passo), isNull(tarefa.concluidaEm)))
      })
      await historico(quem, 'laco_decidido', pedido, `caso:${casoId}`, { item: l.item.id, origem })
      return resposta.code(201).send({ ok: true, proximoLembrete: lembrete })
    })
  }

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
