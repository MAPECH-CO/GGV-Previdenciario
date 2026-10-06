// Petição inicial (GGVP-63, 67, 71): com os setores do despacho fechados, a advogada pede a petição e escreve a versão 1
// (sem IA até o épico IA jurídica); depois confere e aprova (G6, G18), e o pacote vai para o protocolo com as travas (G7).
import { createHash } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { PedirPeticao, PeticaoInicial, pode, type Erro } from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { caso, documento, etapa, peticao, peticaoVersao, pessoa, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { situacaoDoDespacho } from './indeferimento.ts'

export const MSG_NADA_A_PEDIR = 'Este caso não está esperando o pedido da petição.'
export const MSG_JA_PEDIDA = 'A petição inicial deste caso já foi pedida.'
export const MSG_CITADO_DE_OUTRO_CASO = 'Um documento citado não é deste caso.'

type Opcoes = { banco: Banco; armazenamento: Armazenamento; agora?: () => Date }
type Citado = { documentoId: string | null; nome: string }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const hashDe = (texto: string) => createHash('sha256').update(texto).digest('hex')

export function registrarRotasPeticao(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  const tarefaAberta = async (casoId: string, passo: string) =>
    (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, passo), isNull(tarefa.concluidaEm))).limit(1))[0] ?? null

  /** A petição inicial do caso (uma por caso). */
  const peticaoDo = async (casoId: string) =>
    (await banco.select().from(peticao).where(and(eq(peticao.casoId, casoId), eq(peticao.tipo, 'inicial'))).orderBy(desc(peticao.criadoEm)).limit(1))[0] ?? null

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
    const versoes = p ? await banco.select().from(peticaoVersao).where(eq(peticaoVersao.peticaoId, p.id)).orderBy(asc(peticaoVersao.numero)) : []
    const ids = [p?.pedidaPor, ...versoes.map((v) => v.aprovadaPor)].filter((x): x is string => Boolean(x))
    const nomes = new Map(ids.length ? (await banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, ids))).map((u) => [u.id, u.nome]) : [])
    const ultima = versoes.at(-1)
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
      atual: ultima ? { numero: ultima.numero, texto: ultima.conteudo } : null,
      podePedir: pode(pedido.perfilAtivo, 'peticao.pedir') && !p && Boolean(await tarefaAberta(casoId, 'D3.05')),
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
}
