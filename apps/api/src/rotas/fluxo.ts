// Onde o caso está no BPMN (GGVP-105 CA2, CA7): os passos de cada diagrama, os ramos de cada junção, as esperas por
// quem está fora e as perícias com o passo que chamou. É o estado que as telas mostram; a ordem é conferida em cada rota.
import { EstadoDoFluxo, type Erro } from '@ggv/contratos'
import { asc, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { caso, etapa, pericia } from '../banco/esquema.ts'
import { exigir } from '../sessao/rotas.ts'

type Opcoes = { banco: Banco; agora?: () => Date }

export function registrarRotasFluxo(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  app.get<{ Params: { id: string } }>('/api/casos/:id/fluxo', { preHandler: exigir(banco, 'caso.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const [c] = await banco.select({ fase: caso.fase }).from(caso).where(eq(caso.id, casoId))
    if (!c) return resposta.code(404).send({ erro: 'Caso não encontrado.' } satisfies Erro)
    const passos = await banco.select().from(etapa).where(eq(etapa.casoId, casoId)).orderBy(asc(etapa.iniciadaEm))
    const pericias = await banco
      .select({ tipo: pericia.tipo, resultado: pericia.resultado, diagrama: etapa.diagrama, passo: etapa.passo })
      .from(pericia)
      .leftJoin(etapa, eq(pericia.chamadaPorEtapaId, etapa.id))
      .where(eq(pericia.casoId, casoId))
      .orderBy(asc(pericia.criadoEm))
    return EstadoDoFluxo.parse({
      casoId,
      fase: c.fase,
      passos: passos.map((p) => ({
        diagrama: p.diagrama,
        passo: p.passo,
        situacao: p.situacao,
        juncao: p.juncao,
        aguardando: p.aguardando,
        iniciadaEm: p.iniciadaEm.toISOString(),
        concluidaEm: p.concluidaEm?.toISOString() ?? null,
      })),
      pericias: pericias.map((p) => ({ tipo: p.tipo, chamadaPor: p.passo ? `${p.diagrama} · ${p.passo}` : null, resultado: p.resultado })),
    })
  })
}
