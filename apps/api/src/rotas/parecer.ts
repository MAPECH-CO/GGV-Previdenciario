// O parecer de suficiência da documentação médica no servidor (GGVP-20 e GGVP-33, ligados pela GGVP-132). As rotas têm a
// forma da design.md da change ggvp-13 e as regras são as das telas (regras/parecerDoCaso.ts), rodando aqui com o perfil
// da sessão. A análise lê os documentos médicos do caso (`documento` e `documento_medico`) com a IA de verdade (GGVP-134):
// a Mistral lê o arquivo e a OpenAI diz o que ele cobre do roteiro, com o trecho; sem a IA, a análise segue manual, com o
// motivo. O parecer só vale com a pessoa do Jurídico (G17); cada registro vai também para `parecer_medico`,
// que a conferência da Sênior e o portão das outras telas leem. A dispensa é de duas Sêniores diferentes, em `decisao`.
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { CoberturaDoRoteiroPelaIa, DispensarParecer, PedidoDeParecer, ResponderDispensa, pode, type Erro, type FonteDaIa } from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, chamadaIa, decisao, documento, documentoMedico, parecerMedico, usuario } from '../banco/esquema.ts'
import { lerJson, type ComoSugerir, type Ia } from '../ia/ia.ts'
import type { Preparo } from '../ia/preparo.ts'
import { MSG_CASO_NAO_ENCONTRADO, criarCasoMedico, type CasoMedico } from '../fluxo/documentacao-medica.ts'
import { exigir, registrarBloqueio, registrarHistorico } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { nomeBeneficio } from '../../../web/src/dados/catalogos.ts'
import { dataCurta } from '../../../web/src/regras/datas.ts'
import { abrirNaLista, encerrarNaLista, type Complemento } from '../../../web/src/regras/complemento.ts'
import { menorDe16 } from '../../../web/src/regras/infantil.ts'
import { NOMES_DO_PARECER, motivoParaNaoAprovarDispensa, motivoParaNaoPedirDispensa, type Dispensa } from '../../../web/src/regras/parecer.ts'
import { emVigor, type Roteiro } from '../../../web/src/regras/roteiro.ts'
import {
  comLaudo,
  comoCitar,
  dispensaEmVigor,
  montarAnalise,
  naTela,
  perguntasQueFaltam,
  registroDoPedido,
  type DocumentoLido,
  type ParecerDoCaso,
  type ParecerNaTela,
  type Visao,
} from '../../../web/src/regras/parecerDoCaso.ts'
import { roteiroDoCaso, roteirosDoBanco } from './roteiros.ts'

export const MSG_PARECER_JA_SUFICIENTE = 'O parecer já está Suficiente: não há o que dispensar.'
export const MSG_JA_DISPENSADO = 'O parecer já foi dispensado.'
export const MSG_DISPENSA_ESPERANDO = 'Já há um pedido de dispensa esperando a segunda sênior.'

export const MSG_IA_DESLIGADA = 'A IA está desligada: confira cada item pela sua leitura dos documentos.'
export const msgSemIa = (n: number) => `A IA não respondeu agora para ${n === 1 ? '1 documento' : `${n} documentos`}: confira esses itens pela sua leitura.`

export type ComIa = { banco: Banco; agora?: () => Date; ia: Ia; armazenamento: Armazenamento }
type Opcoes = ComIa & { preparo: Preparo }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

/** O tipo do documento médico do servidor no catálogo das telas. */
const NA_TELA: Record<string, string> = { relatorio: 'relatorio-medico' }

/** Como o portal guarda cada registro em `parecer_medico`, o formato que a conferência da Sênior lê (sem trecho clínico). */
const itemParaOPortal = (i: { tipo: string; texto: string; situacao: string }) => ({
  item: i.texto,
  atendido: i.tipo === 'contradicao' ? i.situacao !== 'contraditorio' : i.situacao === 'presente',
})

/** Como ler: `quem` pede (nulo no preparo); `semChamar`: só o que a IA já leu, sem chamada nova (as Centrais e o Atendimento). */
type ComoLer = { quem?: string | null; como?: ComoSugerir; semChamar?: boolean }
const DIA = 24 * 3_600_000

/** O parecer do caso, comum ao parecer, ao complemento e às tarefas: a análise em dia, os registros e as dispensas. */
export function criarParecerDoCaso({ banco, agora = () => new Date(), ia, armazenamento }: ComIa) {
  const { lerParte, gravarParte } = criarCasoMedico(banco, agora)

  /** Os documentos médicos do caso (os do processo e os pessoais). */
  async function documentosMedicos(c: CasoMedico) {
    return banco
      .select({
        id: documento.id,
        chave: documento.chaveArmazenamento,
        mime: documento.mime,
        criadoEm: documento.criadoEm,
        tipo: documentoMedico.tipo,
        dataEmissao: documentoMedico.dataEmissao,
        emitente: documentoMedico.profissional,
        conferidoEm: documentoMedico.confirmadoEm,
      })
      .from(documentoMedico)
      .innerJoin(documento, eq(documentoMedico.documentoId, documento.id))
      .where(
        and(
          isNull(documento.excluidoEm),
          ne(documento.situacao, 'recusado'),
          or(eq(documento.casoId, c.id), and(isNull(documento.casoId), eq(documento.pessoaId, c.pessoaId))),
        ),
      )
      .orderBy(asc(documento.criadoEm))
  }
  type DocumentoMedico = Awaited<ReturnType<typeof documentosMedicos>>[number]

  /**
   * O texto do arquivo (`lerDocumento`, sensível). A leitura que deu certo fica no registro da IA e não se repete; no
   * preparo, a que falhou espera um dia, e quem abre a tela tenta de novo.
   */
  async function textoDoDocumento(c: CasoMedico, d: DocumentoMedico, quem: string | null, como: ComoSugerir) {
    const referencia = `documento:${d.id}`
    const desta = and(eq(chamadaIa.finalidade, 'ler_documento'), eq(chamadaIa.casoId, c.id), sql`${chamadaIa.fontes} @> ${JSON.stringify([{ referencia }])}::jsonb`)
    const [lida] = await banco
      .select({ texto: chamadaIa.saida, alerta: chamadaIa.alerta })
      .from(chamadaIa)
      .where(and(desta, eq(chamadaIa.situacao, 'ok'), isNotNull(chamadaIa.saida)))
      .orderBy(desc(chamadaIa.quando))
      .limit(1)
    if (lida?.texto) return { texto: lida.texto, alerta: lida.alerta }
    if (como.soPreparar) {
      const [tentou] = await banco
        .select({ id: chamadaIa.id })
        .from(chamadaIa)
        .where(and(desta, inArray(chamadaIa.situacao, ['falhou', 'recusada']), gt(chamadaIa.quando, new Date(agora().getTime() - DIA))))
        .limit(1)
      if (tentou) return null
    }
    const arquivo = await armazenamento.ler(d.chave).catch(() => null)
    if (!arquivo) return null
    const r = await ia.lerDocumento({ casoId: c.id, quem, arquivo, mime: d.mime, sensivel: true, referencia })
    return r && { texto: r.texto, alerta: r.alerta }
  }

  /**
   * CA1, CA3: o que o documento cobre e contradiz do roteiro, com a página e o trecho. Vai à IA só o roteiro e o texto
   * deste documento: nem o nome do cliente, nem outro caso. Item fora do roteiro é descartado aqui (a regra é do código).
   */
  async function lerComIa(c: CasoMedico, d: DocumentoMedico, roteiro: Roteiro, quem: string | null, como: ComoSugerir) {
    const lido = await textoDoDocumento(c, d, quem, como)
    if (!lido) return null
    const versao = emVigor(roteiro)
    const citado = comoCitar({ tipo: NA_TELA[d.tipo] ?? d.tipo, data: d.dataEmissao ?? hojeEmBrasilia(d.criadoEm) })
    const conteudo = [
      `Benefício: ${nomeBeneficio(c.processo.beneficio)}`,
      `Roteiro: ${roteiro.nome}, versão ${versao.versao}`,
      ...versao.itens.filter((i) => i.tipo !== 'complementar').map((i) => `- ${i.id} · ${i.tipo === 'obrigatorio' ? 'obrigatório' : 'contradição'} · ${i.texto}`),
      `Documento: ${citado}`,
      'Texto do documento:',
      lido.texto,
    ].join('\n')
    const fontes: FonteDaIa[] = [
      { tipo: 'documento', referencia: `documento:${d.id}`, trecho: citado },
      { tipo: 'regra', referencia: `roteiro:${roteiro.id}:v${versao.versao}`, trecho: `${roteiro.nome}, versão ${versao.versao}` },
    ]
    const validar = (texto: string) => CoberturaDoRoteiroPelaIa.safeParse(lerJson(texto)).success
    const s = await ia.sugerir('cobertura_do_roteiro', { casoId: c.id, quem, conteudo, fontes }, { ...como, validar })
    if (!s) return null
    const r = CoberturaDoRoteiroPelaIa.parse(lerJson(s.texto))
    const doTipo = (tipo: string) => new Set(versao.itens.filter((i) => i.tipo === tipo).map((i) => i.id))
    const pega = (lista: { item: string; pagina: number; trecho: string }[], validos: Set<string>) =>
      Object.fromEntries(lista.filter((x) => validos.has(x.item)).map((x) => [x.item, { pagina: x.pagina, trecho: x.trecho }]))
    return {
      cobre: pega(r.cobre, doTipo('obrigatorio')),
      contradiz: pega(r.contradiz, doTipo('contradicao')),
      ...(r.datas && { datas: r.datas }),
      sugestao: s,
      alertas: [lido.alerta, s.alerta].filter((a): a is string => Boolean(a)),
    }
  }

  /** As dispensas pedidas e respondidas, em ordem (GGVP-33): a mesma `decisao` que a conferência da Sênior lê. */
  async function dispensas(casoId: string): Promise<Dispensa[]> {
    const linhas = await banco
      .select({ resultado: decisao.resultado, justificativa: decisao.justificativa, quem: usuario.nome, quando: decisao.decididoEm })
      .from(decisao)
      .innerJoin(usuario, eq(decisao.decididoPor, usuario.id))
      .where(and(eq(decisao.casoId, casoId), eq(decisao.tipo, 'dispensa_parecer')))
      .orderBy(asc(decisao.decididoEm))
    const lista: Dispensa[] = []
    for (const l of linhas) {
      const quando = l.quando.toISOString()
      if (l.resultado === 'pedida') lista.push({ justificativa: l.justificativa ?? '', pedidaPor: l.quem, pedidaEm: quando })
      else if (lista.length) Object.assign(lista.at(-1)!, l.resultado === 'aprovada' ? { aprovadaPor: l.quem, aprovadaEm: quando } : { recusadaPor: l.quem, recusadaEm: quando })
    }
    return lista
  }

  /**
   * O parecer com a análise em dia: se os documentos mudaram, nasce a análise nova com o roteiro em vigor (CA4), lida pela
   * IA. `semChamar` com a IA ligada: a análise nova espera o preparo ou o Jurídico abrir; com ela desligada, segue manual.
   */
  async function emDia(c: CasoMedico, { quem = null, como = {}, semChamar = false }: ComoLer = {}) {
    const guardado = (await lerParte<ParecerDoCaso>(c.id, 'parecer')) ?? { processoId: c.id, fichaId: c.ficha.id, analises: [], registros: [] }
    const quando = agora().toISOString()
    const roteiro = comLaudo(roteiroDoCaso(await roteirosDoBanco(banco), c.processo.beneficio, menorDe16(c.ficha.nascimento, hojeEmBrasilia(agora()))))
    const docs = await documentosMedicos(c)
    const anterior = guardado.analises.at(-1)
    // Com a IA ligada, quem não chama fica com a análise que já está pronta; desligada ou sem roteiro, não há o que chamar.
    if (!semChamar || !ia.ligada || !roteiro) {
      const sugestoes: NonNullable<Awaited<ReturnType<typeof lerComIa>>>[] = []
      const lidos: DocumentoLido[] = []
      for (const d of docs) {
        const lido = roteiro && ia.ligada ? await lerComIa(c, d, roteiro, quem, como) : null
        if (lido) sugestoes.push(lido)
        const leitura = lido ? { cobre: lido.cobre, contradiz: lido.contradiz, ...(lido.datas && { datas: lido.datas }) } : { cobre: {}, semIa: true as const }
        lidos.push({ id: d.id, tipo: NA_TELA[d.tipo] ?? d.tipo, data: d.dataEmissao ?? hojeEmBrasilia(d.criadoEm), ...(d.emitente && { emitente: d.emitente }), ...leitura })
      }
      const semIa = lidos.filter((l) => l.semIa).length
      const daIa = {
        ...(sugestoes.length && {
          ia: {
            modelo: sugestoes[0].sugestao.modelo,
            chamadas: sugestoes.map((x) => x.sugestao.chamadaId),
            alertas: [...new Set(sugestoes.flatMap((x) => x.alertas))],
            fontes: sugestoes.map((x) => x.sugestao.fontes[0]?.trecho ?? x.sugestao.fontes[0]?.referencia ?? ''),
          },
        }),
        ...(roteiro && semIa > 0 && { motivo: ia.ligada ? msgSemIa(semIa) : MSG_IA_DESLIGADA }),
      }
      const atual = montarAnalise(roteiro, lidos, anterior, quando, daIa)
      if (atual && atual !== anterior) {
        guardado.analises.push(atual)
        await gravarParte(c.id, 'parecer', guardado)
      }
    }
    // CA6: o laudo que chegou depois de um parecer espera a conferência do Jurídico (o mesmo que a conferência da Sênior vê).
    const naoConferidos = docs.filter((d) => !d.conferidoEm)
    const laudoNovoEm = guardado.registros.length && naoConferidos.length ? hojeEmBrasilia(naoConferidos[0].criadoEm) : undefined
    const p: ParecerDoCaso = { ...guardado, dispensas: await dispensas(c.id) }
    return { p, laudoNovoEm, naoConferidos: naoConferidos.map((d) => d.id), semRoteiro: roteiro === undefined }
  }

  /** Os casos com documento médico esperando o Jurídico: o preparo deixa a análise pronta antes de alguém abrir. */
  async function esperandoAnalise() {
    const linhas = await banco
      .selectDistinct({ casoId: documento.casoId })
      .from(documentoMedico)
      .innerJoin(documento, eq(documentoMedico.documentoId, documento.id))
      .where(and(isNull(documentoMedico.confirmadoEm), isNull(documento.excluidoEm), isNotNull(documento.casoId)))
    return linhas.flatMap((l) => (l.casoId ? [l.casoId] : []))
  }

  async function tela(c: CasoMedico, visao: Visao, ler: ComoLer = { semChamar: true }): Promise<ParecerNaTela> {
    const { p, laudoNovoEm, semRoteiro } = await emDia(c, ler)
    return naTela({ ficha: c.ficha, processo: { ...c.processo, ...(laudoNovoEm && { laudoNovoEm }) }, p, visao, semRoteiro, ...(laudoNovoEm && { laudoNovoEm }), hoje: hojeEmBrasilia(agora()) })
  }

  return { emDia, tela, esperandoAnalise, lerParte, gravarParte }
}

export function registrarRotasParecer(app: FastifyInstance, { banco, agora = () => new Date(), ia, armazenamento, preparo }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const bloqueio = registrarBloqueio(banco, agora)
  const { acharCaso, anotar, nomeDe } = criarCasoMedico(banco, agora)
  const { emDia, tela, esperandoAnalise, lerParte, gravarParte } = criarParecerDoCaso({ banco, agora, ia, armazenamento })

  // Sugestão pronta (GGVP-134): em segundo plano, a IA lê os documentos médicos que esperam o Jurídico; a tarefa "Dar
  // parecer médico" (ou "Analisar laudo novo") nasce da análise pronta, e a tela abre sem nova chamada.
  preparo.registrar(esperandoAnalise, async (casoId) => {
    const c = await acharCaso(casoId)
    if (c) await emDia(c, { quem: null, como: { soPreparar: true } })
  })

  /** A visão do perfil da sessão: só o Jurídico recebe o conteúdo clínico, e cada leitura fica registrada (GGVP-96 CA12, CA13). */
  async function visaoDe(pedido: FastifyRequest, casoId: string): Promise<Visao> {
    if (!pode(pedido.perfilAtivo, 'dado_saude.ver_detalhe')) return 'atendimento'
    await banco.insert(acessoDadoSensivel).values({ usuarioId: pedido.usuario!.id, perfil: pedido.perfilAtivo!, casoId, recurso: `parecer:${casoId}`, quando: agora() })
    return 'juridico'
  }

  app.get<{ Params: { id: string } }>('/api/processos/:id/parecer', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    // Só o Jurídico leva o laudo à IA ao abrir; os outros perfis veem o que já está pronto, sem conteúdo clínico.
    const visao = await visaoDe(pedido, c.id)
    return tela(c, visao, visao === 'juridico' ? { quem: pedido.usuario!.id } : { semChamar: true })
  })

  // CA3, CA5, CA6, CA8: só o Jurídico registra, conferindo cada item; a regra é a mesma da tela (G17, G18, G20).
  app.post<{ Params: { id: string } }>('/api/processos/:id/parecer', { preHandler: exigir(banco, 'parecer.registrar', agora) }, async (pedido, resposta) => {
    const entrada = PedidoDeParecer.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Parecer inválido.')
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const quem = pedido.usuario!.id
    const { p, laudoNovoEm, naoConferidos } = await emDia(c, { quem })
    const quando = agora()
    const r = registroDoPedido(p.analises.at(-1), entrada.data, await nomeDe(pedido), quando.toISOString(), laudoNovoEm)
    if ('motivo' in r) return negar(resposta, r.motivo.includes('análise mudou') ? 409 : 400, r.motivo)
    const { registro } = r
    const anterior = p.registros.at(-1)
    const { dispensas: _, ...guardar } = p
    await gravarParte(c.id, 'parecer', { ...guardar, registros: [...p.registros, registro] })
    await banco.insert(parecerMedico).values({
      casoId: c.id,
      roteiroVersao: registro.roteiro?.versao ?? 0,
      resultado: registro.situacao,
      itens: registro.itens.map(itemParaOPortal),
      // CA4: a decisão guarda as chamadas da IA que ela conferiu.
      sugestaoIa: p.analises.at(-1)?.ia ? { chamadas: p.analises.at(-1)!.ia!.chamadas } : null,
      confirmadoPor: quem,
      confirmadoEm: quando,
      criadoEm: quando,
    })
    // CA6: os documentos que a análise leu foram conferidos pelo Jurídico; o laudo novo sai da espera aqui e na conferência da Sênior.
    if (naoConferidos.length)
      await banco.update(documentoMedico).set({ confirmadoPor: quem, confirmadoEm: quando }).where(and(inArray(documentoMedico.documentoId, naoConferidos), isNull(documentoMedico.confirmadoEm)))
    // CA5: Insuficiente ou Contraditório abre (ou atualiza) o complemento ao médico; Suficiente encerra o que estava aberto.
    const complementos = (await lerParte<Complemento[]>(c.id, 'complemento')) ?? []
    await gravarParte(
      c.id,
      'complemento',
      registro.situacao === 'suficiente'
        ? encerrarNaLista(complementos, c.id, registro.quando)
        : abrirNaLista(complementos, {
            processoId: c.id,
            fichaId: c.ficha.id,
            abertaEm: registro.quando,
            parecer: registro.situacao,
            abordar: registro.abordar ?? '',
            perguntas: perguntasQueFaltam(registro),
            quem: registro.quem,
          }),
    )
    // Só o que aconteceu: o resultado e quantos itens a pessoa corrigiu, nunca o conteúdo clínico.
    const corrigidos = registro.itens.filter((i) => i.corrigido).length
    await anotar(
      c,
      `Registrou o parecer médico do ${nomeBeneficio(c.processo.beneficio)}: ${NOMES_DO_PARECER[registro.situacao]} (G17)${corrigidos > 0 ? `; corrigiu ${corrigidos} ${corrigidos === 1 ? 'item' : 'itens'} da IA` : ''}`,
      pedido,
    )
    if (laudoNovoEm)
      await anotar(c, `Conferiu o laudo novo de ${dataCurta(laudoNovoEm, hojeEmBrasilia(agora()))} e ${anterior?.situacao === registro.situacao ? 'manteve' : 'refez'} o parecer`, pedido)
    await historico(quem, 'parecer_registrado', pedido, `caso:${c.id}`, {
      situacao: registro.situacao,
      corrigidos,
      laudoNovo: Boolean(laudoNovoEm),
      manteve: anterior?.situacao === registro.situacao,
    })
    return resposta.code(201).send(await tela(c, 'juridico'))
  })

  const daSenior = { preHandler: exigir(banco, 'caso.aprovar_para_inss', agora) }

  // GGVP-33 CA2 (G17; Lucas, 01/10, Q14): a primeira Sênior pede a dispensa, com a justificativa.
  app.post<{ Params: { id: string } }>('/api/processos/:id/parecer/dispensa', daSenior, async (pedido, resposta) => {
    const entrada = DispensarParecer.safeParse(pedido.body)
    const motivo = entrada.success ? motivoParaNaoPedirDispensa(entrada.data.justificativa) : 'A justificativa é obrigatória: por que seguir sem a prova médica (G17).'
    if (motivo || !entrada.success) return negar(resposta, 400, motivo!)
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const { p } = await emDia(c, { semChamar: true })
    if (p.registros.at(-1)?.situacao === 'suficiente') return negar(resposta, 409, MSG_PARECER_JA_SUFICIENTE)
    if (dispensaEmVigor(p)) return negar(resposta, 409, MSG_JA_DISPENSADO)
    const ultima = p.dispensas?.at(-1)
    if (ultima && !ultima.aprovadaPor && !ultima.recusadaPor) return negar(resposta, 409, MSG_DISPENSA_ESPERANDO)
    const quem = pedido.usuario!.id
    await banco.insert(decisao).values({
      casoId: c.id,
      passo: 'D1.24',
      tipo: 'dispensa_parecer',
      resultado: 'pedida',
      justificativa: entrada.data.justificativa,
      decididoPor: quem,
      perfil: pedido.perfilAtivo!,
      decididoEm: agora(),
    })
    await anotar(c, `Pediu a dispensa do parecer médico (1ª aprovação da sênior, G17). Justificativa: ${entrada.data.justificativa}`, pedido)
    await historico(quem, 'dispensa_parecer_pedida', pedido, `caso:${c.id}`)
    return resposta.code(201).send(await tela(c, 'juridico'))
  })

  // A segunda Sênior, outra pessoa, aprova ou recusa. A mesma pessoa é recusada pelo portão, e a tentativa fica no histórico.
  app.post<{ Params: { id: string } }>('/api/processos/:id/parecer/dispensa/aprovacao', daSenior, async (pedido, resposta) => {
    const entrada = ResponderDispensa.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Escolha aprovar ou recusar.')
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const { p } = await emDia(c, { semChamar: true })
    const dispensa = p.dispensas?.at(-1)
    // Sem pedido esperando, ou já respondido: a regra da tela diz o motivo. A pessoa é conferida pelo id, nunca pelo nome.
    const motivo = motivoParaNaoAprovarDispensa(dispensa, '')
    if (motivo) return negar(resposta, 409, motivo)
    const quem = pedido.usuario!.id
    const [pedida] = await banco
      .select({ por: decisao.decididoPor })
      .from(decisao)
      .where(and(eq(decisao.casoId, c.id), eq(decisao.tipo, 'dispensa_parecer'), eq(decisao.resultado, 'pedida')))
      .orderBy(desc(decisao.decididoEm))
      .limit(1)
    if (pedida?.por === quem) {
      await bloqueio(pedido, c.id, 'G17', 'D1.24', { motivo: 'mesma_senior' }, 'dispensa_parecer_recusada')
      return negar(resposta, 409, motivoParaNaoAprovarDispensa(dispensa, dispensa!.pedidaPor)!)
    }
    const { aprova } = entrada.data
    await banco.transaction(async (tx) => {
      const base = { casoId: c.id, passo: 'D1.24', tipo: 'dispensa_parecer', decididoPor: quem, perfil: pedido.perfilAtivo!, decididoEm: agora() }
      await tx.insert(decisao).values({ ...base, resultado: aprova ? 'aprovada' : 'recusada' })
      if (aprova)
        await tx.insert(parecerMedico).values({
          casoId: c.id,
          roteiroVersao: 0,
          resultado: 'dispensado',
          justificativaDispensa: dispensa!.justificativa,
          confirmadoPor: quem,
          confirmadoEm: agora(),
          criadoEm: agora(),
        })
    })
    const nome = await nomeDe(pedido)
    await anotar(
      c,
      aprova
        ? `Aprovou a dispensa do parecer médico (2ª aprovação da sênior): dispensado por ${dispensa!.pedidaPor} e ${nome} (G17)`
        : `Recusou a dispensa do parecer médico pedida por ${dispensa!.pedidaPor}: o caso continua esperando o parecer (G17)`,
      pedido,
    )
    await historico(quem, aprova ? 'parecer_dispensado' : 'dispensa_parecer_negada', pedido, `caso:${c.id}`)
    return resposta.code(201).send(await tela(c, 'juridico'))
  })
}
