// A Perícia no servidor (GGVP-137). As rotas têm a forma da design.md da change ggvp-10 e as regras são as das telas do
// Pedro, importadas sem cópia (apps/web/src/regras/periciaNoCaso.ts), rodando aqui com o perfil da sessão. A perícia é a
// mesma linha da tabela `pericia` que o INSS (GGVP-31), a exigência, o despacho e o juiz abrem; o formato das telas fica
// na coluna `documento`, e as colunas da linha seguem o que a junção do D2 lê (o resultado fecha a perícia). A IA da leitura
// do comprovante e do laudo continua simulada (a de verdade é da GGVP-139); o Chatwoot também.
// ponytail: as regras vêm de apps/web; mover para um pacote comum quando a ligação terminar.
import { createHash, randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, isNull, or } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  ArquivoParaLer,
  AutorizacaoDeRemarcacao,
  ComparecimentoNaPericia,
  ConclusaoDosDocumentos,
  DecisaoDaFalta,
  EsperaDoComprovante,
  FaltaNaPericia,
  MarcacaoConferida,
  MensagemConferida,
  OrientacaoAoCliente,
  PedidoAoMedicoNaPericia,
  PeritoEscolhido,
  PresencaNaPericia,
  RemarcacaoDaPericia,
  ResultadoConferido,
  TentativaDeMarcar,
  pode,
  type Acao,
  type Erro,
} from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { caso, documento, etapa, pericia, perito, pessoa, tarefa, usuario } from '../banco/esquema.ts'
import { avancarExigencia } from '../fluxo/exigencia.ts'
import { avancarJuncaoD2 } from '../fluxo/juncao-d2.ts'
import { exigir, registrarBloqueio, registrarHistorico } from '../sessao/rotas.ts'
import type { Perito } from '../../../web/src/dados/peritos.ts'
import type { Ficha, Processo, Tarefa } from '../../../web/src/dados/tipos.ts'
import { hojeIso } from '../../../web/src/regras/datas.ts'
import { problemaG20 } from '../../../web/src/regras/parecer.ts'
import type { OrigemDaPericia, TipoDePericia } from '../../../web/src/regras/pericia.ts'
import {
  criarPericia,
  leituraDoComprovante,
  leituraDoLaudo,
  mudancas,
  naTela,
  periciaDo,
  periciaDoResultado,
  tarefasDaAdvogadaEm,
  tarefasDaDocumentacaoEm,
  tarefasDeDecidirDocumentoEm,
  tarefasDoJuridicoAdmEm,
  type MundoDaPericia,
  type NaPericia,
  type Pericia,
  type PericiaNaTela,
} from '../../../web/src/regras/periciaNoCaso.ts'

export const MSG_SEM_PERICIA = 'Este caso não tem perícia.'
export const MSG_ARQUIVO_PDF = 'Anexe o PDF (até 25 MB).'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** De que passo a perícia nasceu (a etapa que a chamou): D2.03 (GGVP-31), D2.05 (exigência), D3.03 (despacho), D3a.03 (juiz). */
const ORIGEM_DO_PASSO: Record<string, OrigemDaPericia> = {
  'D2.03': 'd2-necessidade',
  'D2.05': 'd2-exigencia',
  'D3.03': 'd3-despacho',
  'D3a.03': 'd3a-juiz',
}

/**
 * Os benefícios do servidor no catálogo das telas. ponytail: o mesmo mapa está no pedido #29 (`NO_CATALOGO`, em
 * rotas/recepcao.ts); quando ele entrar na main, importar de lá e apagar este.
 */
const NO_CATALOGO: Record<string, string> = {
  bpc_loas_deficiente: 'loas-deficiente',
  bpc_loas_idoso: 'loas-idoso',
  aposentadoria_pcd: 'aposentadoria-pcd',
  aposentadoria_idade: 'aposentadoria-idade',
  aposentadoria_tempo: 'aposentadoria-contribuicao',
  aposentadoria_especial: 'aposentadoria-especial',
  aposentadoria_incapacidade_permanente: 'incapacidade-permanente',
  auxilio_incapacidade_temporaria: 'incapacidade-temporaria',
  auxilio_acidente: 'auxilio-acidente',
  pensao_morte: 'pensao-morte',
  salario_maternidade: 'salario-maternidade',
}

/** O perfil do perito na coluna `perfil` (GGVP-73): o tipo, onde atua e os laudos, sem dado pessoal do cliente. */
type PerfilGuardado = Pick<Perito, 'tipo' | 'onde' | 'laudos'>

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

/** A perícia do caso montada para as rotas: o mundo das regras e as linhas do banco, para gravar depois. */
type DoCaso = { mundo: MundoDaPericia; casoId: string; linhas: Map<string, typeof pericia.$inferSelect>; laudosAntes: Map<string, number> }

/**
 * Dado de saúde só para o Jurídico (GGVP-96, `dado_saude.ver_detalhe`). Para os outros perfis, a perícia sai por lista do
 * que pode: do resultado, só quando saiu; o histórico sem os passos do resultado e do perfil do perito (DP.08 a DP.10); a
 * orientação sem os números do perito e, quando segue o perfil dele, sem o texto; sem o texto das orientações recusadas
 * nem a justificativa da falta. O perfil do perito e os laudos da pasta também saem. Os números do perito nunca vão ao cliente.
 */
const PASSOS_DO_JURIDICO = new Set(['DP.08', 'DP.09', 'DP.10'])
/**
 * Os passos com texto livre de quem marca, confirma, remarca ou decide (o motivo pode dizer da saúde: "internado"): fora do
 * Jurídico, o histórico fica só com o que aconteceu, sem o porquê. Os textos da Documentação (DP.03) são dela e ficam.
 */
const COM_TEXTO_LIVRE = /^(Tentativa sem sucesso em [^:]+|Remarcação \d+|Autorizou mais uma remarcação \(G15\)|Decidiu sobre o documento que falta \(G15\)|Não conseguiu confirmar a presença|Confirmou a presença do cliente na perícia|Registrou que \S+ (compareceu à [^(]+|não compareceu))/
const semPorque = (oQue: string) => COM_TEXTO_LIVRE.exec(oQue)?.[0].trim() ?? oQue

function semSaude(p: Pericia): Pericia {
  const marcacao = (m: NonNullable<Pericia['marcacao']>) => ({
    ...m,
    ...(m.confirmacao && { confirmacao: { quando: m.confirmacao.quando, quem: m.confirmacao.quem, confirmou: m.confirmacao.confirmou } }),
    ...(m.comparecimento && { comparecimento: { quando: m.comparecimento.quando, quem: m.comparecimento.quem, compareceu: m.comparecimento.compareceu } }),
  })
  const d = p.documentos
  const o = p.orientacao
  return {
    ...p,
    resultado: p.resultado?.disponivelEm ? { disponivelEm: p.resultado.disponivelEm } : undefined,
    historico: p.historico.filter((e) => !PASSOS_DO_JURIDICO.has(e.passo)).map((e) => ({ ...e, oQue: semPorque(e.oQue) })),
    tentativas: p.tentativas.map((t) => ({ ...t, oQueAconteceu: '' })),
    documentos: d && { ...d, ...(d.decisaoDaAdvogada && { decisaoDaAdvogada: { ...d.decisaoDaAdvogada, texto: '' } }) },
    orientacao: o && {
      modo: o.modo,
      ...(o.motivo && { motivo: o.motivo }),
      geradaEm: o.geradaEm,
      ...(o.bloqueio && { bloqueio: o.bloqueio }),
      texto: o.modo === 'perfil' ? '' : o.texto,
    },
    enviosRecusados: p.enviosRecusados?.map(({ quando, quem, motivo }) => ({ quando, quem, motivo, texto: '' })),
    marcacao: p.marcacao && marcacao(p.marcacao),
    marcacoesAnteriores: p.marcacoesAnteriores?.map(marcacao),
  }
}

function visao(t: PericiaNaTela, juridico: boolean, sensiveis: Set<string>): PericiaNaTela {
  if (juridico) return t
  return {
    ...t,
    pericia: semSaude(t.pericia),
    // A etapa diz se a perícia acabou, nunca se foi favorável.
    etapa: t.etapa.replace(/\s*(des)?favorável$/, ''),
    ficha: { ...t.ficha, arquivos: t.ficha.arquivos.filter((a) => !sensiveis.has(a.nome)) },
    perfil: undefined,
    anteriores: t.anteriores.map(semSaude),
  }
}

export function registrarRotasPericia(app: FastifyInstance, { banco, armazenamento, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const bloqueio = registrarBloqueio(banco, agora)
  const com = (acao: Acao) => ({ preHandler: exigir(banco, acao, agora) })

  async function nomeDe(id: string | null | undefined) {
    if (!id) return 'Alguém do escritório'
    const [u] = await banco.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, id))
    return u?.nome ?? 'Alguém do escritório'
  }

  async function peritos(): Promise<Perito[]> {
    const linhas = await banco.select().from(perito).orderBy(asc(perito.nome))
    return linhas
      .filter((l) => l.perfil)
      .map((l) => {
        const p = l.perfil as PerfilGuardado
        return { id: l.id, nome: l.nome, especialidade: l.especialidade ?? '', tipo: p.tipo, onde: p.onde, laudos: p.laudos ?? [] }
      })
  }

  /** Os documentos do cliente na pasta, no formato das telas; os sensíveis (laudos) ficam marcados para a visão. */
  async function arquivosDe(pessoaId: string, casos: string[]) {
    const docs = await banco
      .select()
      .from(documento)
      .where(and(isNull(documento.excluidoEm), or(eq(documento.pessoaId, pessoaId), casos.length ? inArray(documento.casoId, casos) : undefined)))
      .orderBy(asc(documento.criadoEm))
    return {
      arquivos: docs.map((d) => ({
        nome: d.nomeOriginal,
        tipo: d.tipo,
        local: d.casoId ?? pessoaId,
        data: hojeIso(d.criadoEm),
        origem: 'card' as const,
        repetido: false,
        aguardaLeitura: false,
        hash: d.hashSha256,
      })),
      sensiveis: new Set(docs.filter((d) => d.sensivel).map((d) => d.nomeOriginal)),
    }
  }

  /**
   * O mundo da perícia de um caso: a ficha do cliente com os processos e a pasta, as perícias do caso e os peritos. A linha
   * que o INSS, a exigência, o despacho ou o juiz abriram e ainda não tem o formato das telas nasce aqui, pelo mesmo
   * `criarPericia` do servidor de exemplo (DP.01). ponytail: a ficha é a mínima; com o #29 na main, montar pelo fichário dele.
   */
  async function doCaso(casoId: string): Promise<(DoCaso & { sensiveis: Set<string> }) | null> {
    if (!UUID.test(casoId)) return null
    const [c] = await banco
      .select({ id: caso.id, pessoaId: caso.pessoaId, nome: pessoa.nome, telefone: pessoa.telefone, criadoEm: pessoa.criadoEm, situacao: pessoa.situacao })
      .from(caso)
      .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
      .where(eq(caso.id, casoId))
    if (!c) return null
    const casos = await banco.select({ id: caso.id, beneficio: caso.beneficio, fase: caso.fase }).from(caso).where(eq(caso.pessoaId, c.pessoaId))
    const processos: Processo[] = casos.map((x) => ({ id: x.id, beneficio: (x.beneficio && NO_CATALOGO[x.beneficio]) ?? x.beneficio ?? '', etapa: x.fase }))
    const { arquivos, sensiveis } = await arquivosDe(c.pessoaId, casos.map((x) => x.id))
    const [ano, mes] = c.criadoEm.toISOString().slice(0, 7).split('-')
    const ficha: Ficha = {
      id: c.pessoaId,
      situacao: c.situacao === 'cliente' ? 'cliente' : 'lead',
      desde: `${mes}/${ano}`,
      nome: c.nome,
      telefone: c.telefone ?? '',
      senhaGov: { situacao: 'sem-senha' },
      fichaAtendimentoPreenchida: false,
      processos,
      agendamentos: [],
      contatos: [],
      documentos: [],
      transcricoes: 0,
      historico: [],
      arquivos,
    }
    const ps = await peritos()
    const mundo: MundoDaPericia = { fichas: [ficha], pericias: [], peritos: ps }
    const linhas = await banco.select().from(pericia).where(eq(pericia.casoId, casoId)).orderBy(asc(pericia.criadoEm), asc(pericia.id))
    for (const l of linhas) {
      if (l.documento) {
        mundo.pericias!.push(l.documento as Pericia)
        continue
      }
      const [e] = l.chamadaPorEtapaId ? await banco.select().from(etapa).where(eq(etapa.id, l.chamadaPorEtapaId)) : []
      const origem = (e && ORIGEM_DO_PASSO[e.passo]) ?? 'd2-necessidade'
      const quando = e?.concluidaEm ?? l.criadoEm
      criarPericia(
        mundo,
        casoId,
        { origem, tipo: l.tipo as TipoDePericia, instancia: origem.startsWith('d2') ? 'inss' : 'juizo', pedidaPor: await nomeDe(e?.concluidaPor) },
        quando,
        undefined,
        l.id,
      )
    }
    return { mundo, casoId, linhas: new Map(linhas.map((l) => [l.id, l])), laudosAntes: new Map(ps.map((p) => [p.id, p.laudos.length])), sensiveis }
  }

  /** Grava as perícias do caso (as colunas que a junção lê e o documento das telas) e os perfis de perito que mudaram. */
  async function guardar(d: DoCaso) {
    await banco.transaction(async (tx) => {
      for (const p of d.mundo.pericias ?? []) {
        const colunas = {
          documento: p,
          agendadaPara: p.marcacao ? new Date(`${p.marcacao.data}T${p.marcacao.hora}:00-03:00`) : null,
          local: p.marcacao?.local ?? null,
          compareceu: p.marcacao?.comparecimento?.compareceu ?? null,
          remarcacoes: p.remarcacoes,
          peritoId: p.peritoId && UUID.test(p.peritoId) ? p.peritoId : null,
          resultado: p.resultado?.registrado ? (p.resultado.registrado.favoravel ? 'favoravel' : 'desfavoravel') : null,
        }
        const linha = d.linhas.get(p.id)
        if (linha) await tx.update(pericia).set(colunas).where(eq(pericia.id, p.id))
        // A nova perícia depois do desfavorável (GGVP-70, CA4) nasce da mesma decisão de origem: a junção espera por ela.
        else {
          const origem = [...d.linhas.values()].at(-1)
          await tx.insert(pericia).values({ id: p.id, casoId: d.casoId, tipo: p.tipo, chamadaPorEtapaId: origem?.chamadaPorEtapaId ?? null, ...colunas })
        }
      }
      for (const p of d.mundo.peritos ?? []) {
        if (p.laudos.length === d.laudosAntes.get(p.id)) continue
        await tx.update(perito).set({ perfil: { tipo: p.tipo, onde: p.onde, laudos: p.laudos } satisfies PerfilGuardado }).where(eq(perito.id, p.id))
      }
    })
  }

  /**
   * Marcada (ou esperando o comprovante), a tarefa "Marcar perícia" que o INSS abriu no DP.01 (GGVP-31) se conclui: a partir
   * daqui a perícia anda pelas tarefas desta rota, sem a mesma tarefa duas vezes na Central.
   */
  async function concluirTarefaDoInss(casoId: string, quem: string) {
    await banco
      .update(tarefa)
      .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem })
      .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'DP.01'), isNull(tarefa.concluidaEm)))
  }

  const juridico = (pedido: FastifyRequest) => pode(pedido.perfilAtivo, 'dado_saude.ver_detalhe')

  /** Um PDF do multipart (o comprovante ou o laudo) e o JSON do campo `dados`. */
  async function lerMultipart(pedido: FastifyRequest) {
    const campos: Record<string, string> = {}
    let arquivo: { conteudo: Buffer; mime: string; nome: string } | null = null
    for await (const parte of pedido.parts()) {
      if (parte.type === 'file') arquivo = { conteudo: await parte.toBuffer(), mime: parte.mimetype, nome: parte.filename }
      else campos[parte.fieldname] = String(parte.value)
    }
    let dados: unknown = null
    try {
      dados = JSON.parse(campos.dados ?? 'null')
    } catch {
      dados = null
    }
    return { dados, arquivo: arquivo && arquivo.mime === 'application/pdf' && arquivo.conteudo.length > 0 ? arquivo : null }
  }

  type Mudanca = { acao: string; passo: string; detalhe?: Record<string, unknown> }

  /**
   * O molde de toda mudança: o caso, a perícia (a em andamento ou a do resultado), a regra das telas (que lança o motivo),
   * a gravação e o histórico (GGVP-99). O histórico leva só códigos e contagens, nunca o texto: pode ter dado de saúde.
   */
  async function mudar(
    pedido: FastifyRequest<{ Params: { id: string } }>,
    resposta: FastifyReply,
    registro: Mudanca,
    aplicar: (n: NaPericia, quem: string, d: DoCaso) => unknown | Promise<unknown>,
    doResultado = false,
  ) {
    const d = await doCaso(pedido.params.id)
    if (!d) return negar(resposta, 404, 'Caso não encontrado.')
    const alvo = doResultado ? periciaDoResultado(d.mundo, d.casoId) : periciaDo(d.mundo, d.casoId)
    if (!alvo) return negar(resposta, doResultado ? 409 : 404, doResultado ? 'Esta perícia não espera resultado.' : MSG_SEM_PERICIA)
    const n: NaPericia = { mundo: d.mundo, pericia: alvo, agora: agora() }
    try {
      await aplicar(n, await nomeDe(pedido.usuario!.id), d)
    } catch (e) {
      return negar(resposta, 400, e instanceof Error ? e.message : 'Não foi possível registrar.')
    }
    await guardar(d)
    // Sem ação: quem chama registra (a recusa de um portão vai pelo registrarBloqueio).
    if (registro.acao) await historico(pedido.usuario!.id, registro.acao, pedido, `caso:${d.casoId}`, { pericia: alvo.id, passo: registro.passo, ...registro.detalhe })
    return visao(naTela(d.mundo, alvo, agora()), juridico(pedido), d.sensiveis)
  }

  /** Lê o corpo pelo contrato; fora da forma, 400. */
  function corpo<T>(contrato: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, pedido: FastifyRequest, resposta: FastifyReply): T | null {
    const entrada = contrato.safeParse(pedido.body)
    if (entrada.success) return entrada.data
    void negar(resposta, 400, 'Dados inválidos.')
    return null
  }

  type ComId = { Params: { id: string } }

  // GGVP-49: a perícia do processo, na visão do perfil. A que nasceu do INSS ganha aqui o formato das telas (DP.01).
  app.get<ComId>('/api/processos/:id/pericia', com('caso.ver'), async (pedido, resposta) => {
    const d = await doCaso(pedido.params.id)
    if (!d) return negar(resposta, 404, 'Caso não encontrado.')
    const p = periciaDo(d.mundo, d.casoId)
    if (!p) return negar(resposta, 404, MSG_SEM_PERICIA)
    if ([...d.linhas.values()].some((l) => !l.documento)) await guardar(d)
    return visao(naTela(d.mundo, p, agora()), juridico(pedido), d.sensiveis)
  })

  // GGVP-70: a perícia do resultado (a que espera o resultado ou a última conferida). Dado de saúde: só o Jurídico.
  app.get<ComId>('/api/processos/:id/pericia/resultado', com('dado_saude.ver_detalhe'), async (pedido, resposta) => {
    const d = await doCaso(pedido.params.id)
    if (!d) return negar(resposta, 404, 'Caso não encontrado.')
    const p = periciaDoResultado(d.mundo, d.casoId)
    if (!p) return negar(resposta, 404, 'Esta perícia não espera resultado.')
    return naTela(d.mundo, p, agora())
  })

  // As tarefas da perícia de quem está na sessão (GGVP-49 CA2, GGVP-53 CA9, GGVP-56, GGVP-66, GGVP-70): pelo perfil da
  // sessão, nunca por ?perfil=. ponytail: lê as perícias caso a caso; juntar numa consulta quando o escritório crescer.
  app.get('/api/pericias/tarefas', com('caso.ver'), async (pedido): Promise<Tarefa[]> => {
    const casos = [...new Set((await banco.select({ casoId: pericia.casoId }).from(pericia)).map((l) => l.casoId))]
    const tarefas: Tarefa[] = []
    for (const casoId of casos) {
      const d = await doCaso(casoId)
      if (!d) continue
      const perfil = pedido.perfilAtivo
      if (perfil === 'juridico_adm') tarefas.push(...tarefasDoJuridicoAdmEm(d.mundo, agora()))
      if (perfil === 'documentacao') tarefas.push(...tarefasDaDocumentacaoEm(d.mundo, agora()))
      if (perfil === 'advogada') tarefas.push(...tarefasDaAdvogadaEm(d.mundo, agora()), ...tarefasDeDecidirDocumentoEm(d.mundo, agora()))
    }
    return tarefas
  })

  // A cópia das telas (modo misto): as perícias em andamento de todos os casos, na visão do perfil, para a agenda, o chat
  // e as páginas que ainda leem a cópia do navegador. ponytail: lê caso a caso; juntar numa consulta quando crescer.
  app.get('/api/pericias', com('caso.ver'), async (pedido): Promise<PericiaNaTela[]> => {
    const casos = [...new Set((await banco.select({ casoId: pericia.casoId }).from(pericia)).map((l) => l.casoId))]
    const lista: PericiaNaTela[] = []
    for (const casoId of casos) {
      const d = await doCaso(casoId)
      const p = d && periciaDo(d.mundo, casoId)
      if (d && p) lista.push(visao(naTela(d.mundo, p, agora()), juridico(pedido), d.sensiveis))
    }
    return lista
  })

  // GGVP-61 CA6: os peritos que a pergunta de um clique oferece, do mesmo tipo. Só o Jurídico (a jurimetria é dele).
  app.get<{ Querystring: { tipo?: string } }>('/api/peritos', com('dado_saude.ver_detalhe'), async (pedido) => {
    return (await peritos()).filter((p) => !pedido.query.tipo || p.tipo === pedido.query.tipo).map(({ id, nome, especialidade, tipo }) => ({ id, nome, especialidade, tipo }))
  })

  // GGVP-49 CA2 (D2.E1): o INSS liberou o agendamento; a tarefa entra na Central do Jurídico administrativo.
  app.post<ComId>('/api/processos/:id/pericia/liberacao', com('pericia.marcar'), (pedido, resposta) =>
    mudar(pedido, resposta, { acao: 'pericia_liberada', passo: 'D2.E1' }, (n) => mudancas.liberacao(n)),
  )

  // GGVP-53 CA1: a tentativa sem sucesso.
  app.post<ComId>('/api/processos/:id/pericia/tentativas', com('pericia.marcar'), (pedido, resposta) => {
    const t = corpo(TentativaDeMarcar, pedido, resposta)
    return t && mudar(pedido, resposta, { acao: 'pericia_tentativa_registrada', passo: 'DP.02' }, (n, quem) => mudancas.tentativa(n, t, quem))
  })

  // GGVP-53 CA2, CA3: IA simulada lê data, hora, local e tipo do comprovante; o perito nunca vem. A pessoa confere.
  app.post<ComId>('/api/processos/:id/pericia/comprovante/leitura', com('pericia.marcar'), async (pedido, resposta) => {
    const a = corpo(ArquivoParaLer, pedido, resposta)
    if (!a) return
    const d = await doCaso(pedido.params.id)
    const p = d && periciaDo(d.mundo, d.casoId)
    if (!p) return negar(resposta, 404, MSG_SEM_PERICIA)
    return leituraDoComprovante(p, a.nome, hojeIso(agora()))
  })

  // GGVP-53 CA2 a CA4, CA8: a marcação conferida, com o comprovante do INSS na pasta do caso.
  app.post<ComId>('/api/processos/:id/pericia/marcacao', com('pericia.marcar'), async (pedido, resposta) => {
    const { dados, arquivo } = await lerMultipart(pedido)
    const entrada = MarcacaoConferida.safeParse(dados)
    if (!entrada.success) return negar(resposta, 400, 'Dados inválidos.')
    if (!arquivo) return negar(resposta, 400, MSG_ARQUIVO_PDF)
    const hash = createHash('sha256').update(arquivo.conteudo).digest('hex')
    return mudar(pedido, resposta, { acao: 'pericia_marcada', passo: 'DP.02', detalhe: { pedeDocumentoNovo: entrada.data.pedeDocumentoNovo } }, async (n, quem) => {
      mudancas.marcacao(n, { comprovante: { nome: arquivo.nome, hash }, lido: entrada.data.lido, pedeDocumentoNovo: entrada.data.pedeDocumentoNovo }, quem)
      await guardarArquivo(pedido, n, arquivo, hash, 'comprovante-pericia', false)
      await concluirTarefaDoInss(n.pericia.processoId, pedido.usuario!.id)
    })
  })

  /** O PDF vai para o armazenamento e para a pasta do caso, com o nome que a regra deu (com "(2)" quando repete). */
  async function guardarArquivo(pedido: FastifyRequest<ComId>, n: NaPericia, arquivo: { conteudo: Buffer; mime: string }, hash: string, tipo: string, sensivel: boolean) {
    const ficha = n.mundo.fichas[0]
    const nome = ficha.arquivos.at(-1)!.nome
    const chave = `casos/${n.pericia.processoId}/${randomUUID()}-${tipo}`
    await armazenamento.salvar(chave, arquivo.conteudo, arquivo.mime)
    await banco.insert(documento).values({
      pessoaId: ficha.id,
      casoId: n.pericia.processoId,
      tipo,
      sensivel,
      chaveArmazenamento: chave,
      nomeOriginal: nome,
      mime: arquivo.mime,
      tamanho: arquivo.conteudo.length,
      hashSha256: hash,
      origem: 'portal',
      recebidoPor: pedido.usuario!.id,
    })
  }

  // GGVP-53 CA6 (DP.E1): marcada no Meu INSS, sem o comprovante ainda.
  app.post<ComId>('/api/processos/:id/pericia/espera-do-comprovante', com('pericia.marcar'), (pedido, resposta) => {
    const e = corpo(EsperaDoComprovante, pedido, resposta)
    return e && mudar(pedido, resposta, { acao: 'pericia_espera_comprovante', passo: 'DP.E1', detalhe: e }, async (n, quem) => {
      mudancas.esperarComprovante(n, e, quem)
      await concluirTarefaDoInss(n.pericia.processoId, pedido.usuario!.id)
    })
  })

  // GGVP-53 CA8, CA9: remarcar; passou do limite, sobe para a advogada responsável (G15).
  app.post<ComId>('/api/processos/:id/pericia/remarcacao', com('pericia.marcar'), (pedido, resposta) => {
    const r = corpo(RemarcacaoDaPericia, pedido, resposta)
    return r && mudar(pedido, resposta, { acao: 'pericia_remarcada', passo: 'DP.02' }, (n, quem) => mudancas.remarcacao(n, r.motivo, quem))
  })

  // GGVP-53 CA9 (G15): a advogada responsável autoriza mais uma remarcação. Nunca a Sênior.
  app.post<ComId>('/api/processos/:id/pericia/autorizacao', com('pericia.decidir_no_limite'), (pedido, resposta) => {
    const a = corpo(AutorizacaoDeRemarcacao, pedido, resposta)
    return a && mudar(pedido, resposta, { acao: 'pericia_remarcacao_autorizada', passo: 'DP.02' }, (n, quem) => mudancas.autorizacao(n, a.justificativa, quem))
  })

  // GGVP-53 CA7: o lembrete da véspera, conferido e enviado pelo Chatwoot (simulado).
  app.post<ComId>('/api/processos/:id/pericia/lembrete', com('pericia.marcar'), (pedido, resposta) => {
    const m = corpo(MensagemConferida, pedido, resposta)
    return m && mudar(pedido, resposta, { acao: 'pericia_lembrete_enviado', passo: 'DP.04' }, (n, quem) => mudancas.lembrete(n, m.mensagem, quem))
  })

  // GGVP-56: a Documentação reúne o que a perícia pede (DP.03).
  app.post<ComId>('/api/processos/:id/pericia/faltas', com('pericia.reunir_documentos'), (pedido, resposta) => {
    const f = corpo(FaltaNaPericia, pedido, resposta)
    return f && mudar(pedido, resposta, { acao: 'pericia_falta_registrada', passo: 'DP.03', detalhe: { item: f.itemId } }, (n, quem) => mudancas.falta(n, f.itemId, f.justificativa, quem))
  })

  app.post<ComId>('/api/processos/:id/pericia/documentos/conclusao', com('pericia.reunir_documentos'), (pedido, resposta) => {
    const c = corpo(ConclusaoDosDocumentos, pedido, resposta)
    return c && mudar(pedido, resposta, { acao: 'pericia_documentos_concluidos', passo: 'DP.03' }, (n, quem) => mudancas.conclusaoDosDocumentos(n, c, quem))
  })

  // GGVP-56 CA7 (G20): o pedido ao médico diz só o que o documento deve abordar. O portão recusa e registra.
  app.post<ComId>('/api/processos/:id/pericia/pedido-ao-medico', com('pericia.reunir_documentos'), async (pedido, resposta) => {
    const p = corpo(PedidoAoMedicoNaPericia, pedido, resposta)
    if (!p) return
    const problema = problemaG20(p.abordar)
    if (problema) {
      await bloqueio(pedido, pedido.params.id, 'G20', 'DP.03', {}, 'pericia_pedido_ao_medico_recusado')
      return negar(resposta, 400, problema)
    }
    return mudar(pedido, resposta, { acao: 'pericia_pedido_ao_medico', passo: 'DP.03' }, (n, quem) => mudancas.pedidoAoMedico(n, p.abordar, quem))
  })

  app.post<ComId>('/api/processos/:id/pericia/cobranca', com('pericia.reunir_documentos'), (pedido, resposta) => {
    const m = corpo(MensagemConferida, pedido, resposta)
    return m && mudar(pedido, resposta, { acao: 'pericia_cobranca_enviada', passo: 'DP.03' }, (n, quem) => mudancas.cobranca(n, m.mensagem, quem))
  })

  app.post<ComId>('/api/processos/:id/pericia/cobranca/adiamento', com('pericia.reunir_documentos'), (pedido, resposta) =>
    mudar(pedido, resposta, { acao: 'pericia_cobranca_adiada', passo: 'DP.03' }, (n, quem) => mudancas.adiamentoDaCobranca(n, quem)),
  )

  // G15: passou dos 10 dias antes com documento faltando; a advogada responsável decide.
  app.post<ComId>('/api/processos/:id/pericia/decisao-da-falta', com('pericia.decidir_no_limite'), (pedido, resposta) => {
    const t = corpo(DecisaoDaFalta, pedido, resposta)
    return t && mudar(pedido, resposta, { acao: 'pericia_falta_decidida', passo: 'DP.03' }, (n, quem) => mudancas.decisaoDaFalta(n, t.texto, quem))
  })

  // GGVP-61 CA6: a pergunta de um clique liga o perito; a orientação sai de novo pelo perfil.
  app.post<ComId>('/api/processos/:id/pericia/perito', com('pericia.orientar_cliente'), (pedido, resposta) => {
    const p = corpo(PeritoEscolhido, pedido, resposta)
    return p && mudar(pedido, resposta, { acao: 'pericia_perito_ligado', passo: 'DP.05' }, (n, quem) => mudancas.perito(n, p.peritoId, quem))
  })

  // GGVP-62: a orientação revisada vai ao cliente. O servidor verifica de novo (G11, G20): recusada, guarda a tentativa,
  // registra o portão e responde 400.
  app.post<ComId>('/api/processos/:id/pericia/orientacao', com('pericia.orientar_cliente'), async (pedido, resposta) => {
    const o = corpo(OrientacaoAoCliente, pedido, resposta)
    if (!o) return
    let recusa: string | null = null
    const registro = { acao: 'pericia_orientacao_enviada', passo: 'DP.06', detalhe: { canal: o.canal } }
    const r = await mudar(pedido, resposta, registro, (n, quem) => {
      recusa = mudancas.orientacao(n, o, quem)
      if (recusa) registro.acao = ''
    })
    if (!recusa) return r
    await bloqueio(pedido, pedido.params.id, 'G20', 'DP.06', {}, 'pericia_orientacao_recusada')
    return negar(resposta, 400, recusa)
  })

  // GGVP-66: a confirmação da véspera e o comparecimento (DP.07).
  app.post<ComId>('/api/processos/:id/pericia/presenca', com('pericia.registrar_comparecimento'), (pedido, resposta) => {
    const c = corpo(PresencaNaPericia, pedido, resposta)
    return c && mudar(pedido, resposta, { acao: 'pericia_presenca_registrada', passo: 'DP.07', detalhe: { confirmou: c.confirmou } }, (n, quem) => mudancas.presenca(n, c, quem))
  })

  app.post<ComId>('/api/processos/:id/pericia/comparecimento', com('pericia.registrar_comparecimento'), (pedido, resposta) => {
    const c = corpo(ComparecimentoNaPericia, pedido, resposta)
    return c && mudar(pedido, resposta, { acao: 'pericia_comparecimento_registrado', passo: 'DP.07', detalhe: { compareceu: c.compareceu } }, (n, quem) => mudancas.comparecimento(n, c, quem))
  })

  // GGVP-70 CA1 (DP.E4): o resultado apareceu no GERID ou no processo; a tarefa da advogada fica urgente.
  app.post<ComId>('/api/processos/:id/pericia/resultado/disponivel', com('pericia.conferir_resultado'), (pedido, resposta) =>
    mudar(pedido, resposta, { acao: 'pericia_resultado_disponivel', passo: 'DP.E4' }, (n) => mudancas.resultadoDisponivel(n), true),
  )

  // GGVP-70 CA5: IA simulada resume o laudo; a advogada confere e decide.
  app.post<ComId>('/api/processos/:id/pericia/laudo/leitura', com('pericia.conferir_resultado'), async (pedido, resposta) => {
    const a = corpo(ArquivoParaLer, pedido, resposta)
    if (!a) return
    const d = await doCaso(pedido.params.id)
    const p = d && periciaDoResultado(d.mundo, d.casoId)
    if (!d || !p) return negar(resposta, 409, 'Esta perícia não espera resultado.')
    return leituraDoLaudo(p, naTela(d.mundo, p, agora()).beneficio, a.nome)
  })

  // GGVP-70 CA2 a CA6 e GGVP-73: o resultado conferido, com o laudo (dado de saúde) na pasta; fecha a perícia na junção
  // do D2 ou volta à vigília da exigência; o laudo entra no perfil do perito.
  app.post<ComId>('/api/processos/:id/pericia/resultado', com('pericia.conferir_resultado'), async (pedido, resposta) => {
    const { dados, arquivo } = await lerMultipart(pedido)
    const entrada = ResultadoConferido.safeParse(dados)
    if (!entrada.success) return negar(resposta, 400, 'Dados inválidos.')
    if (!arquivo) return negar(resposta, 400, MSG_ARQUIVO_PDF)
    const hash = createHash('sha256').update(arquivo.conteudo).digest('hex')
    const r = await mudar(
      pedido,
      resposta,
      { acao: 'pericia_resultado_registrado', passo: 'DP.08', detalhe: { favoravel: entrada.data.favoravel, novaPericia: entrada.data.novaPericia === true } },
      async (n, quem) => {
        mudancas.resultado(n, { laudo: { nome: arquivo.nome, hash }, ...entrada.data }, quem, randomUUID())
        await guardarArquivo(pedido, n, arquivo, hash, 'laudo-pericia', true)
      },
      true,
    )
    if (resposta.sent) return r
    await avancarJuncaoD2(banco, pedido.params.id, agora())
    await avancarExigencia(banco, pedido.params.id, agora())
    return r
  })

  // GGVP-73 CA5: a IA roda de novo sobre o laudo registrado; o mesmo laudo não se duplica no perfil.
  app.post<ComId>('/api/processos/:id/pericia/laudo/perfil', com('pericia.conferir_resultado'), (pedido, resposta) =>
    mudar(pedido, resposta, { acao: 'pericia_perfil_atualizado', passo: 'DP.09' }, (n) => mudancas.perfilComOLaudo(n), true),
  )

  // GGVP-73 CA6: ligado o perito, o laudo sai da espera e entra no perfil dele.
  app.post<ComId>('/api/processos/:id/pericia/laudo/perito', com('pericia.conferir_resultado'), (pedido, resposta) => {
    const p = corpo(PeritoEscolhido, pedido, resposta)
    return p && mudar(pedido, resposta, { acao: 'pericia_perito_do_laudo', passo: 'DP.09' }, (n, quem) => mudancas.peritoDoLaudo(n, p.peritoId, quem), true)
  })
}
