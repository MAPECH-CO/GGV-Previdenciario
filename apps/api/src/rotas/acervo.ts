// Conferir desfechos do lote (GGVP-55 CA7): a Sênior confere ou corrige o desfecho lido de cada processo do acervo.
// Só o conferido entra nas contas da jurimetria; o antes e o depois vão para o histórico.
import { ConferirDesfecho, type Erro } from '@ggv/contratos'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { processoAcervo } from '../banco/esquema.ts'
import { conferenciaDoAcervo } from '../fluxo/acervo.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'

const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const UUID = /^[0-9a-f-]{36}$/

export function registrarRotasAcervo(app: FastifyInstance, { banco, agora = () => new Date() }: { banco: Banco; agora?: () => Date }) {
  const historico = registrarHistorico(banco, agora)
  const daSenior = { preHandler: exigir(banco, 'acervo.conferir_desfecho', agora) }

  app.get('/api/acervo/conferencia', daSenior, () => conferenciaDoAcervo(banco))

  app.post<{ Params: { id: string } }>('/api/acervo/processos/:id/conferencia', daSenior, async (pedido, resposta) => {
    const entrada = ConferirDesfecho.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Escolha o desfecho')
    const id = pedido.params.id
    const [antes] = UUID.test(id) ? await banco.select().from(processoAcervo).where(eq(processoAcervo.id, id)) : []
    if (!antes) return negar(resposta, 404, 'Processo não encontrado no acervo.')
    const quem = pedido.usuario!.id
    // A condição vai no próprio update: duas Sêniores ao mesmo tempo, só a primeira confere.
    const [conferido] = await banco
      .update(processoAcervo)
      .set({ desfecho: entrada.data.desfecho, desfechoConferidoPor: quem })
      .where(and(eq(processoAcervo.id, id), isNotNull(processoAcervo.desfecho), isNull(processoAcervo.desfechoConferidoPor)))
      .returning()
    if (!conferido) return negar(resposta, 409, antes.desfecho ? 'Esse desfecho já foi conferido.' : 'Esse processo ainda não tem desfecho lido.')
    await historico(quem, 'acervo_desfecho_conferido', pedido, `acervo:${id}`, { antes: antes.desfecho, depois: entrada.data.desfecho })
    return conferenciaDoAcervo(banco)
  })
}
