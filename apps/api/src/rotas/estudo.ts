// Estudo de caso do processo perdido (GGVP-19; Lucas, 06/10): a IA faz o estudo sozinha depois do resultado negativo, em
// segundo plano (sugestão pronta, 07/10). O estudo vai para a tela de estudos, separado por benefício e pela chance que
// o caso tinha, e entra no acervo; só vira tarefa da Sênior quando indica novo processo. É estratégia interna: só o
// Jurídico vê. O estudo é a própria chamada da IA (`chamada_ia`, finalidade `estudo_de_caso`), sem tabela nova.
import { and, asc, desc, eq, inArray, isNotNull, isNull, notExists } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { EstudoDaIa, EstudosDeCaso, ROTULO_BENEFICIO, RevisarEstudo, pode, type Beneficio, type Erro, type FonteDaIa } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { caso, chamadaIa, decisao, documento, parecerMedico, pericia, pessoa, peticao, peticaoVersao, publicacao, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { buscarNoAcervo } from '../ia/acervo.ts'
import { FINALIDADES, lerJson, type ComoSugerir, type Ia } from '../ia/ia.ts'
import type { Preparo } from '../ia/preparo.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { situacaoDoDespacho } from './indeferimento.ts'
import { abrirExplicacaoDoResultado } from './resultado.ts'

export const TITULO_REVISAR = 'Revisar estudo de caso'
export const MSG_NADA_A_REVISAR = 'Este caso não tem estudo esperando a revisão da Sênior.'
const PERDIDOS = ['improcedente', 'extinto_sem_merito']
const ROTULO_RESULTADO: Record<string, string> = { improcedente: 'Improcedente (o juiz negou o pedido)', extinto_sem_merito: 'Extinto sem julgar o mérito' }
// ponytail: a petição longa vai cortada; o começo traz fatos, direito e pedidos. Subir se a IA sentir falta do resto.
const LIMITE_DA_PETICAO = 20_000

type Opcoes = { banco: Banco; agora?: () => Date; ia: Ia; preparo: Preparo }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasEstudo(app: FastifyInstance, { banco, agora = () => new Date(), ia, preparo }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  /** CA1: o estudo do caso perdido, com o que o caso tem; CA3: novo processo abre a tarefa da Sênior; CA4: a explicação. */
  async function estudar(casoId: string, como: ComoSugerir = {}) {
    const [c] = await banco.select({ beneficio: caso.beneficio, desfecho: caso.desfecho }).from(caso).where(eq(caso.id, casoId))
    if (!c?.desfecho || !PERDIDOS.includes(c.desfecho)) return null
    const [merito] = await banco
      .select({ id: publicacao.id, texto: publicacao.texto })
      .from(publicacao)
      .where(and(eq(publicacao.casoId, casoId), eq(publicacao.classe, 'merito')))
      .orderBy(desc(publicacao.disponibilizadaEm))
      .limit(1)
    const [aprovada] = await banco
      .select({ conteudo: peticaoVersao.conteudo })
      .from(peticaoVersao)
      .innerJoin(peticao, eq(peticaoVersao.peticaoId, peticao.id))
      .where(and(eq(peticao.casoId, casoId), isNotNull(peticaoVersao.aprovadaEm)))
      .orderBy(desc(peticaoVersao.aprovadaEm))
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
    const docs = await banco
      .select({ nome: documento.nomeOriginal, tipo: documento.tipo })
      .from(documento)
      .where(and(eq(documento.casoId, casoId), isNull(documento.excluidoEm)))
      .orderBy(asc(documento.criadoEm))
    const motivoDoInss = indeferido ? [indeferido.motivoIndeferimento, indeferido.motivoEscrito].filter(Boolean).join(' ') : ''
    const acervo = await buscarNoAcervo(banco, { casoId, beneficio: c.beneficio, consulta: [merito?.texto, motivoDoInss].filter(Boolean).join(' '), saude: FINALIDADES.estudo_de_caso.saude, ia })
    const conteudo = [
      `Benefício: ${c.beneficio ? (ROTULO_BENEFICIO[c.beneficio as Beneficio] ?? c.beneficio) : 'não definido'}`,
      `Resultado: ${ROTULO_RESULTADO[c.desfecho]}`,
      `Texto da decisão: ${merito?.texto ?? 'não está no sistema'}`,
      `Indeferimento do INSS: ${indeferido ? `${indeferido.dataDecisao}; ${motivoDoInss || 'motivo não registrado'}` : 'não há'}`,
      `O que a Sênior mandou buscar no despacho: ${itens.length ? itens.map((i) => `${i.item.descricao} (${i.item.situacao})`).join('; ') : 'nada registrado'}`,
      `Parecer médico: ${parecer?.resultado ?? 'não há'}`,
      `Perícias: ${pericias.length ? pericias.map((p) => `${p.tipo}: ${p.resultado ?? 'sem resultado'}`).join('; ') : 'nenhuma'}`,
      `Documentos do caso: ${docs.length ? docs.map((d) => `${d.nome} (${d.tipo})`).join('; ') : 'nenhum'}`,
      `Petição aprovada: ${aprovada ? aprovada.conteudo.slice(0, LIMITE_DA_PETICAO) : 'não está no sistema'}`,
      ...(acervo.length ? ['Trechos do acervo da casa (outros casos):', ...acervo.map((a) => `- ${a.trecho}`)] : []),
    ].join('\n')
    const fontes: FonteDaIa[] = [merito ? { tipo: 'publicacao', referencia: `publicacao:${merito.id}` } : { tipo: 'caso', referencia: `caso:${casoId}` }, ...acervo]
    const validar = (texto: string) => EstudoDaIa.safeParse(lerJson(texto)).success
    const s = await ia.sugerir('estudo_de_caso', { casoId, quem: null, conteudo, fontes }, { ...como, validar })
    if (!s) return null
    const estudo = EstudoDaIa.parse(lerJson(s.texto))
    if (estudo.novoProcesso) {
      const [ja] = await banco.select({ id: tarefa.id }).from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3b.05'))).limit(1)
      if (!ja) await banco.insert(tarefa).values({ casoId, passo: 'D3b.05', titulo: TITULO_REVISAR, perfilDono: 'senior', criadoEm: agora() })
    }
    // Só na primeira vez do caso: uma explicação já aprovada não reabre pelo estudo.
    const [explicacao] = await banco.select({ id: tarefa.id }).from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3b.06r'))).limit(1)
    if (!explicacao) await abrirExplicacaoDoResultado(banco, casoId)
    return s
  }

  // CA1: uma vez por caso; com estudo, o caso sai da lista do preparo.
  preparo.registrar(
    async () =>
      (
        await banco
          .select({ id: caso.id })
          .from(caso)
          .where(
            and(
              inArray(caso.desfecho, PERDIDOS),
              // GGVP-90 e GGVP-100: enquanto a Sênior decide o recurso, o caso espera.
              notExists(
                banco
                  .select({ id: tarefa.id })
                  .from(tarefa)
                  .where(and(eq(tarefa.casoId, caso.id), eq(tarefa.passo, 'D3b.04'), isNull(tarefa.concluidaEm))),
              ),
              notExists(
                banco
                  .select({ id: chamadaIa.id })
                  .from(chamadaIa)
                  .where(and(eq(chamadaIa.casoId, caso.id), eq(chamadaIa.finalidade, 'estudo_de_caso'), eq(chamadaIa.situacao, 'ok'))),
              ),
            ),
          )
      ).map((c) => c.id),
    (casoId) => estudar(casoId, { soPreparar: true }),
  )

  // CA5: a tela de estudos; o estudo mais novo de cada caso, os que esperam a revisão primeiro.
  app.get('/api/estudos', { preHandler: exigir(banco, 'estudo.ver', agora) }, async (pedido) => {
    const linhas = await banco
      .select({ chamada: chamadaIa, cliente: pessoa.nome, beneficio: caso.beneficio, desfecho: caso.desfecho })
      .from(chamadaIa)
      .innerJoin(caso, eq(chamadaIa.casoId, caso.id))
      .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
      .where(and(eq(chamadaIa.finalidade, 'estudo_de_caso'), eq(chamadaIa.situacao, 'ok')))
      .orderBy(desc(chamadaIa.quando))
    const ids = [...new Set(linhas.map((l) => l.chamada.casoId!))]
    const abertas = new Set(
      ids.length
        ? (await banco.select({ casoId: tarefa.casoId }).from(tarefa).where(and(inArray(tarefa.casoId, ids), eq(tarefa.passo, 'D3b.05'), isNull(tarefa.concluidaEm)))).map((t) => t.casoId)
        : [],
    )
    const revisoes = new Map(
      ids.length
        ? (
            await banco
              .select({ casoId: decisao.casoId, resultado: decisao.resultado, em: decisao.decididoEm, por: usuario.nome })
              .from(decisao)
              .innerJoin(usuario, eq(decisao.decididoPor, usuario.id))
              .where(and(inArray(decisao.casoId, ids), eq(decisao.passo, 'D3b.05'), eq(decisao.tipo, 'estudo_caso')))
          ).map((r) => [r.casoId, { novoProcesso: r.resultado === 'novo_processo', por: r.por, em: r.em.toISOString() }])
        : [],
    )
    const vistos = new Set<string>()
    const estudos = linhas.flatMap((l) => {
      const casoId = l.chamada.casoId!
      const estudo = EstudoDaIa.safeParse(lerJson(l.chamada.saida ?? ''))
      if (vistos.has(casoId) || !estudo.success) return []
      vistos.add(casoId)
      return [
        {
          casoId,
          cliente: l.cliente,
          beneficio: l.beneficio,
          resultado: ROTULO_RESULTADO[l.desfecho ?? ''] ?? l.desfecho ?? '—',
          geradoEm: l.chamada.quando.toISOString(),
          modelo: l.chamada.modelo,
          estudo: estudo.data,
          aRevisar: abertas.has(casoId),
          revisao: revisoes.get(casoId) ?? null,
        },
      ]
    })
    estudos.sort((a, b) => Number(b.aRevisar) - Number(a.aRevisar))
    return EstudosDeCaso.parse({ estudos, podeRevisar: pode(pedido.perfilAtivo, 'estudo.revisar') })
  })

  // CA3: a Sênior decide se entra com novo processo; a decisão guarda o estudo à parte e a tarefa fecha. Abrir o novo
  // processo é da GGVP-124 (nova demanda do cliente).
  app.post<{ Params: { id: string } }>('/api/casos/:id/estudo/revisao', { preHandler: exigir(banco, 'estudo.revisar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const entrada = RevisarEstudo.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Escolha se vamos entrar com novo processo')
    const [t] = await banco.select({ id: tarefa.id }).from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3b.05'), isNull(tarefa.concluidaEm))).limit(1)
    if (!t) return negar(resposta, 409, MSG_NADA_A_REVISAR)
    const [estudo] = await banco
      .select({ id: chamadaIa.id })
      .from(chamadaIa)
      .where(and(eq(chamadaIa.casoId, casoId), eq(chamadaIa.finalidade, 'estudo_de_caso'), eq(chamadaIa.situacao, 'ok')))
      .orderBy(desc(chamadaIa.quando))
      .limit(1)
    const quem = pedido.usuario!.id
    const { novoProcesso } = entrada.data
    await banco.transaction(async (tx) => {
      await tx.update(tarefa).set({ situacao: 'concluida', concluidaEm: agora(), concluidaPor: quem }).where(eq(tarefa.id, t.id))
      await tx.insert(decisao).values({
        casoId,
        passo: 'D3b.05',
        tipo: 'estudo_caso',
        resultado: novoProcesso ? 'novo_processo' : 'sem_novo_processo',
        sugestaoIa: estudo ? { chamadaId: estudo.id } : null,
        decididoPor: quem,
        perfil: pedido.perfilAtivo!,
        decididoEm: agora(),
      })
    })
    await historico(quem, 'estudo_revisado', pedido, `caso:${casoId}`, { novoProcesso })
    return resposta.code(201).send({ ok: true })
  })
}
