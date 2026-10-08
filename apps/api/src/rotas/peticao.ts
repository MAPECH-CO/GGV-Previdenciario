// Petição inicial (GGVP-63, 67, 71): com os setores do despacho fechados, a advogada pede a petição e a versão 1 (escrita
// por ela ou a partir da minuta da IA, épico GGVP-14); depois confere e aprova (G6, G18), e o pacote vai para o protocolo
// com as travas (G7).
import { createHash } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { AprovarPeticao, MinutaDaIa, NovaVersao, PedirMinuta, PedirOutraVersao, PedirPeticao, PeticaoInicial, ProtocolarPeticao, ROTULO_BENEFICIO, pode, type Beneficio, type Erro, type FonteDaIa } from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { caso, configuracao, decisao, documento, etapa, exigencia, exigenciaItem, identificadorCaso, parecerMedico, peticao, peticaoVersao, pessoa, protocoloJudicial, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { diferenca } from '../fluxo/diferenca.ts'
import { lembreteDoLaco, limitesDeCobranca } from '../fluxo/exigencia.ts'
import { fonteDoJuizo, juizoDoCaso, jurimetriaDoJuizo } from '../fluxo/juizo.ts'
import { MSG_SEM_REFERENCIA, buscarNoAcervo } from '../ia/acervo.ts'
import { pdfDaImagem, pdfDaPeticao, type ArquivoDoPacote } from '../fluxo/pacote.ts'
import { FINALIDADES, type ComoSugerir, type Ia } from '../ia/ia.ts'
import { casosComTarefaAberta, type Preparo } from '../ia/preparo.ts'
import { travaCpf, travaPacote, travaTema350, type Tribunal } from '../fluxo/travas.ts'
import { exigir, registrarBloqueio, registrarHistorico } from '../sessao/rotas.ts'
import { TIPOS_DE_ANEXO, guardarArquivo, lerFormulario } from './formulario.ts'
import { situacaoDoDespacho } from './indeferimento.ts'
import { MSG_COMPROVANTE } from './manifestacao.ts'

export const MSG_NADA_A_PEDIR = 'Este caso não está esperando o pedido da petição.'
export const MSG_JA_PEDIDA = 'A petição inicial deste caso já foi pedida.'
export const MSG_CITADO_DE_OUTRO_CASO = 'Um documento citado não é deste caso.'
export const MSG_SEM_PEDIDO = 'A petição inicial deste caso ainda não foi pedida.'
export const MSG_PROTOCOLADA = 'A petição já foi protocolada: não muda mais.'
export const MSG_SO_A_ULTIMA = 'Só a última versão pode ser aprovada.'
export const MSG_NADA_A_CONFERIR = 'Não há versão esperando a conferência.'
export const MSG_CITADO_NAO_FALTA = 'Este documento citado não está faltando.'
export const MSG_DOCUMENTO_QUE_FALTA = 'Anexe o documento (PDF ou imagem, até 25 MB) ou escolha um documento do caso.'
export const MSG_NADA_A_PROTOCOLAR = 'Não há petição aprovada esperando o protocolo.'
export const MSG_CNJ_DE_OUTRO_CASO = 'Este número de processo já está em outro caso.'

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date; ia: Ia; preparo: Preparo }
/** Um citado no pedido; o que falta pode ter sido pedido à Documentação (`itemId`, GGVP-71 CA13). */
type Citado = { documentoId: string | null; nome: string; itemId?: string }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const hashDe = (conteudo: string | Buffer) => createHash('sha256').update(conteudo).digest('hex')
const hoje = (agora: Date) => new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)
const ehTribunal = (t: unknown): t is Tribunal =>
  typeof t === 'object' && t !== null && typeof (t as Tribunal).nome === 'string' && typeof (t as Tribunal).site === 'string' && typeof (t as Tribunal).tamanhoMaximoMb === 'number'

/** Os tribunais da configuração do escritório (resposta do revisor de 06/10, Q8). */
export async function tribunaisDa(banco: Banco): Promise<Tribunal[]> {
  const [c] = await banco.select().from(configuracao).where(eq(configuracao.chave, 'tribunais'))
  return Array.isArray(c?.valor) ? c.valor.filter(ehTribunal) : []
}

export function registrarRotasPeticao(app: FastifyInstance, { banco, armazenamento, agora = () => new Date(), ia, preparo }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const bloqueio = registrarBloqueio(banco, agora)

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

  /** Os documentos que o pedido pode citar, na ordem em que chegaram, sem a carta (que entra sempre) e sem o pacote. */
  async function documentosDoPedido(casoId: string) {
    const carta = await cartaDo(casoId)
    const documentos = await banco
      .select({ id: documento.id, nome: documento.nomeOriginal })
      .from(documento)
      .where(and(eq(documento.casoId, casoId), isNull(documento.excluidoEm), ne(documento.tipo, 'pacote_peticao')))
      .orderBy(asc(documento.criadoEm))
    return { carta, documentos: documentos.filter((d) => d.id !== carta?.id) }
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
    arquivos.push({ documentoId: peca.id, origemId: peca.id, nome: peca.nomeOriginal, hash: peca.hashSha256, papel: 'peticao' })
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
        arquivos.push({ documentoId: d.id, origemId: d.id, nome: d.nomeOriginal, hash: hashDe(conteudo), papel })
        continue
      }
      try {
        const pdf = await guardar(Buffer.from(await pdfDaImagem(conteudo, d.mime)), `${d.nomeOriginal.replace(/\.[^.]+$/, '')}.pdf`)
        arquivos.push({ documentoId: pdf.id, origemId: d.id, nome: pdf.nomeOriginal, hash: pdf.hashSha256, papel })
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
    const { carta, documentos } = await documentosDoPedido(casoId)
    const p = await peticaoDo(casoId)
    const versoes = p ? await versoesDa(p.id) : []
    const ids = [p?.pedidaPor, ...versoes.map((v) => v.aprovadaPor)].filter((x): x is string => Boolean(x))
    const nomes = new Map(ids.length ? (await banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, ids))).map((u) => [u.id, u.nome]) : [])
    const ultima = versoes.at(-1)
    const anterior = versoes.at(-2)
    const advogada = pode(pedido.perfilAtivo, 'peticao.aprovar')
    const fechada = p ? await protocolada(p.id) : false
    // GGVP-71: o pacote da versão aprovada e as travas (G7), com o primeiro tribunal da configuração para o tamanho.
    const aprovada = versoes.findLast((v) => v.aprovadaPor)
    const pacote = (aprovada?.pacote ?? null) as ArquivoDoPacote[] | null
    const tribunais = await tribunaisDa(banco)
    const citados = (p?.citados ?? []) as Citado[]
    const travas = aprovada ? await travasDa(casoId, aprovada, citados, tribunais[0] ?? null) : []
    const [prot] = p
      ? await banco
          .select({ protocolo: protocoloJudicial, versao: peticaoVersao.numero, por: usuario.nome })
          .from(protocoloJudicial)
          .innerJoin(peticaoVersao, eq(protocoloJudicial.peticaoVersaoId, peticaoVersao.id))
          .innerJoin(usuario, eq(protocoloJudicial.protocoladoPor, usuario.id))
          .where(eq(peticaoVersao.peticaoId, p.id))
          .limit(1)
      : []
    return PeticaoInicial.parse({
      casoId,
      cliente: c.nome,
      beneficio: c.beneficio,
      faltam,
      carta,
      documentos,
      pedido: p
        ? {
            por: nomes.get(p.pedidaPor ?? '') ?? '—',
            em: p.criadoEm.toISOString(),
            instrucoes: p.instrucoes ?? '',
            opcoes: p.opcoes ?? {},
            citados: citados.map((c) => ({ documentoId: c.documentoId, nome: c.nome, pedidoADocumentacao: Boolean(c.itemId) })),
          }
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
      pacote: pacote?.map((a) => ({ documentoId: a.documentoId, nome: a.nome, papel: a.papel })) ?? null,
      travas,
      tribunais,
      protocolo: prot
        ? { em: prot.protocolo.protocoladoEm.toISOString(), numero: prot.protocolo.numero ?? '', tribunal: prot.protocolo.tribunal, por: prot.por, versao: prot.versao }
        : null,
      podeProtocolar: pode(pedido.perfilAtivo, 'peticao.protocolar') && !fechada && Boolean(aprovada) && Boolean(await tarefaAberta(casoId, 'D3.07')),
    })
  })

  // Épico IA (GGVP-63): a IA escreve a versão 1 com o que o caso já tem, e devolve como sugestão, com as fontes. Não grava
  // nada: a advogada revisa e pede a petição pela rota do pedido (G6). Sugestão pronta (07/10): com os setores fechados,
  // a minuta fica pronta em segundo plano com o padrão do pedido, o mesmo que a tela abre marcado; "Escrever de novo com
  // a IA" manda `refazer`.
  app.post<{ Params: { id: string } }>('/api/casos/:id/peticao/minuta', { preHandler: exigir(banco, 'peticao.pedir', agora) }, async (pedido, resposta) => {
    const entrada = PedirMinuta.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o pedido.')
    const r = await escreverMinuta(pedido.params.id, pedido.usuario!.id, entrada.data, { refazer: entrada.data.refazer })
    return 'erro' in r ? negar(resposta, r.status, r.erro) : r
  })
  preparo.registrar(
    () => casosComTarefaAberta(banco, 'D3.05'),
    async (casoId) => escreverMinuta(casoId, null, await pedidoPadrao(casoId), { soPreparar: true }),
  )

  /** O padrão do pedido, o mesmo que a tela abre marcado: todos os documentos (a carta entra sempre), o acervo, sem instruções. */
  async function pedidoPadrao(casoId: string) {
    const { documentos } = await documentosDoPedido(casoId)
    return PedirMinuta.parse({ opcoes: { precedentes: true }, citados: documentos.map((x) => ({ documentoId: x.id })) })
  }

  async function escreverMinuta(casoId: string, quem: string | null, d: ReturnType<typeof PedirMinuta.parse>, como: ComoSugerir = {}): Promise<MinutaDaIa | { status: number; erro: string }> {
    if (!(await tarefaAberta(casoId, 'D3.05'))) return { status: 409, erro: MSG_NADA_A_PEDIR }
    if (await peticaoDo(casoId)) return { status: 409, erro: MSG_JA_PEDIDA }
    const [c] = await banco.select({ nome: pessoa.nome, beneficio: caso.beneficio }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
    if (!c) return { status: 404, erro: 'Caso não encontrado.' }
    const [indeferido] = await banco
      .select()
      .from(resultadoInss)
      .where(and(eq(resultadoInss.casoId, casoId), eq(resultadoInss.resultado, 'indeferido')))
      .orderBy(desc(resultadoInss.criadoEm))
      .limit(1)
    const [parecer] = await banco.select().from(parecerMedico).where(eq(parecerMedico.casoId, casoId)).orderBy(desc(parecerMedico.criadoEm)).limit(1)
    const { itens, faltam } = await situacaoDoDespacho(banco, casoId)
    if (faltam.length) return { status: 409, erro: `A minuta espera todos os setores subirem o card. Falta: ${faltam.join(', ')}.` }
    const ids = d.citados.flatMap((x) => (x.documentoId ? [x.documentoId] : []))
    const docs = ids.length
      ? await banco.select({ id: documento.id, nome: documento.nomeOriginal }).from(documento).where(and(eq(documento.casoId, casoId), inArray(documento.id, ids)))
      : []
    if (docs.length !== new Set(ids).size) return { status: 400, erro: MSG_CITADO_DE_OUTRO_CASO }
    const citados = d.citados.map((x) => (x.documentoId ? docs.find((y) => y.id === x.documentoId)!.nome : `${x.nome} (ainda falta)`))
    const motivo = indeferido?.motivoEscrito ?? indeferido?.motivoIndeferimento ?? null
    const itensDoParecer = ((parecer?.itens as { item: string; atendido: boolean }[] | null) ?? []).map((i) => `${i.item}: ${i.atendido ? 'atendido' : 'não atendido'}`)
    // GGVP-45 CA1, CA2: com "usar precedentes", o acervo é consultado antes de escrever, pelo motivo, provas e instruções.
    const acervo = d.opcoes.precedentes
      ? await buscarNoAcervo(banco, { casoId, beneficio: c.beneficio, consulta: [motivo, ...itens.map((i) => i.item.descricao), d.instrucoes].filter(Boolean).join(' '), saude: FINALIDADES.minuta_peticao.saude, ia })
      : []
    const conteudo = [
      `Cliente (autor): ${c.nome}`,
      `Benefício pedido: ${c.beneficio ? (ROTULO_BENEFICIO[c.beneficio as Beneficio] ?? c.beneficio) : '[completar]'}`,
      `Indeferimento do INSS: ${indeferido ? `decisão de ${indeferido.dataDecisao}; motivo: ${motivo ?? '[completar]'}` : '[completar: carta de indeferimento]'}`,
      `Provas que o escritório reuniu para rebater o indeferimento: ${itens.length ? itens.map((i) => i.item.descricao).join('; ') : 'nenhuma registrada'}`,
      `Parecer médico: ${parecer ? `${parecer.resultado}${itensDoParecer.length ? ` (${itensDoParecer.join('; ')})` : ''}${parecer.justificativaDispensa ? `; dispensado: ${parecer.justificativaDispensa}` : ''}` : 'não há'}`,
      `Documentos citados, na ordem: ${citados.length ? citados.join('; ') : 'nenhum'}`,
      `Tutela de urgência: ${d.opcoes.tutelaUrgencia ? 'pedir' : 'não pedir'}`,
      `Instruções da advogada: ${d.instrucoes || 'nenhuma'}`,
      ...(acervo.length ? ['Trechos do acervo da casa (outros casos; só a tese serve, nunca os fatos de outro cliente):', ...acervo.map((a) => `- ${a.trecho}`)] : []),
    ].join('\n')
    const fontes: FonteDaIa[] = [
      ...docs.map((x) => ({ tipo: 'documento' as const, referencia: `documento:${x.id}`, trecho: x.nome })),
      ...(indeferido ? [{ tipo: 'caso' as const, referencia: `indeferimento:${indeferido.id}`, trecho: motivo ?? undefined }] : []),
      ...(parecer ? [{ tipo: 'caso' as const, referencia: `parecer:${parecer.id}`, trecho: parecer.resultado }] : []),
      ...acervo,
    ]
    const aviso = d.opcoes.precedentes && !acervo.length ? MSG_SEM_REFERENCIA : null
    const s = await ia.sugerir('minuta_peticao', { casoId, quem, conteudo, fontes }, como)
    // GGVP-64 CA3, CA6: a jurimetria do juízo vai às fontes da advogada, depois do modelo. O modelo não recebe esses números,
    // então eles não entram no texto que vai ao juiz. Antes do protocolo o caso costuma não ter número, e a fonte não vem.
    const juizo = s ? await juizoDoCaso(banco, casoId) : null
    const doJuizo = juizo ? fonteDoJuizo(await jurimetriaDoJuizo(banco, juizo, agora()), c.beneficio) : null
    const sugestao = s && doJuizo ? { ...s, fontes: [...s.fontes, doJuizo] } : s
    return MinutaDaIa.parse({ sugestao, motivo: s ? null : 'A IA não escreveu agora: escreva ou cole a versão 1.', aviso })
  }

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
    if (faltam.length) {
      await bloqueio(pedido, casoId, 'setores', 'D3.05', { faltam: faltam.length })
      return negar(resposta, 409, `Pedir a petição fica bloqueado até todos os setores subirem o card. Falta: ${faltam.join(', ')}.`)
    }
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
      // Épico IA: a versão 1 que partiu da minuta da IA fica marcada (a advogada revisou e pediu).
      const geradaPor = `${u?.nome ?? 'advogada'}${d.chamadaIaId ? ' · minuta da IA' : ''}`
      await tx.insert(peticaoVersao).values({ peticaoId: p.id, numero: 1, conteudo: d.texto, hash, geradaPor, criadoEm: agora() })
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
    await historico(quem, 'peticao_pedida', pedido, `caso:${casoId}`, { versao: 1, hash, citados: citados.length, chamadaIa: d.chamadaIaId ?? null })
    return resposta.code(201).send({ ok: true })
  })

  // Épico IA (GGVP-67 CA1, CA5): "Não está boa": a IA reescreve a última versão com o que mudar. Não grava: o texto vai
  // para a caixa da nova versão, e a advogada salva pela rota das versões (G6).
  app.post<{ Params: { id: string } }>('/api/casos/:id/peticao/versoes/sugestao', { preHandler: exigir(banco, 'peticao.aprovar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = PedirOutraVersao.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Escreva o que mudar')
    const p = await peticaoDo(casoId)
    if (!p) return negar(resposta, 409, MSG_SEM_PEDIDO)
    if (await protocolada(p.id)) return negar(resposta, 409, MSG_PROTOCOLADA)
    const ultima = (await versoesDa(p.id)).at(-1)!
    const conteudo = [`Pedido da advogada: ${entrada.data.oQueMudar}`, `Última versão (${ultima.numero}):`, ultima.conteudo].join('\n')
    const fontes: FonteDaIa[] = [{ tipo: 'caso', referencia: `peticao_versao:${ultima.id}`, trecho: `Versão ${ultima.numero}` }]
    // Pedido explícito de outra versão: chama a IA de novo, mesmo com o mesmo pedido (sugestão pronta, 07/10).
    const s = await ia.sugerir('nova_versao_peticao', { casoId, quem: pedido.usuario!.id, conteudo, fontes }, { refazer: true })
    return MinutaDaIa.parse({ sugestao: s, motivo: s ? null : 'A IA não escreveu agora: edite você mesma.', aviso: null })
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
      // Épico IA (GGVP-67 CA1): a versão que partiu da sugestão sai marcada, como a versão 1 da minuta.
      const geradaPor = `${u?.nome ?? 'advogada'}${entrada.data.chamadaIaId ? ' · versão da IA' : ''}`
      await tx.insert(peticaoVersao).values({ peticaoId: p.id, numero, conteudo: entrada.data.texto, hash, geradaPor, pedidoDeMudanca: entrada.data.oQueMudou, criadoEm: agora() })
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
      chamadaIa: entrada.data.chamadaIaId ?? null,
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

  /** As três travas (G7) da versão aprovada, com o tamanho de arquivo do tribunal dado (GGVP-71 CA2, CA6, CA7, CA11). */
  async function travasDa(casoId: string, aprovada: typeof peticaoVersao.$inferSelect, citados: Citado[], tribunal: Tribunal | null) {
    const pacote = (aprovada.pacote ?? null) as ArquivoDoPacote[] | null
    const tamanhos = pacote?.length
      ? Object.fromEntries(
          (await banco.select({ id: documento.id, tamanho: documento.tamanho }).from(documento).where(inArray(documento.id, pacote.map((a) => a.documentoId)))).map((d) => [
            d.id,
            d.tamanho,
          ]),
        )
      : {}
    const [cliente] = await banco.select({ cpf: pessoa.cpf }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
    return [travaTema350(pacote), travaCpf(aprovada.conteudo, cliente?.cpf ?? null), travaPacote(citados, pacote, tamanhos, tribunal)]
  }

  /** O citado `i` do pedido, que ainda falta, e a petição; antes do protocolo. */
  async function citadoQueFalta(casoId: string, indice: string, resposta: FastifyReply) {
    const p = await peticaoDo(casoId)
    if (!p) return void negar(resposta, 409, MSG_SEM_PEDIDO)
    if (await protocolada(p.id)) return void negar(resposta, 409, MSG_PROTOCOLADA)
    const citados = [...((p.citados ?? []) as Citado[])]
    const i = Number(indice)
    if (!Number.isInteger(i) || !citados[i] || citados[i].documentoId) return void negar(resposta, 409, MSG_CITADO_NAO_FALTA)
    return { p, citados, i }
  }

  // GGVP-71 CA13: o documento que falta, subido pela advogada ou escolhido entre os do caso (como o que a Documentação
  // entregou), é ligado ao citado, e o pacote é gerado de novo.
  app.post<{ Params: { id: string; i: string } }>(
    '/api/casos/:id/peticao/citados/:i/documento',
    { preHandler: exigir(banco, 'peticao.pedir', agora) },
    async (pedido, resposta) => {
      const casoId = pedido.params.id
      const formulario = await lerFormulario(pedido)
      if (!formulario) return negar(resposta, 400, MSG_DOCUMENTO_QUE_FALTA)
      const l = await citadoQueFalta(casoId, pedido.params.i, resposta)
      if (!l) return resposta
      const quem = pedido.usuario!.id
      const { arquivo, campos } = formulario
      let doc: { id: string; nome: string } | undefined
      if (arquivo && TIPOS_DE_ANEXO.includes(arquivo.mime)) {
        const dados = await guardarArquivo(armazenamento, casoId, arquivo, 'citado-peticao')
        const [d] = await banco.insert(documento).values({ casoId, tipo: 'citado_peticao', origem: 'portal', recebidoPor: quem, ...dados }).returning()
        doc = { id: d.id, nome: d.nomeOriginal }
      } else if (campos.documentoId) {
        ;[doc] = await banco
          .select({ id: documento.id, nome: documento.nomeOriginal })
          .from(documento)
          .where(and(eq(documento.id, campos.documentoId), eq(documento.casoId, casoId), isNull(documento.excluidoEm)))
          .catch(() => [])
      }
      if (!doc) return negar(resposta, 400, MSG_DOCUMENTO_QUE_FALTA)
      l.citados[l.i] = { documentoId: doc.id, nome: doc.nome }
      await banco.update(peticao).set({ citados: l.citados }).where(eq(peticao.id, l.p.id))
      await historico(quem, 'peticao_citado_resolvido', pedido, `caso:${casoId}`, { citado: l.i })
      await gerarPacote(casoId, l.p.id, quem)
      return resposta.code(201).send({ ok: true })
    },
  )

  // GGVP-71 CA13: pedir à Documentação o que falta: um item "Cumprir pendência" na exigência do despacho do caso.
  app.post<{ Params: { id: string; i: string } }>(
    '/api/casos/:id/peticao/citados/:i/pedido',
    { preHandler: exigir(banco, 'peticao.pedir', agora) },
    async (pedido, resposta) => {
      const casoId = pedido.params.id
      const l = await citadoQueFalta(casoId, pedido.params.i, resposta)
      if (!l) return resposta
      if (l.citados[l.i].itemId) return negar(resposta, 409, 'Este documento já foi pedido à Documentação.')
      const quem = pedido.usuario!.id
      const { limite } = await limitesDeCobranca(banco)
      const itemId = await banco.transaction(async (tx) => {
        const [x] = await tx
          .select()
          .from(exigencia)
          .where(and(eq(exigencia.casoId, casoId), eq(exigencia.origem, 'despacho')))
          .orderBy(desc(exigencia.criadoEm))
          .limit(1)
        const exigenciaId = x
          ? x.id
          : (
              await tx
                .insert(exigencia)
                .values({ casoId, origem: 'despacho', descricao: 'Documentos para a petição inicial', recebidaEm: hoje(agora()), pede: 'documentos', analisadaPor: quem, criadoEm: agora() })
                .returning()
            )[0].id
        if (x?.situacao === 'cumprida') await tx.update(exigencia).set({ situacao: 'aberta' }).where(eq(exigencia.id, x.id))
        const [t] = await tx
          .insert(tarefa)
          .values({
            casoId,
            passo: 'D3.04',
            titulo: 'Cumprir pendência',
            perfilDono: 'documentacao',
            prazo: await lembreteDoLaco(tx, hoje(agora()), null, limite ?? 1),
            limiteTentativas: limite,
            criadoEm: agora(),
          })
          .returning()
        const [item] = await tx
          .insert(exigenciaItem)
          .values({ exigenciaId, descricao: `Documento para a petição: ${l.citados[l.i].nome}`, perfilResponsavel: 'documentacao', tarefaId: t.id })
          .returning()
        l.citados[l.i] = { ...l.citados[l.i], itemId: item.id }
        await tx.update(peticao).set({ citados: l.citados }).where(eq(peticao.id, l.p.id))
        return item.id
      })
      await historico(quem, 'peticao_citado_pedido_a_documentacao', pedido, `caso:${casoId}`, { citado: l.i, item: itemId })
      return resposta.code(201).send({ ok: true })
    },
  )

  // GGVP-71 CA13: gerar o pacote de novo (por exemplo, se o armazenamento falhou na aprovação).
  app.post<{ Params: { id: string } }>('/api/casos/:id/peticao/pacote', { preHandler: exigir(banco, 'peticao.pedir', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const p = await peticaoDo(casoId)
    if (!p) return negar(resposta, 409, MSG_SEM_PEDIDO)
    if (await protocolada(p.id)) return negar(resposta, 409, MSG_PROTOCOLADA)
    if (!(await versoesDa(p.id)).some((v) => v.aprovadaPor)) return negar(resposta, 409, 'Aprove a versão antes de gerar o pacote.')
    await gerarPacote(casoId, p.id, pedido.usuario!.id)
    return resposta.code(201).send({ ok: true })
  })

  // GGVP-71 CA3 a CA5, CA8 a CA10 (G7): com as três travas passando e confirmadas pela evidência, o número do processo
  // (CNJ), a data e o comprovante, registra o protocolo da versão aprovada; o CNJ entra no caso, e a vigília passa a casar
  // as publicações do processo (D3a). O portal não envia nada ao tribunal (CA11).
  app.post<{ Params: { id: string } }>('/api/casos/:id/peticao/protocolo', { preHandler: exigir(banco, 'peticao.protocolar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const formulario = await lerFormulario(pedido)
    if (!formulario) return negar(resposta, 400, MSG_COMPROVANTE)
    const { campos, arquivo } = formulario
    const sim = (v: string | undefined) => v === 'true'
    const entrada = ProtocolarPeticao.safeParse({ ...campos, conferiTema350: sim(campos.conferiTema350), conferiCpf: sim(campos.conferiCpf), conferiPacote: sim(campos.conferiPacote) })
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o protocolo.')
    if (!arquivo || !TIPOS_DE_ANEXO.includes(arquivo.mime)) return negar(resposta, 400, MSG_COMPROVANTE)
    const p = await peticaoDo(casoId)
    if (!p) return negar(resposta, 409, MSG_SEM_PEDIDO)
    if (await protocolada(p.id)) return negar(resposta, 409, MSG_PROTOCOLADA)
    const aguardando = await tarefaAberta(casoId, 'D3.07')
    const aprovada = (await versoesDa(p.id)).findLast((v) => v.aprovadaPor)
    if (!aguardando || !aprovada) return negar(resposta, 409, MSG_NADA_A_PROTOCOLAR)
    const d = entrada.data
    const tribunal = (await tribunaisDa(banco)).find((t) => t.nome === d.tribunal)
    if (!tribunal) return negar(resposta, 400, 'Escolha um tribunal da configuração do escritório.')
    const quem = pedido.usuario!.id
    // CA3: trava falhando bloqueia o protocolo e diz qual.
    const travas = await travasDa(casoId, aprovada, (p.citados ?? []) as Citado[], tribunal)
    const falhando = travas.filter((t) => !t.ok)
    if (falhando.length) {
      await bloqueio(pedido, casoId, 'G7', 'D3.07', { travas: falhando.map((t) => t.nome) })
      return negar(resposta, 409, `Trava falhando: ${falhando.map((t) => `${t.nome} (${t.evidencia})`).join('; ')}.`)
    }
    // CA9: o pacote não pode ter mudado depois da aprovação: confere o hash de cada arquivo no armazenamento.
    const divergentes: string[] = []
    for (const a of (aprovada.pacote ?? []) as ArquivoDoPacote[]) {
      const [doc] = await banco.select().from(documento).where(eq(documento.id, a.documentoId))
      const conteudo = doc ? await armazenamento.ler(doc.chaveArmazenamento).catch(() => null) : null
      if (!conteudo || hashDe(conteudo) !== a.hash) divergentes.push(a.nome)
    }
    if (divergentes.length) {
      await bloqueio(pedido, casoId, 'G7', 'D3.07', { arquivos: divergentes, versao: aprovada.numero }, 'pacote_divergente')
      return negar(resposta, 409, `O pacote mudou depois da aprovação: ${divergentes.join(', ')}. O protocolo fica bloqueado; gere o pacote de novo e confira.`)
    }
    const [outro] = await banco
      .select({ casoId: identificadorCaso.casoId })
      .from(identificadorCaso)
      .where(and(eq(identificadorCaso.tipo, 'cnj'), eq(identificadorCaso.valor, d.numeroCnj)))
    if (outro && outro.casoId !== casoId) return negar(resposta, 409, MSG_CNJ_DE_OUTRO_CASO)
    const dados = await guardarArquivo(armazenamento, casoId, arquivo, 'comprovante-protocolo')
    const fechar = { situacao: 'concluida' as const, concluidaEm: agora(), concluidaPor: quem }
    await banco.transaction(async (tx) => {
      const [comprovante] = await tx.insert(documento).values({ casoId, tipo: 'comprovante_protocolo_judicial', origem: 'portal', recebidoPor: quem, ...dados }).returning()
      await tx.insert(protocoloJudicial).values({
        peticaoVersaoId: aprovada.id,
        tribunal: tribunal.nome,
        numero: d.numeroCnj,
        protocoladoEm: new Date(`${d.dataProtocolo}T12:00:00-03:00`),
        comprovanteDocumentoId: comprovante.id,
        protocoladoPor: quem,
      })
      if (!outro) await tx.insert(identificadorCaso).values({ casoId, tipo: 'cnj', valor: d.numeroCnj })
      // CA6: cada trava confirmada pela evidência fica registrada, com a evidência.
      for (const t of travas)
        await tx.insert(decisao).values({ casoId, passo: 'D3.07', tipo: 'trava_g7', resultado: t.chave, justificativa: t.evidencia, decididoPor: quem, perfil: pedido.perfilAtivo!, decididoEm: agora() })
      await tx.update(tarefa).set(fechar).where(eq(tarefa.id, aguardando.id))
      await tx
        .update(etapa)
        .set(fechar)
        .where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D3.07'), isNull(etapa.concluidaEm)))
    })
    // CA8, CA10: quem protocolou, quando, a versão e o identificador dela.
    await historico(quem, 'peticao_protocolada', pedido, `caso:${casoId}`, { versao: aprovada.numero, hash: aprovada.hash, tribunal: tribunal.nome, numero: d.numeroCnj })
    return resposta.code(201).send({ ok: true })
  })
}

