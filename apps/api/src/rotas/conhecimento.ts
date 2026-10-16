// A base histórica no portal (GGVP-163 R5): a página de cada benefício, com a síntese e as taxas de `conhecimento.portal_*`.
// Jurimetria é estratégia interna: só o Jurídico e o Sócio (`estudo.ver`). A data da base vem da tabela a cada pedido (CA4).
import { BENEFICIOS, BaseHistoricaDoBeneficio, type Erro } from '@ggv/contratos'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { baseHistoricaDoBeneficio } from '../fluxo/conhecimento.ts'
import { exigir } from '../sessao/rotas.ts'

export const MSG_BENEFICIO_DESCONHECIDO = 'Benefício desconhecido.'
type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

export function registrarRotasConhecimento(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  app.get<{ Params: { beneficio: string } }>('/api/base-historica/:beneficio', { preHandler: exigir(banco, 'estudo.ver', agora) }, async (pedido, resposta) => {
    const beneficio = pedido.params.beneficio
    if (!(BENEFICIOS as readonly string[]).includes(beneficio)) return negar(resposta, 404, MSG_BENEFICIO_DESCONHECIDO)
    return BaseHistoricaDoBeneficio.parse(await baseHistoricaDoBeneficio(banco, beneficio))
  })
}
