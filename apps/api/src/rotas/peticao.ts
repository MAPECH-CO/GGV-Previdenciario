// Petição inicial (GGVP-63, 67, 71): com os setores do despacho fechados, a advogada pede a petição e escreve a versão 1
// (sem IA até o épico IA jurídica); depois confere e aprova (G6, G18), e o pacote vai para o protocolo com as travas (G7).
import { createHash } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { AprovarPeticao, NovaVersao, PedirPeticao, PeticaoInicial, pode, type Erro } from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { caso, configuracao, decisao, documento, etapa, peticao, peticaoVersao, pessoa, protocoloJudicial, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { diferenca } from '../fluxo/diferenca.ts'
import { pdfDaImagem, pdfDaPeticao } from '../fluxo/pacote.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { guardarArquivo } from './formulario.ts'
import { situacaoDoDespacho } from './indeferimento.ts'

export const MSG_NADA_A_PEDIR = 'Este caso não está esperando o pedido da petição.'
export const MSG_JA_PEDIDA = 'A petição inicial deste caso já foi pedida.'
export const MSG_CITADO_DE_OUTRO_CASO = 'Um documento citado não é deste caso.'
export const MSG_SEM_PEDIDO = 'A petição inicial deste caso ainda não foi pedida.'
export const MSG_PROTOCOLADA = 'A petição já foi protocolada: não muda mais.'
export const MSG_SO_A_ULTIMA = 'Só a última versão pode ser aprovada.'
export const MSG_NADA_A_CONFERIR = 'Não há versão esperando a conferência.'

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date }
type Citado = { documentoId: string | null; nome: string }
/** Um arquivo do pacote, na ordem (GGVP-71 CA8): o documento, o nome, o hash do conteúdo e o papel no pacote. */
export type ArquivoDoPacote = { documentoId: string; nome: string; hash: string; papel: 'peticao' | 'carta' | 'citado' }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const hashDe = (conteudo: string | Buffer) => createHash('sha256').update(conteudo).digest('hex')

export function registrarRotasPeticao(app: FastifyInstance, { banco, armazenamento, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  const tarefaAberta = async (casoId: string, passo: string) =>
    (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, passo), isNull(tarefa.concluidaEm))).limit(1))[0] ?? null

  /** A petição inicial do caso (uma por caso). */
  const peticaoDo = async (casoId: string) =>
    (await banco.select().from(peticao).where(and(eq(peticao.casoId, casoId), eq(peticao.tipo, 'inicial'))).orderBy(desc(peticao.criadoEm)).limit(1))[0] ?? null

  const versoesDa = async (peticaoId: string) => banco.select().from(peticaoVersao).where(eq(peticaoVersao.peticaoId, peticaoId)).orderBy(asc(peticaoVersao.numero))

  /** Protocolada, a petição não muda mais (GGVP-71). */
  async function protocolada(peticaoId: string) {
    const [x] = await banco
      .select({ id: protocoloJudicial.id })
      .from(protocoloJudicial)
      .innerJoin(peticaoVersao, eq(protocoloJudicial.peticaoVersaoId, peticaoVersao.id))
      .where(eq(peticaoVersao.peticaoId, peticaoId))
      .limit(1)
    return Boolean(x)
  }

  /** A carta de indeferimento do caso: entra sempre (Tema 350, GGVP-63 CA9). */
  async function cartaDo(casoId: string) {
    const [c] = await banco
      .select({ id: documento.id, nome: documento.nomeOriginal })
      .from(resultadoInss)
      .innerJoin(documento, eq(resultadoInss.documentoId, documento.id))
      .where(and(eq(resultadoInss.casoId, casoId), eq(resultadoInss.resultado, 'indeferido')))
      .orderBy(desc(resultadoInss.criadoEm))
      .limit(1)
    return c ?? null
  }

  /**
   * GGVP-67 CA6 e GGVP-71 CA1, CA8, CA11: o pacote da versão aprovada, na ordem: a petição em PDF (texto aprovado,
   * assinatura padrão e o identificador da versão), a carta de indeferimento e os citados. PDF entra como está; imagem
   * vira PDF; o que não se lê do armazenamento fica de fora, e a trava "pacote completo" acusa. Guarda o hash de cada um.
   */
  async function gerarPacote(casoId: string, peticaoId: string, quem: string) {
    const v = (await versoesDa(peticaoId)).findLast((x) => x.aprovadaPor)
    if (!v) return
    const [p] = await banco.select().from(peticao).where(eq(peticao.id, peticaoId))
    const [conf] = await banco.select().from(configuracao).where(eq(configuracao.chave, 'peticao.assinatura'))
    const assinatura = typeof conf?.valor === 'string' ? conf.valor : 'Assinatura padrão do escritório (a configurar)'
    const guardar = async (conteudo: Buffer, nome: string) => {
      const dados = await guardarArquivo(armazenamento, casoId, { conteudo, mime: 'application/pdf', nome }, 'pacote-peticao')
      const [d] = await banco.insert(documento).values({ casoId, tipo: 'pacote_peticao', origem: 'portal', recebidoPor: quem, ...dados }).returning()
      return d
    }
    const arquivos: ArquivoDoPacote[] = []
    const peca = await guardar(Buffer.from(await pdfDaPeticao(v.conteudo, assinatura, v.hash)), `peticao-inicial-v${v.numero}.pdf`)
    arquivos.push({ documentoId: peca.id, nome: peca.nomeOriginal, hash: peca.hashSha256, papel: 'peticao' })
    const carta = await cartaDo(casoId)
    const outros: [ArquivoDoPacote['papel'], string][] = [
      ...(carta ? [['carta', carta.id] as [ArquivoDoPacote['papel'], string]] : []),
      ...((p?.citados ?? []) as Citado[]).flatMap((c) => (c.documentoId ? [['citado', c.documentoId] as [ArquivoDoPacote['papel'], string]] : [])),
    ]
    for (const [papel, id] of outros) {
      const [d] = await banco.select().from(documento).where(eq(documento.id, id))
      let conteudo: Buffer
      try {
        conteudo = await armazenamento.ler(d.chaveArmazenamento)
      } catch {
        continue
      }
      if (d.mime === 'application/pdf') {
        arquivos.push({ documentoId: d.id, nome: d.nomeOriginal, hash: hashDe(conteudo), papel })
        continue
      }
      try {
        const pdf = await guardar(Buffer.from(await pdfDaImagem(conteudo, d.mime)), `${d.nomeOriginal.replace(/\.[^.]+$/, '')}.pdf`)
        arquivos.push({ documentoId: pdf.id, nome: pdf.nomeOriginal, hash: pdf.hashSha256, papel })
      } catch {
        // Imagem que não abre: fica de fora, e a trava "pacote completo" acusa.
      }
    }
    await banco.update(peticaoVersao).set({ pacote: arquivos, pacoteGeradoEm: agora() }).where(eq(peticaoVersao.id, v.id))
  }

  // GGVP-63 CA1, CA6, CA9: quem falta, a carta, os documentos para citar, o pedido, as versões e a atual inteira.
  app.get<{ Params: { id: string } }>('/api/casos/:id/peticao', { preHandler: exigir(banco, 'peticao.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const [c] = await banco.select({ nome: pessoa.nome, beneficio: caso.beneficio }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    const { faltam } = await situacaoDoDespacho(banco, casoId)
    const carta = await cartaDo(casoId)
    const documentos = await banco
      .select({ id: documento.id, nome: documento.nomeOriginal })
      .from(documento)
      .where(and(eq(documento.casoId, casoId), isNull(documento.excluidoEm), ne(documento.tipo, 'pacote_peticao')))
      .orderBy(asc(documento.criadoEm))
    const p = await peticaoDo(casoId)
    const versoes = p ? await versoesDa(p.id) : []
    const ids = [p?.pedidaPor, ...versoes.map((v) => v.aprovadaPor)].filter((x): x is string => Boolean(x))
    const nomes = new Map(ids.length ? (await banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, ids))).map((u) => [u.id, u.nome]) : [])
    const ultima = versoes.at(-1)
    const anterior = versoes.at(-2)
    const advogada = pode(pedido.perfilAtivo, 'peticao.aprovar')
    const fechada = p ? await protocolada(p.id) : false
    return PeticaoInicial.parse({
      casoId,
      cliente: c.nome,
      beneficio: c.beneficio,
      faltam,
      carta,
      documentos: documentos.filter((d) => d.id !== carta?.id),
      pedido: p
        ? { por: nomes.get(p.pedidaPor ?? '') ?? '—', em: p.criadoEm.toISOString(), instrucoes: p.instrucoes ?? '', opcoes: p.opcoes ?? {}, citados: p.citados ?? [] }
        : null,
      versoes: versoes.map((v) => ({
        numero: v.numero,
        por: v.geradaPor,
        em: v.criadoEm.toISOString(),
        oQueMudou: v.pedidoDeMudanca,
        hash: v.hash,
        aprovadaPor: v.aprovadaPor ? (nomes.get(v.aprovadaPor) ?? '—') : null,
        aprovadaEm: v.aprovadaEm?.toISOString() ?? null,
      })),
      atual: ultima ? { numero: ultima.numero, texto: ultima.conteudo, diferenca: anterior ? diferenca(anterior.conteudo, ultima.conteudo) : null } : null,
      podePedir: pode(pedido.perfilAtivo, 'peticao.pedir') && !p && Boolean(await tarefaAberta(casoId, 'D3.05')),
      podeEditar: advogada && Boolean(p) && !fechada,
      podeAprovar: advogada && Boolean(ultima && !ultima.aprovadaPor) && !fechada && Boolean(await tarefaAberta(casoId, 'D3.06')),
    })
  })

  // GGVP-63 CA1, CA2, CA6, CA9, CA10: só com os setores fechados; grava o pedido e a versão 1 escrita pela advogada, que
  // vai para a conferência (GGVP-67).
  app.post<{ Params: { id: string } }>('/api/casos/:id/peticao/pedido', { preHandler: exigir(banco, 'peticao.pedir', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = PedirPeticao.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o pedido.')
    const aguardando = await tarefaAberta(casoId, 'D3.05')
    if (!aguardando) return negar(resposta, 409, MSG_NADA_A_PEDIR)
    if (await peticaoDo(casoId)) return negar(resposta, 409, MSG_JA_PEDIDA)
    const { faltam } = await situacaoDoDespacho(banco, casoId)
    if (faltam.length) return negar(resposta, 409, `Pedir a petição fica bloqueado até todos os setores subirem o card. Falta: ${faltam.join(', ')}.`)
    const d = entrada.data
    // CA6: os citados são documentos deste caso, na ordem do pedido, ou o nome do que ainda falta.
    const ids = [...new Set(d.citados.flatMap((x) => (x.documentoId ? [x.documentoId] : [])))]
    const docs = ids.length
      ? await banco
          .select({ id: documento.id, nome: documento.nomeOriginal })
          .from(documento)
          .where(and(eq(documento.casoId, casoId), inArray(documento.id, ids), isNull(documento.excluidoEm)))
      : []
    if (docs.length !== ids.length) return negar(resposta, 400, MSG_CITADO_DE_OUTRO_CASO)
    const citados: Citado[] = d.citados.map((x) => (x.documentoId ? { documentoId: x.documentoId, nome: docs.find((y) => y.id === x.documentoId)!.nome } : { documentoId: null, nome: x.nome }))
    const quem = pedido.usuario!.id
    const [u] = await banco.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, quem))
    const fechar = { situacao: 'concluida' as const, concluidaEm: agora(), concluidaPor: quem }
    const hash = hashDe(d.texto)
    const feito = await banco.transaction(async (tx) => {
      const [t] = await tx
        .update(tarefa)
        .set(fechar)
        .where(and(eq(tarefa.id, aguardando.id), isNull(tarefa.concluidaEm)))
        .returning()
      if (!t) return false
      // CA9: as instruções e as opções ficam registradas; sem IA, a versão 1 é a que a advogada escreveu.
      const [p] = await tx.insert(peticao).values({ casoId, tipo: 'inicial', pedidaPor: quem, instrucoes: d.instrucoes, opcoes: d.opcoes, citados, criadoEm: agora() }).returning()
      await tx.insert(peticaoVersao).values({ peticaoId: p.id, numero: 1, conteudo: d.texto, hash, geradaPor: u?.nome ?? 'advogada', criadoEm: agora() })
      await tx
        .update(etapa)
        .set(fechar)
        .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D3.05'), isNull(etapa.concluidaEm)))
      // CA10: a versão vai para a conferência; nenhuma é protocolada sem ela.
      await tx.insert(etapa).values({ casoId, diagrama: 'D3', passo: 'D3.06', situacao: 'aberta', iniciadaEm: agora() })
      await tx.insert(tarefa).values({ casoId, passo: 'D3.06', titulo: 'Conferir petição', perfilDono: 'advogada', criadoEm: agora() })
      return true
    })
    if (!feito) return negar(resposta, 409, MSG_NADA_A_PEDIR)
    await historico(quem, 'peticao_pedida', pedido, `caso:${casoId}`, { versao: 1, hash, citados: citados.length })
    return resposta.code(201).send({ ok: true })
  })

  // GGVP-67 CA1, CA5, CA7, CA10: "Editar eu mesma" grava a versão seguinte, numerada, com o que mudou; as anteriores ficam.
  // Depois da aprovação, a aprovada não muda: a nova volta para a conferência, e o protocolo espera (CA7).
  app.post<{ Params: { id: string } }>('/api/casos/:id/peticao/versoes', { preHandler: exigir(banco, 'peticao.aprovar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = NovaVersao.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira a versão.')
    const p = await peticaoDo(casoId)
    if (!p) return negar(resposta, 409, MSG_SEM_PEDIDO)
    if (await protocolada(p.id)) return negar(resposta, 409, MSG_PROTOCOLADA)
    const ultima = (await versoesDa(p.id)).at(-1)!
    const quem = pedido.usuario!.id
    const [u] = await banco.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, quem))
    const numero = ultima.numero + 1
    const hash = hashDe(entrada.data.texto)
    const depoisDaAprovacao = Boolean(ultima.aprovadaPor)
    await banco.transaction(async (tx) => {
      await tx.insert(peticaoVersao).values({ peticaoId: p.id, numero, conteudo: entrada.data.texto, hash, geradaPor: u?.nome ?? 'advogada', pedidoDeMudanca: entrada.data.oQueMudou, criadoEm: agora() })
      if (!depoisDaAprovacao) return
      // CA7: o protocolo da aprovada é cancelado e a conferência volta, com a versão nova.
      const cancelar = { situacao: 'cancelada' as const, concluidaEm: agora(), concluidaPor: quem }
      await tx
        .update(tarefa)
        .set(cancelar)
        .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3.07'), isNull(tarefa.concluidaEm)))
      await tx
        .update(etapa)
        .set(cancelar)
        .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D3.07'), isNull(etapa.concluidaEm)))
      const [conferindo] = await tx
        .select({ id: tarefa.id })
        .from(tarefa)
        .where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3.06'), isNull(tarefa.concluidaEm)))
      if (!conferindo) {
        await tx.insert(etapa).values({ casoId, diagrama: 'D3', passo: 'D3.06', situacao: 'aberta', iniciadaEm: agora() })
        await tx.insert(tarefa).values({ casoId, passo: 'D3.06', titulo: 'Conferir petição', perfilDono: 'advogada', criadoEm: agora() })
      }
    })
    await historico(quem, depoisDaAprovacao ? 'peticao_versao_apos_aprovacao' : 'peticao_versao_nova', pedido, `caso:${casoId}`, {
      numero,
      hash,
      aprovada: depoisDaAprovacao ? ultima.numero : null,
    })
    return resposta.code(201).send({ ok: true, numero })
  })

  // GGVP-67 CA2, CA5, CA6, CA8, CA9 (G6, G18): só a advogada aprova a última versão, com as três marcações; fica quem
  // aprovou, quando e o identificador do conteúdo (o hash), e o protocolo abre.
  app.post<{ Params: { id: string; n: string } }>(
    '/api/casos/:id/peticao/versoes/:n/aprovacao',
    { preHandler: exigir(banco, 'peticao.aprovar', agora) },
    async (pedido, resposta) => {
      const casoId = pedido.params.id
      const entrada = AprovarPeticao.safeParse(pedido.body)
      if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira as marcações.')
      const p = await peticaoDo(casoId)
      if (!p) return negar(resposta, 409, MSG_SEM_PEDIDO)
      if (await protocolada(p.id)) return negar(resposta, 409, MSG_PROTOCOLADA)
      const ultima = (await versoesDa(p.id)).at(-1)!
      if (String(ultima.numero) !== pedido.params.n) return negar(resposta, 409, MSG_SO_A_ULTIMA)
      const conferindo = await tarefaAberta(casoId, 'D3.06')
      if (ultima.aprovadaPor || !conferindo) return negar(resposta, 409, MSG_NADA_A_CONFERIR)
      const quem = pedido.usuario!.id
      const fechar = { situacao: 'concluida' as const, concluidaEm: agora(), concluidaPor: quem }
      const feito = await banco.transaction(async (tx) => {
        const [v] = await tx
          .update(peticaoVersao)
          .set({ aprovadaPor: quem, aprovadaEm: agora() })
          .where(and(eq(peticaoVersao.id, ultima.id), isNull(peticaoVersao.aprovadaPor)))
          .returning()
        if (!v) return false
        await tx.insert(decisao).values({
          casoId,
          passo: 'D3.06',
          tipo: 'aprovacao_peticao',
          resultado: `versao ${ultima.numero}`,
          justificativa: 'Li a petição na íntegra; fundamentos, pedidos e valores conferem com o caso; nada contradiz o requisito do benefício (G18).',
          decididoPor: quem,
          perfil: pedido.perfilAtivo!,
          decididoEm: agora(),
        })
        await tx.update(tarefa).set(fechar).where(eq(tarefa.id, conferindo.id))
        await tx
          .update(etapa)
          .set(fechar)
          .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D3.06'), isNull(etapa.concluidaEm)))
        await tx.insert(etapa).values({ casoId, diagrama: 'D3', passo: 'D3.07', situacao: 'aberta', iniciadaEm: agora() })
        await tx.insert(tarefa).values({ casoId, passo: 'D3.07', titulo: 'Protocolar na Justiça', perfilDono: 'advogada', criadoEm: agora() })
        return true
      })
      if (!feito) return negar(resposta, 409, MSG_NADA_A_CONFERIR)
      await historico(quem, 'peticao_aprovada', pedido, `caso:${casoId}`, { versao: ultima.numero, hash: ultima.hash })
      // CA6: aprovada, o sistema gera o pacote do protocolo. Se o armazenamento falhar, a aprovação fica; o pacote é gerado
      // de novo na tela do protocolo (GGVP-71 CA13).
      try {
        await gerarPacote(casoId, p.id, quem)
      } catch {
        await historico(quem, 'pacote_nao_gerado', pedido, `caso:${casoId}`, { versao: ultima.numero })
      }
      return resposta.code(201).send({ ok: true })
    },
  )
}

