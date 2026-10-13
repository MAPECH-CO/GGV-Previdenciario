// Improcedente: decidir se recorre (GGVP-100, passo D3b.04). Depois da sentença improcedente confirmada ("Confirmar
// desfecho", D4.02), a Sênior decide com justificativa (Lucas, 07/10); a advogada responsável e o Sócio só leem.
// Recorrer: o processo segue na vigília (D3a) e nasce a tarefa do recurso. Não recorrer: o caso vai ao estudo de caso
// (GGVP-19) e à explicação ao cliente (GGVP-22).
import { and, desc, eq, isNotNull, isNull, notExists, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { DecidirRecurso, ROTULO_BENEFICIO, RecursoDoCaso, pode, type Beneficio, type Erro, type FonteDaIa, type Perfil } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { caso, decisao, eventoAuditoria, pessoa, prazo as prazoProcessual, processoAcervo, publicacao, tarefa, usuario } from '../banco/esquema.ts'
import { REGRA_DA_CHANCE_DO_RECURSO, calcularChanceDoRecurso } from '../fluxo/chance.ts'
import { feriadosDoProcesso, prazoRecursal } from '../fluxo/prazo-judicial.ts'
import { buscarNoAcervo } from '../ia/acervo.ts'
import { FINALIDADES, type ComoSugerir, type Ia } from '../ia/ia.ts'
import { casosComTarefaAberta, type Preparo } from '../ia/preparo.ts'
import { exigir } from '../sessao/rotas.ts'
import { abrirExplicacaoDoResultado } from './resultado.ts'

export const TITULO_DECIDIR = 'Decidir recurso'
export const TITULO_RECORRER = 'Elaborar e protocolar o recurso'
export const MSG_SEM_DECISAO = 'Este caso não tem decisão de recurso esperando.'
/** Dúvida Q26, respondida pelo Lucas (09/10): quem elabora e protocola o recurso são as Sêniores. */
export const QUEM_FAZ_O_RECURSO: Perfil = 'senior'

type Opcoes = { banco: Banco; agora?: () => Date; ia: Ia; preparo: Preparo }
type Tx = Parameters<Parameters<Banco['transaction']>[0]>[0]

/** GGVP-161 CA3: a avaliação da IA não traz porcentagem; a que trouxer é recusada (o número é do código, G19). */
export const MSG_AVALIACAO_SEM_IA = 'A IA não trouxe a avaliação agora: a decisão fica com a sua leitura.'
const semPorcentagem = (texto: string) => !/\d\s*%|por\s*cento/i.test(texto)

/**
 * GGVP-161 CA2: a chance do recurso pelos recursos julgados do acervo conferido, do mesmo benefício; com os casos usados
 * (ids do acervo) e a data da entrada mais recente. Sem benefício, nenhum caso parecido.
 */
async function chanceDoRecurso(banco: Banco, beneficio: string | null) {
  const julgados = beneficio
    ? await banco
        .select({ id: processoAcervo.id, resultado: processoAcervo.resultadoRecurso, criadoEm: processoAcervo.criadoEm })
        .from(processoAcervo)
        .where(and(eq(processoAcervo.beneficio, beneficio), isNotNull(processoAcervo.desfechoConferidoPor), isNotNull(processoAcervo.resultadoRecurso)))
    : []
  const conta = calcularChanceDoRecurso(julgados.map((j) => j.resultado))
  const baseEm = julgados.length ? new Date(Math.max(...julgados.map((j) => j.criadoEm.getTime()))).toISOString() : null
  return { chance: { ...conta, baseEm, regra: REGRA_DA_CHANCE_DO_RECURSO }, casosUsados: julgados.map((j) => j.id) }
}
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

/** CA4 (G12): a última sentença do caso e o prazo do recurso contado pelo sistema. Sem sentença no sistema, nulos. */
async function sentencaEPrazo(tx: Banco | Tx, casoId: string) {
  const [sentenca] = await tx
    .select()
    .from(publicacao)
    .where(and(eq(publicacao.casoId, casoId), eq(publicacao.classe, 'merito')))
    .orderBy(desc(publicacao.disponibilizadaEm))
    .limit(1)
  if (!sentenca) return { sentenca: null, prazo: null }
  const [contado] = await tx.select({ fim: prazoProcessual.fim }).from(prazoProcessual).where(eq(prazoProcessual.publicacaoId, sentenca.id)).orderBy(desc(prazoProcessual.criadoEm)).limit(1)
  return { sentenca, prazo: prazoRecursal(sentenca.disponibilizadaEm, await feriadosDoProcesso(tx, sentenca.numeroCnj), contado?.fim ?? null) }
}

const decisaoAberta = async (tx: Banco | Tx, casoId: string) =>
  (await tx.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3b.04'), isNull(tarefa.concluidaEm))).limit(1))[0] ?? null

/**
 * Abre "Decidir recurso" para a Sênior, com o prazo recursal, se não houver uma aberta. Quem chama: a "Confirmar
 * desfecho" (D4.02) quando a sentença for improcedente; hoje, a semente.
 */
export async function abrirDecisaoDoRecurso(tx: Banco | Tx, casoId: string) {
  if (await decisaoAberta(tx, casoId)) return
  const { prazo } = await sentencaEPrazo(tx, casoId)
  await tx.insert(tarefa).values({ casoId, passo: 'D3b.04', titulo: TITULO_DECIDIR, perfilDono: 'senior', prazo: prazo?.fim ?? null })
}

/**
 * Para o estudo de caso (GGVP-19; CA2): o caso perdido só vai ao estudo quando ninguém espera a decisão do recurso e a
 * última decisão não foi recorrer. Depois de um "Recorrer", só um "Não recorrer" mais novo (no acórdão) leva ao estudo.
 */
export function semRecursoPendente(banco: Banco) {
  return and(
    notExists(banco.select({ id: tarefa.id }).from(tarefa).where(and(eq(tarefa.casoId, caso.id), eq(tarefa.passo, 'D3b.04'), isNull(tarefa.concluidaEm)))),
    sql`coalesce((select ${decisao.resultado} from ${decisao} where ${decisao.casoId} = ${caso.id} and ${decisao.tipo} = 'recurso' order by ${decisao.decididoEm} desc limit 1), '') <> 'recorrer'`,
  )
}

export function registrarRotasRecurso(app: FastifyInstance, { banco, agora = () => new Date(), ia, preparo }: Opcoes) {
  /**
   * GGVP-161 CA3: a avaliação da IA sobre o recurso, com a sentença, o caso, a chance do código e os trechos do acervo.
   * Pronta em segundo plano para toda decisão aberta (sugestão pronta); ao abrir, vem a mesma chamada.
   */
  async function avaliar(casoId: string, como: ComoSugerir = {}) {
    const [c] = await banco.select({ beneficio: caso.beneficio }).from(caso).where(eq(caso.id, casoId))
    if (!c) return null
    const { sentenca } = await sentencaEPrazo(banco, casoId)
    const { chance } = await chanceDoRecurso(banco, c.beneficio)
    const acervo = await buscarNoAcervo(banco, { casoId, beneficio: c.beneficio, consulta: sentenca?.texto ?? '', saude: FINALIDADES.avaliacao_do_recurso.saude, ia })
    const conteudo = [
      `Benefício: ${c.beneficio ? (ROTULO_BENEFICIO[c.beneficio as Beneficio] ?? c.beneficio) : 'não definido'}`,
      `Sentença: ${sentenca?.texto ?? 'o texto da sentença não está no sistema'}`,
      `Chance do recurso calculada pelo sistema: ${chance.porcentagem === null ? 'sem recursos julgados de casos parecidos ainda' : `${chance.porcentagem}% em ${chance.casos} recursos julgados`}`,
      ...(acervo.length ? ['Trechos do acervo da casa (outros casos):', ...acervo.map((a) => `- ${a.trecho}`)] : ['Acervo da casa: nada parecido ainda.']),
    ].join('\n')
    const fontes: FonteDaIa[] = [
      ...(sentenca ? [{ tipo: 'caso' as const, referencia: `publicacao:${sentenca.id}`, trecho: 'Sentença' }] : []),
      { tipo: 'regra', referencia: REGRA_DA_CHANCE_DO_RECURSO },
      ...acervo,
    ]
    return ia.sugerir('avaliacao_do_recurso', { casoId, quem: null, conteudo, fontes }, { ...como, validar: semPorcentagem })
  }
  preparo.registrar(
    () => casosComTarefaAberta(banco, 'D3b.04'),
    (casoId) => avaliar(casoId, { soPreparar: true }),
  )
  const avaliacaoNaTela = async (casoId: string) => {
    const avaliacao = await avaliar(casoId)
    return { avaliacao, motivoIa: avaliacao ? null : MSG_AVALIACAO_SEM_IA }
  }

  // CA3, CA4, CA8: o caso, a sentença, o prazo recursal e a decisão desta rodada, se já houve.
  app.get<{ Params: { id: string } }>('/api/casos/:id/recurso', { preHandler: exigir(banco, 'recurso.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const [c] = await banco.select({ pessoaId: pessoa.id, nome: pessoa.nome, beneficio: caso.beneficio }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    const { sentenca, prazo } = await sentencaEPrazo(banco, casoId)
    const aberta = await decisaoAberta(banco, casoId)
    const [d] = aberta
      ? []
      : await banco
          .select({ resultado: decisao.resultado, justificativa: decisao.justificativa, em: decisao.decididoEm, por: usuario.nome })
          .from(decisao)
          .innerJoin(usuario, eq(decisao.decididoPor, usuario.id))
          .where(and(eq(decisao.casoId, casoId), eq(decisao.tipo, 'recurso')))
          .orderBy(desc(decisao.decididoEm))
          .limit(1)
    return RecursoDoCaso.parse({
      casoId,
      pessoaId: c.pessoaId,
      cliente: c.nome,
      beneficio: c.beneficio ? (ROTULO_BENEFICIO[c.beneficio as Beneficio] ?? c.beneficio) : null,
      sentenca: sentenca ? { disponibilizadaEm: sentenca.disponibilizadaEm, texto: sentenca.texto } : null,
      prazo: prazo ? { fim: prazo.fim, regra: prazo.regra } : null,
      // CA8 e GGVP-161 CA2: a chance do recurso pelos recursos julgados do acervo (não a da primeira instância).
      chance: (await chanceDoRecurso(banco, c.beneficio)).chance,
      // GGVP-161 CA3: a avaliação da IA, pronta; só enquanto a decisão espera.
      ...(aberta ? await avaliacaoNaTela(casoId) : {}),
      decisao: d ? { decisao: d.resultado, justificativa: d.justificativa ?? '', por: d.por, em: d.em.toISOString() } : null,
      podeDecidir: pode(pedido.perfilAtivo, 'recurso.decidir') && aberta !== null,
    })
  })

  // CA1, CA2, CA3, CA5: a Sênior decide com justificativa; quem e quando ficam na decisão. Decisão repetida é recusada.
  app.post<{ Params: { id: string } }>('/api/casos/:id/recurso', { preHandler: exigir(banco, 'recurso.decidir', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = DecidirRecurso.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira a decisão.')
    const pendente = await decisaoAberta(banco, casoId)
    if (!pendente) return negar(resposta, 409, MSG_SEM_DECISAO)
    const quem = pedido.usuario!.id
    const { decisao: escolha, justificativa } = entrada.data
    // GGVP-161 CA4: a decisão fica com a chance daquele momento (e os casos usados) e a avaliação da IA que a Sênior viu.
    const [c] = await banco.select({ beneficio: caso.beneficio }).from(caso).where(eq(caso.id, casoId))
    const { chance, casosUsados } = await chanceDoRecurso(banco, c?.beneficio ?? null)
    const avaliacao = await avaliar(casoId)
    const registro = { porcentagem: chance.porcentagem, casos: chance.casos, baseEm: chance.baseEm, casosUsados, avaliacao: avaliacao?.chamadaId ?? null }
    const feito = await banco.transaction(async (tx) => {
      // A condição vai no próprio update: duas decisões ao mesmo tempo, só a primeira fecha a tarefa e segue.
      const [fechada] = await tx
        .update(tarefa)
        .set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem })
        .where(and(eq(tarefa.id, pendente.id), isNull(tarefa.concluidaEm)))
        .returning({ id: tarefa.id })
      if (!fechada) return false
      await tx.insert(decisao).values({ casoId, passo: 'D3b.04', tipo: 'recurso', resultado: escolha, justificativa, decididoPor: quem, perfil: pedido.perfilAtivo!, decididoEm: agora() })
      if (escolha === 'recorrer') {
        // CA1, CA5: o processo segue na vigília (D3a); o acórdão chega pela vigília, como as outras publicações.
        await tx.insert(tarefa).values({ casoId, passo: 'D3b.04r', titulo: TITULO_RECORRER, perfilDono: QUEM_FAZ_O_RECURSO, prazo: pendente.prazo })
      } else {
        // CA2: o estudo de caso nasce na próxima rodada da IA (GGVP-19, ver semRecursoPendente); a explicação ao cliente
        // (GGVP-22) abre já, mesmo sem a IA.
        await abrirExplicacaoDoResultado(tx, casoId)
      }
      await tx.insert(eventoAuditoria).values({ quem, acao: 'recurso_decidido', alvo: `caso:${casoId}`, quando: agora(), detalhe: { ip: pedido.ip, decisao: escolha, chance: registro } })
      return true
    })
    if (!feito) return negar(resposta, 409, MSG_SEM_DECISAO)
    return resposta.code(201).send({ ok: true })
  })
}
