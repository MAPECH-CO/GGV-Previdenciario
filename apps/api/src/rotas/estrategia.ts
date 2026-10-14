// GGVP-158 P7.1: a estratégia do caso, interna, só do Jurídico e dos sócios (`estudo.ver`). A IA propõe pelo que o caso
// tem (o parecer, o despacho, o indeferimento, as perícias, a decisão de mérito e o acervo), pronta em segundo plano
// (sugestão pronta, 07/10); a advogada ou a Sênior confere, ajusta e salva. Cada versão é uma linha de `decisao` (tipo
// `estrategia`): a atual é a mais nova. Sem tabela nova.
import { and, desc, eq, exists, inArray, notExists, or } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { EstrategiaDaIa, EstrategiaDoCaso, ROTULO_BENEFICIO, SalvarEstrategia, pode, type Beneficio, type Erro, type FonteDaIa } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { caso, chamadaIa, decisao, parecerMedico, pericia, publicacao, resultadoInss, usuario } from '../banco/esquema.ts'
import { buscarNoAcervo } from '../ia/acervo.ts'
import { FINALIDADES, lerJson, type ComoSugerir, type Ia } from '../ia/ia.ts'
import type { Preparo } from '../ia/preparo.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { situacaoDoDespacho } from './indeferimento.ts'

export const MSG_SEM_PROPOSTA = 'A IA não propôs agora: escreva a estratégia pelo que o caso tem.'
export const MSG_CHAMADA_DE_OUTRO = 'A proposta não é deste caso.'
const TIPO = 'estrategia'

type Opcoes = { banco: Banco; agora?: () => Date; ia: Ia; preparo: Preparo }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

/** A estratégia que vale no caso (a mais nova), ou nula. A página do processo também lê daqui. */
export async function estrategiaAtual(banco: Banco, casoId: string): Promise<string | null> {
  const [d] = await banco
    .select({ texto: decisao.justificativa })
    .from(decisao)
    .where(and(eq(decisao.casoId, casoId), eq(decisao.tipo, TIPO)))
    .orderBy(desc(decisao.decididoEm))
    .limit(1)
  return d?.texto ?? null
}

export function registrarRotasEstrategia(app: FastifyInstance, { banco, agora = () => new Date(), ia, preparo }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const ler = { preHandler: exigir(banco, 'estudo.ver', agora) }
  const salvar = { preHandler: exigir(banco, 'peticao.pedir', agora) }

  /** A proposta da IA, pelo que o caso tem; nula sem caso, sem a IA ou com a saída fora do formato. */
  async function proposta(casoId: string, como: ComoSugerir = {}) {
    const [c] = await banco.select({ beneficio: caso.beneficio, fase: caso.fase, desfecho: caso.desfecho }).from(caso).where(eq(caso.id, casoId))
    if (!c) return null
    const [merito] = await banco
      .select({ id: publicacao.id, texto: publicacao.texto })
      .from(publicacao)
      .where(and(eq(publicacao.casoId, casoId), eq(publicacao.classe, 'merito')))
      .orderBy(desc(publicacao.disponibilizadaEm))
      .limit(1)
    const [indeferido] = await banco
      .select()
      .from(resultadoInss)
      .where(and(eq(resultadoInss.casoId, casoId), eq(resultadoInss.resultado, 'indeferido')))
      .orderBy(desc(resultadoInss.criadoEm))
      .limit(1)
    const { itens } = await situacaoDoDespacho(banco, casoId)
    const [parecer] = await banco.select().from(parecerMedico).where(eq(parecerMedico.casoId, casoId)).orderBy(desc(parecerMedico.criadoEm)).limit(1)
    const pericias = await banco.select({ tipo: pericia.tipo, resultado: pericia.resultado }).from(pericia).where(eq(pericia.casoId, casoId))
    const motivoDoInss = indeferido ? [indeferido.motivoIndeferimento, indeferido.motivoEscrito].filter(Boolean).join(' ') : ''
    const beneficio = c.beneficio ? (ROTULO_BENEFICIO[c.beneficio as Beneficio] ?? c.beneficio) : 'não definido'
    const consulta = [beneficio, motivoDoInss, merito?.texto].filter(Boolean).join(' ')
    const acervo = await buscarNoAcervo(banco, { casoId, beneficio: c.beneficio, consulta, saude: FINALIDADES.estrategia_do_caso.saude, ia })
    const conteudo = [
      `Benefício: ${beneficio}`,
      `Fase: ${c.fase}${c.desfecho ? `; desfecho: ${c.desfecho}` : ''}`,
      `Indeferimento do INSS: ${indeferido ? `${indeferido.dataDecisao}; ${motivoDoInss || 'motivo não registrado'}` : 'não há'}`,
      `O que a Sênior mandou buscar no despacho: ${itens.length ? itens.map((i) => `${i.item.descricao} (${i.item.situacao})`).join('; ') : 'nada registrado'}`,
      `Parecer médico: ${parecer ? `${parecer.resultado}; itens: ${JSON.stringify(parecer.itens)}` : 'não há'}`,
      `Perícias: ${pericias.length ? pericias.map((p) => `${p.tipo}: ${p.resultado ?? 'sem resultado'}`).join('; ') : 'nenhuma'}`,
      `Decisão de mérito: ${merito?.texto ?? 'não há'}`,
      ...(acervo.length ? ['Trechos do acervo da casa (outros casos):', ...acervo.map((a) => `- ${a.trecho}`)] : []),
    ].join('\n')
    const fontes: FonteDaIa[] = [merito ? { tipo: 'publicacao', referencia: `publicacao:${merito.id}` } : { tipo: 'caso', referencia: `caso:${casoId}` }, ...acervo]
    const validar = (texto: string) => EstrategiaDaIa.safeParse(lerJson(texto)).success
    return ia.sugerir('estrategia_do_caso', { casoId, quem: null, conteudo, fontes }, { ...como, validar })
  }

  async function doCaso(casoId: string, perfil: string | null, como: ComoSugerir = {}) {
    const versoes = await banco
      .select({ texto: decisao.justificativa, por: usuario.nome, em: decisao.decididoEm, daIa: decisao.sugestaoIa })
      .from(decisao)
      .innerJoin(usuario, eq(decisao.decididoPor, usuario.id))
      .where(and(eq(decisao.casoId, casoId), eq(decisao.tipo, TIPO)))
      .orderBy(desc(decisao.decididoEm))
    const s = await proposta(casoId, como)
    const [atual] = versoes
    return EstrategiaDoCaso.parse({
      casoId,
      atual: atual ? { texto: atual.texto ?? '', por: atual.por, em: atual.em.toISOString(), daIa: atual.daIa !== null } : null,
      versoes: versoes.map((v) => ({ texto: v.texto ?? '', por: v.por, em: v.em.toISOString() })),
      sugestao: s,
      aviso: s ? null : MSG_SEM_PROPOSTA,
      podeSalvar: pode(perfil, 'peticao.pedir'),
    })
  }

  const existe = async (casoId: string) => (await banco.select({ id: caso.id }).from(caso).where(eq(caso.id, casoId))).length > 0

  app.get<{ Params: { id: string } }>('/api/casos/:id/estrategia', ler, async (pedido, resposta) => {
    if (!(await existe(pedido.params.id))) return negar(resposta, 404, 'Caso não encontrado.')
    return doCaso(pedido.params.id, pedido.perfilAtivo)
  })

  // Pedir outra proposta é o único botão (GGVP-106): a IA chama de novo, mesmo com o conteúdo igual.
  app.post<{ Params: { id: string } }>('/api/casos/:id/estrategia/sugestao', salvar, async (pedido, resposta) => {
    if (!(await existe(pedido.params.id))) return negar(resposta, 404, 'Caso não encontrado.')
    return doCaso(pedido.params.id, pedido.perfilAtivo, { refazer: true })
  })

  app.post<{ Params: { id: string } }>('/api/casos/:id/estrategia', salvar, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = SalvarEstrategia.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira a estratégia.')
    if (!(await existe(casoId))) return negar(resposta, 404, 'Caso não encontrado.')
    const { texto, chamadaIaId } = entrada.data
    // A proposta citada tem de ser desta finalidade e deste caso (GGVP-158, parte 2).
    let ajustada: boolean | null = null
    if (chamadaIaId) {
      const [c] = await banco
        .select({ saida: chamadaIa.saida })
        .from(chamadaIa)
        .where(and(eq(chamadaIa.id, chamadaIaId), eq(chamadaIa.casoId, casoId), eq(chamadaIa.finalidade, 'estrategia_do_caso')))
      if (!c?.saida) return negar(resposta, 400, MSG_CHAMADA_DE_OUTRO)
      const lida = EstrategiaDaIa.safeParse(lerJson(c.saida))
      ajustada = !lida.success || lida.data.estrategia !== texto
    }
    const quem = pedido.usuario!.id
    await banco.insert(decisao).values({
      casoId,
      passo: 'D3',
      tipo: TIPO,
      resultado: 'registrada',
      justificativa: texto,
      sugestaoIa: chamadaIaId ? { chamadaId: chamadaIaId, ajustada } : null,
      decididoPor: quem,
      perfil: pedido.perfilAtivo!,
      decididoEm: agora(),
    })
    // O histórico guarda quem e quando; o texto fica na versão, que só o Jurídico lê.
    await historico(quem, 'estrategia_registrada', pedido, `caso:${casoId}`, { daIa: Boolean(chamadaIaId), ajustada })
    return resposta.code(201).send(await doCaso(casoId, pedido.perfilAtivo))
  })

  // GGVP-106: a proposta fica pronta nos casos com parecer, indeferimento ou decisão de mérito e ainda sem estratégia.
  preparo.registrar(
    async () =>
      (
        await banco
          .select({ id: caso.id })
          .from(caso)
          .where(
            and(
              or(
                exists(banco.select({ id: parecerMedico.id }).from(parecerMedico).where(eq(parecerMedico.casoId, caso.id))),
                exists(banco.select({ id: resultadoInss.id }).from(resultadoInss).where(and(eq(resultadoInss.casoId, caso.id), eq(resultadoInss.resultado, 'indeferido')))),
                exists(banco.select({ id: publicacao.id }).from(publicacao).where(and(eq(publicacao.casoId, caso.id), eq(publicacao.classe, 'merito')))),
              ),
              notExists(banco.select({ id: decisao.id }).from(decisao).where(and(eq(decisao.casoId, caso.id), eq(decisao.tipo, TIPO)))),
              notExists(
                banco
                  .select({ id: chamadaIa.id })
                  .from(chamadaIa)
                  .where(and(eq(chamadaIa.casoId, caso.id), eq(chamadaIa.finalidade, 'estrategia_do_caso'), inArray(chamadaIa.situacao, ['ok']))),
              ),
            ),
          )
      ).map((c) => c.id),
    async (casoId) => void (await proposta(casoId, { soPreparar: true })),
  )
}
