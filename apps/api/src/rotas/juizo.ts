// Juízo identificado (GGVP-64): a jurimetria do juízo do processo. É estratégia interna: só o Jurídico vê
// (`estudo.ver`), e os números nunca vão ao cliente nem ao Atendimento (G22). Parte 2: a vara e o juiz conferidos no caso
// e os entendimentos recorrentes do juízo, que a IA tira das decisões de mérito em segundo plano.
import { JurimetriaDoJuizo, type Erro } from '@ggv/contratos'
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { caso } from '../banco/esquema.ts'
import { entendimentosDoJuizo, juizoDoCaso, juizosParaLer, jurimetriaDoJuizo } from '../fluxo/juizo.ts'
import type { Ia } from '../ia/ia.ts'
import type { Preparo } from '../ia/preparo.ts'
import { exigir } from '../sessao/rotas.ts'

export const MSG_SEM_NUMERO = 'O caso ainda não tem número de processo.'
type Opcoes = { banco: Banco; agora?: () => Date; ia: Ia; preparo: Preparo }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasJuizo(app: FastifyInstance, { banco, agora = () => new Date(), ia, preparo }: Opcoes) {
  // Parte 2 (CA2): os entendimentos de cada juízo com decisão nova, pela rodada da sugestão pronta.
  preparo.registrar(
    () => juizosParaLer(banco),
    (juizo) => entendimentosDoJuizo(banco, ia, juizo, agora(), { soPreparar: true }),
  )

  // CA1, CA2: o juízo sai do número CNJ do caso; os números, do acervo (CA4, CA5); a vara e o juiz, do caso.
  app.get<{ Params: { id: string } }>('/api/casos/:id/juizo', { preHandler: exigir(banco, 'estudo.ver', agora) }, async (pedido, resposta) => {
    const [c] = await banco.select({ id: caso.id, vara: caso.vara, juiz: caso.juiz }).from(caso).where(eq(caso.id, pedido.params.id))
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    const juizo = await juizoDoCaso(banco, c.id)
    if (!juizo) return negar(resposta, 404, MSG_SEM_NUMERO)
    return JurimetriaDoJuizo.parse(await jurimetriaDoJuizo(banco, juizo, agora(), { vara: c.vara, juiz: c.juiz }))
  })
}
