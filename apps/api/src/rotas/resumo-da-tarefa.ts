// O balão da tarefa na Central (Pedro, 16/10): ao passar o mouse, a IA explica a tarefa em poucas frases.
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { PedidoDoResumoDaTarefa, ROTULO_FASE_DA_LISTA, SugestaoDoResumo, nomeDoBeneficio, pode, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { caso, pessoa } from '../banco/esquema.ts'
import type { Ia } from '../ia/ia.ts'
import { exigir } from '../sessao/rotas.ts'

type Opcoes = { banco: Banco; ia: Ia; agora?: () => Date }

export const MSG_SEM_RESUMO_DA_TAREFA = 'A IA não resumiu agora.'

/**
 * Vai o que a linha já mostra; do caso, só o benefício, a fase e o resultado, para quem vê o caso: nada de saúde. A
 * sugestão fica guardada pelo conteúdo, então passar de novo pela mesma tarefa não chama a IA outra vez.
 */
export function registrarRotasResumoDaTarefa(app: FastifyInstance, { banco, ia, agora = () => new Date() }: Opcoes) {
  app.post('/api/tarefas/resumo', { preHandler: exigir(banco, 'tarefa.ver', agora) }, async (pedido, resposta) => {
    const entrada = PedidoDoResumoDaTarefa.safeParse(pedido.body)
    if (!entrada.success) return resposta.code(400).send({ erro: entrada.error.issues[0]?.message ?? 'Confira a tarefa.' } satisfies Erro)
    const t = entrada.data
    const [c] =
      t.casoId && pode(pedido.perfilAtivo, 'caso.ver')
        ? await banco
            .select({ cliente: pessoa.nome, situacao: pessoa.situacao, beneficio: caso.beneficio, fase: caso.fase, desfecho: caso.desfecho })
            .from(caso)
            .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
            .where(eq(caso.id, t.casoId))
        : []
    const conteudo = [
      `Tarefa: ${t.acao}`,
      t.detalhe && `Detalhe da tarefa: ${t.detalhe}`,
      t.prazo && `Prazo: ${t.prazo}${t.urgente ? ' (urgente)' : ''}`,
      t.contexto && `De onde vem: ${t.contexto}`,
      c && `Cliente: ${c.cliente} (${c.situacao === 'cliente' ? 'cliente' : 'lead'})`,
      c && `Benefício: ${nomeDoBeneficio(c.beneficio)}`,
      c && `Fase do processo: ${ROTULO_FASE_DA_LISTA[c.fase as keyof typeof ROTULO_FASE_DA_LISTA] ?? c.fase}`,
      c?.desfecho && `Resultado registrado: ${c.desfecho}`,
    ]
      .filter(Boolean)
      .join('\n')
    const casoId = c ? t.casoId! : null
    const fontes = [casoId ? { tipo: 'caso' as const, referencia: `caso:${casoId}` } : { tipo: 'regra' as const, referencia: 'tarefa' }]
    const s = await ia.sugerir('resumo_tarefa', { casoId, quem: pedido.usuario!.id, conteudo, fontes })
    return SugestaoDoResumo.parse({ sugestao: s, motivo: s ? null : MSG_SEM_RESUMO_DA_TAREFA })
  })
}
