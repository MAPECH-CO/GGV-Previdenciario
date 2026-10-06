// Publicações da vigília (GGVP-26, GGVP-34, GGVP-37, GGVP-74): fila de revisão da Sênior, leitura e classificação.
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { VincularPublicacao, type Erro } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { publicacao } from '../banco/esquema.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { casoDoCnj, pedirLeitura } from '../vigilia/casar.ts'
import { itensDaFila } from '../vigilia/fila.ts'

export const MSG_CNJ_SEM_CASO = 'Nenhum processo do escritório tem esse número CNJ.'

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasPublicacoes(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const historico = registrarHistorico(banco, agora)

  // GGVP-26 CA7, CA10, CA12: a fila da Sênior, com a idade e o prazo mínimo de cada item.
  app.get('/api/publicacoes/fila', { preHandler: exigir(banco, 'publicacao.casar', agora) }, async () => itensDaFila(banco, agora()))

  // GGVP-26 CA8, CA9, CA11: vincular com o CNJ de um processo existente, ou registrar que não é do escritório.
  app.post<{ Params: { id: string } }>('/api/publicacoes/:id/vinculo', { preHandler: exigir(banco, 'publicacao.casar', agora) }, async (pedido, resposta) => {
    const entrada = VincularPublicacao.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
    const [p] = await banco.select().from(publicacao).where(eq(publicacao.id, pedido.params.id))
    if (!p || p.fila !== 'revisao') return negar(resposta, 404, 'Esta publicação não está na fila de revisão.')
    const quem = pedido.usuario!.id
    const d = entrada.data
    if (d.decisao === 'fora_do_escritorio') {
      await banco.update(publicacao).set({ fila: null, foraDoEscritorio: true, vinculadaPor: quem, vinculadaEm: agora() }).where(eq(publicacao.id, p.id))
      await historico(quem, 'publicacao_fora_do_escritorio', pedido, `publicacao:${p.id}`)
      return resposta.code(201).send({ ok: true })
    }
    const casoId = await casoDoCnj(banco, d.numeroCnj)
    if (!casoId) return negar(resposta, 409, MSG_CNJ_SEM_CASO)
    await banco
      .update(publicacao)
      .set({ fila: null, casoId, numeroCnj: d.numeroCnj, vinculadaPor: quem, vinculadaEm: agora() })
      .where(eq(publicacao.id, p.id))
    // CA9: daqui em diante, segue como qualquer publicação casada: a advogada lê e classifica.
    await pedirLeitura(banco, casoId)
    await historico(quem, 'publicacao_vinculada', pedido, `publicacao:${p.id}`, { casoId, numeroCnj: d.numeroCnj })
    return resposta.code(201).send({ ok: true, casoId })
  })
}
