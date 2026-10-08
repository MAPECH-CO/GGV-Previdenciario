// Regras do roteiro em código (GGVP-25, G19): a tela que confere a documentação ou a perícia manda as entradas e recebe o
// resultado com as entradas usadas, a regra, o fundamento e a versão (CA6). O número sai daqui, nunca do modelo (CA7).
import { ENTRADA_DA_REGRA, REGRAS, ResultadoDaRegra, type Regra } from '@ggv/contratos'
import type { FastifyInstance } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { calcular } from '../fluxo/regras.ts'
import { exigir } from '../sessao/rotas.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'

export function registrarRotasRegras(app: FastifyInstance, { banco, agora = () => new Date() }: { banco: Banco; agora?: () => Date }) {
  app.post<{ Params: { regra: string } }>('/api/regras/:regra', { preHandler: exigir(banco, 'laudo.conferir', agora) }, async (pedido, resposta) => {
    const regra = pedido.params.regra as Regra
    if (!(REGRAS as readonly string[]).includes(regra)) return resposta.code(404).send({ erro: 'Regra não encontrada.' })
    const entrada = ENTRADA_DA_REGRA[regra].safeParse(pedido.body ?? {})
    if (!entrada.success) return resposta.code(400).send({ erro: entrada.error.issues[0]?.message ?? 'Confira as entradas.' })
    return ResultadoDaRegra.parse(calcular(regra, entrada.data, hojeEmBrasilia(agora())))
  })
}
