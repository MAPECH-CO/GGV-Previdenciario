// Juízo identificado (GGVP-64, parte 1): a jurimetria do juízo do processo. É estratégia interna: só o Jurídico vê
// (`estudo.ver`), e os números nunca vão ao cliente nem ao Atendimento (G22).
import { JurimetriaDoJuizo, type Erro } from '@ggv/contratos'
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { caso } from '../banco/esquema.ts'
import { juizoDoCaso, jurimetriaDoJuizo } from '../fluxo/juizo.ts'
import { exigir } from '../sessao/rotas.ts'

export const MSG_SEM_NUMERO = 'O caso ainda não tem número de processo.'
type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasJuizo(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  // CA1, CA2: o juízo sai do número CNJ do caso; os números, do acervo (CA4, CA5).
  app.get<{ Params: { id: string } }>('/api/casos/:id/juizo', { preHandler: exigir(banco, 'estudo.ver', agora) }, async (pedido, resposta) => {
    const [c] = await banco.select({ id: caso.id }).from(caso).where(eq(caso.id, pedido.params.id))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    const juizo = await juizoDoCaso(banco, c.id)
    if (!juizo) return negar(resposta, 404, MSG_SEM_NUMERO)
    return JurimetriaDoJuizo.parse(await jurimetriaDoJuizo(banco, juizo, agora()))
  })
}
