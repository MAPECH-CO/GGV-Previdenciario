// Vigília do diário (GGVP-30, G13): painel da Sênior, alarme na Central e reprocessamento da rodada que falhou.
import { and, asc, desc, eq, gte, inArray, lt } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { PainelDaVigilia, TarefaDaCentral, pode, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { publicacaoDescarte, rodadaVigilia, usuario } from '../banco/esquema.ts'
import { ehDiaUtil } from '../fluxo/prazo-inss.ts'
import { feriadosDoProcesso } from '../fluxo/prazo-judicial.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { hojeEmBrasilia, itensDaFila } from '../vigilia/fila.ts'
import type { Fonte } from '../vigilia/fontes.ts'
import { momentoDoHorario, rodar } from '../vigilia/rodadas.ts'

type Opcoes = { banco: Banco; fontes: Fonte[]; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const UM_DIA_MS = 86_400_000
const horaBr = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(d)
const PENDENTES = ['falhou', 'nao_rodou'] as const

/** CA1, CA3, CA11: rodada com falha (ou que não rodou) dos últimos 7 dias vira "Reprocessar vigília" no topo da Sênior. */
export async function alarmesDaVigilia(banco: Banco, agora: Date) {
  const linhas = await banco
    .select()
    .from(rodadaVigilia)
    .where(and(inArray(rodadaVigilia.situacao, [...PENDENTES]), gte(rodadaVigilia.previstaPara, new Date(agora.getTime() - 7 * UM_DIA_MS))))
    .orderBy(asc(rodadaVigilia.previstaPara))
  return linhas.map((r) =>
    TarefaDaCentral.parse({
      id: r.id,
      casoId: null,
      passo: 'D4.01',
      cliente: null,
      contexto: 'Vigília das publicações',
      titulo: 'Reprocessar vigília',
      detalhe: `${r.situacao === 'nao_rodou' ? 'a rodada não rodou' : 'a rodada falhou'} · ${horaBr(r.previstaPara)} · ${r.fonte.toUpperCase()} · ${r.erro ?? ''}`,
      tela: '/vigilia',
      prazo: hojeEmBrasilia(agora),
      urgente: true,
    }),
  )
}

export function registrarRotasVigiliaDiario(app: FastifyInstance, { banco, fontes, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  // CA2, CA4, CA5, CA12 e GGVP-26 CA6: as rodadas do dia, a situação do dia, a fila e os descartes.
  app.get('/api/vigilia', { preHandler: exigir(banco, 'vigilia.ver', agora) }, async (pedido) => {
    const dia = hojeEmBrasilia(agora())
    const de = momentoDoHorario(dia, '00:00')
    const ate = new Date(de.getTime() + UM_DIA_MS)
    const rodadas = await banco
      .select()
      .from(rodadaVigilia)
      .where(and(gte(rodadaVigilia.previstaPara, de), lt(rodadaVigilia.previstaPara, ate)))
      .orderBy(asc(rodadaVigilia.previstaPara), asc(rodadaVigilia.fonte))
    const nomes = new Map(
      (await banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario)).map((u) => [u.id, u.nome] as const),
    )
    const falhas = rodadas.filter((r) => (PENDENTES as readonly string[]).includes(r.situacao)).length
    const concluidas = rodadas.filter((r) => r.situacao === 'ok').length
    const capturadas = rodadas.reduce((s, r) => s + r.capturadas, 0)
    // CA5: com falha pendente, "incompleta", nunca "sem publicações". CA12: tudo OK, dia útil e nada capturado.
    const situacaoDoDia =
      falhas > 0
        ? 'incompleta'
        : rodadas.length > 0 && concluidas === rodadas.length
          ? capturadas === 0 && ehDiaUtil(dia, await feriadosDoProcesso(banco, null))
            ? 'sem_publicacao'
            : 'ok'
          : 'em_andamento'
    const descartes = await banco
      .select()
      .from(publicacaoDescarte)
      .where(gte(publicacaoDescarte.criadoEm, de))
      .orderBy(desc(publicacaoDescarte.criadoEm))
    return PainelDaVigilia.parse({
      dia,
      situacaoDoDia,
      rodadas: rodadas.map((r) => ({
        id: r.id,
        fonte: r.fonte,
        previstaPara: r.previstaPara.toISOString(),
        situacao: r.situacao,
        inicio: r.inicio?.toISOString() ?? null,
        fim: r.fim?.toISOString() ?? null,
        capturadas: r.capturadas,
        erro: r.erro,
        reprocessadaPor: r.reprocessadaPor ? (nomes.get(r.reprocessadaPor) ?? null) : null,
        reprocessadaEm: r.reprocessadaEm?.toISOString() ?? null,
      })),
      previstas: rodadas.length,
      concluidas,
      falhas,
      fila: pode(pedido.perfilAtivo, 'publicacao.casar') ? await itensDaFila(banco, agora()) : [],
      descartes: descartes.map((d) => ({ quando: d.criadoEm.toISOString(), fonte: d.fonte, numeroCnj: d.numeroCnj, trecho: d.trecho, motivo: d.motivo })),
      podeReprocessar: pode(pedido.perfilAtivo, 'vigilia.reprocessar'),
      podeCasar: pode(pedido.perfilAtivo, 'publicacao.casar'),
    })
  })

  // CA6: reprocessar captura o período perdido sem duplicar e registra quem e quando.
  app.post<{ Params: { id: string } }>(
    '/api/vigilia/rodadas/:id/reprocessar',
    { preHandler: exigir(banco, 'vigilia.reprocessar', agora) },
    async (pedido, resposta) => {
      const [r] = await banco.select().from(rodadaVigilia).where(eq(rodadaVigilia.id, pedido.params.id))
      if (!r || !(PENDENTES as readonly string[]).includes(r.situacao)) return negar(resposta, 409, 'Esta rodada não está com falha.')
      const fonte = fontes.find((f) => f.nome === r.fonte)
      if (!fonte) return negar(resposta, 409, `A fonte ${r.fonte} não está ligada neste ambiente.`)
      const quem = pedido.usuario!.id
      const resultado = await rodar(banco, r.id, fonte, agora)
      await banco.update(rodadaVigilia).set({ reprocessadaPor: quem, reprocessadaEm: agora() }).where(eq(rodadaVigilia.id, r.id))
      await historico(quem, 'vigilia_reprocessada', pedido, `rodada:${r.id}`, resultado)
      return resposta.code(201).send(resultado)
    },
  )
}
