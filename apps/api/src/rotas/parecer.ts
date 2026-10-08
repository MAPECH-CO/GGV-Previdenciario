// O parecer de suficiência da documentação médica no servidor (GGVP-20 e GGVP-33, ligados pela GGVP-132). As rotas têm a
// forma da design.md da change ggvp-13 e as regras são as das telas (regras/parecerDoCaso.ts), rodando aqui com o perfil
// da sessão. A análise lê os documentos médicos do caso (`documento` e `documento_medico`); a IA ainda é simulada (a de
// verdade é da GGVP-134). O parecer só vale com a pessoa do Jurídico (G17); cada registro vai também para `parecer_medico`,
// que a conferência da Sênior e o portão das outras telas leem. A dispensa é de duas Sêniores diferentes, em `decisao`.
import { and, asc, desc, eq, inArray, isNull, ne, or } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { DispensarParecer, PedidoDeParecer, ResponderDispensa, pode, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, decisao, documento, documentoMedico, parecerMedico, usuario } from '../banco/esquema.ts'
import { MSG_CASO_NAO_ENCONTRADO, criarCasoMedico, type CasoMedico } from '../fluxo/documentacao-medica.ts'
import { exigir, registrarBloqueio, registrarHistorico } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { abrirNaLista, encerrarNaLista, type Complemento } from '../../../web/src/regras/complemento.ts'
import { menorDe16 } from '../../../web/src/regras/infantil.ts'
import { motivoParaNaoAprovarDispensa, motivoParaNaoPedirDispensa, type Dispensa } from '../../../web/src/regras/parecer.ts'
import {
  comLaudo,
  dispensaEmVigor,
  lerDocumentoSimulado,
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

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

/** O tipo do documento médico do servidor no catálogo das telas. */
const NA_TELA: Record<string, string> = { relatorio: 'relatorio-medico' }

/** Como o portal guarda cada registro em `parecer_medico`, o formato que a conferência da Sênior lê (sem trecho clínico). */
const itemParaOPortal = (i: { tipo: string; texto: string; situacao: string }) => ({
  item: i.texto,
  atendido: i.tipo === 'contradicao' ? i.situacao !== 'contraditorio' : i.situacao === 'presente',
})

/** O parecer do caso, comum ao parecer, ao complemento e às tarefas: a análise em dia, os registros e as dispensas. */
export function criarParecerDoCaso(banco: Banco, agora: () => Date) {
  const { lerParte, gravarParte } = criarCasoMedico(banco, agora)

  /** Os documentos médicos do caso (os do processo e os pessoais), com o que a IA simulada leu de cada um. */
  async function documentosMedicos(c: CasoMedico) {
    return banco
      .select({
        id: documento.id,
        arquivo: documento.nomeOriginal,
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

  /** O parecer com a análise em dia: se os documentos mudaram, nasce a análise nova com o roteiro em vigor (CA4). */
  async function emDia(c: CasoMedico) {
    const guardado = (await lerParte<ParecerDoCaso>(c.id, 'parecer')) ?? { processoId: c.id, fichaId: c.ficha.id, analises: [], registros: [] }
    const quando = agora().toISOString()
    const roteiro = comLaudo(roteiroDoCaso(await roteirosDoBanco(banco), c.processo.beneficio, menorDe16(c.ficha.nascimento, hojeEmBrasilia(agora()))))
    const docs = await documentosMedicos(c)
    const itens = roteiro ? roteiro.versoes.at(-1)!.itens : []
    const lidos: DocumentoLido[] = docs.map((d) => {
      const tipo = NA_TELA[d.tipo] ?? d.tipo
      return { id: d.id, tipo, data: d.dataEmissao ?? hojeEmBrasilia(d.criadoEm), ...(d.emitente && { emitente: d.emitente }), ...lerDocumentoSimulado({ tipo, arquivo: d.arquivo }, itens) }
    })
    const anterior = guardado.analises.at(-1)
    const atual = montarAnalise(roteiro, lidos, anterior, quando)
    if (atual && atual !== anterior) {
      guardado.analises.push(atual)
      await gravarParte(c.id, 'parecer', guardado)
    }
    // CA6: o laudo que chegou depois de um parecer espera a conferência do Jurídico (o mesmo que a conferência da Sênior vê).
    const naoConferidos = docs.filter((d) => !d.conferidoEm)
    const laudoNovoEm = guardado.registros.length && naoConferidos.length ? hojeEmBrasilia(naoConferidos[0].criadoEm) : undefined
    const p: ParecerDoCaso = { ...guardado, dispensas: await dispensas(c.id) }
    return { p, laudoNovoEm, naoConferidos: naoConferidos.map((d) => d.id), semRoteiro: roteiro === undefined }
  }

  async function tela(c: CasoMedico, visao: Visao): Promise<ParecerNaTela> {
    const { p, laudoNovoEm, semRoteiro } = await emDia(c)
    return naTela({ ficha: c.ficha, processo: { ...c.processo, ...(laudoNovoEm && { laudoNovoEm }) }, p, visao, semRoteiro, ...(laudoNovoEm && { laudoNovoEm }), hoje: hojeEmBrasilia(agora()) })
  }

  return { emDia, tela, lerParte, gravarParte }
}

export function registrarRotasParecer(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const bloqueio = registrarBloqueio(banco, agora)
  const { acharCaso } = criarCasoMedico(banco, agora)
  const { emDia, tela, lerParte, gravarParte } = criarParecerDoCaso(banco, agora)

  /** A visão do perfil da sessão: só o Jurídico recebe o conteúdo clínico, e cada leitura fica registrada (GGVP-96 CA12, CA13). */
  async function visaoDe(pedido: FastifyRequest, casoId: string): Promise<Visao> {
    if (!pode(pedido.perfilAtivo, 'dado_saude.ver_detalhe')) return 'atendimento'
    await banco.insert(acessoDadoSensivel).values({ usuarioId: pedido.usuario!.id, perfil: pedido.perfilAtivo!, casoId, recurso: `parecer:${casoId}`, quando: agora() })
    return 'juridico'
  }

  async function nomeDe(pedido: FastifyRequest) {
    const [u] = await banco.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, pedido.usuario!.id))
    return u?.nome ?? 'Alguém do Jurídico'
  }

  app.get<{ Params: { id: string } }>('/api/processos/:id/parecer', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    return tela(c, await visaoDe(pedido, c.id))
  })

  // CA3, CA5, CA6, CA8: só o Jurídico registra, conferindo cada item; a regra é a mesma da tela (G17, G18, G20).
  app.post<{ Params: { id: string } }>('/api/processos/:id/parecer', { preHandler: exigir(banco, 'parecer.registrar', agora) }, async (pedido, resposta) => {
    const entrada = PedidoDeParecer.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Parecer inválido.')
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const { p, laudoNovoEm, naoConferidos } = await emDia(c)
    const quem = pedido.usuario!.id
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
    await historico(quem, 'parecer_registrado', pedido, `caso:${c.id}`, {
      situacao: registro.situacao,
      corrigidos: registro.itens.filter((i) => i.corrigido).length,
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
    const { p } = await emDia(c)
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
    await historico(quem, 'dispensa_parecer_pedida', pedido, `caso:${c.id}`)
    return resposta.code(201).send(await tela(c, 'juridico'))
  })

  // A segunda Sênior, outra pessoa, aprova ou recusa. A mesma pessoa é recusada pelo portão, e a tentativa fica no histórico.
  app.post<{ Params: { id: string } }>('/api/processos/:id/parecer/dispensa/aprovacao', daSenior, async (pedido, resposta) => {
    const entrada = ResponderDispensa.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Escolha aprovar ou recusar.')
    const c = await acharCaso(pedido.params.id)
    if (!c) return negar(resposta, 404, MSG_CASO_NAO_ENCONTRADO)
    const { p } = await emDia(c)
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
    await historico(quem, aprova ? 'parecer_dispensado' : 'dispensa_parecer_negada', pedido, `caso:${c.id}`)
    return resposta.code(201).send(await tela(c, 'juridico'))
  })
}
