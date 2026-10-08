// Texto ao vivo (GGVP-133 CA4): o navegador transcreve ao vivo direto na OpenAI com uma chave temporária, pedida aqui pelo
// servidor para uma gravação em curso; a chave de verdade nunca vai ao navegador. Só no escritório: a ligação não tem
// texto ao vivo. O texto que vale no caso é o final, com quem fala, que o servidor gera depois.
import { ChaveAoVivo, type Erro } from '@ggv/contratos'
import type { FastifyInstance } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { termosDoGlossario } from '../fluxo/glossario.ts'
import type { Ia } from '../ia/ia.ts'
import { exigir } from '../sessao/rotas.ts'
import { criarFichario } from './recepcao.ts'

type Opcoes = { banco: Banco; agora?: () => Date; ia: Ia }
export const MSG_SEM_AO_VIVO = 'O texto ao vivo não está disponível agora: a transcrição sai quando a gravação terminar.'

export function registrarRotasTranscricao(app: FastifyInstance, { banco, agora = () => new Date(), ia }: Opcoes) {
  const { acharGravacao } = criarFichario(banco, agora)

  app.post<{ Params: { id: string } }>('/api/gravacoes/:id/chave-ao-vivo', { preHandler: exigir(banco, 'entrevista.gravar', agora) }, async (pedido, resposta) => {
    const achado = await acharGravacao(pedido.params.id)
    if (!achado) return resposta.code(404).send({ erro: 'Gravação não encontrada.' } satisfies Erro)
    const { gravacao: g } = achado
    if (g.origem !== 'portal' || (g.estado !== 'gravando' && g.estado !== 'pausada')) return resposta.code(400).send({ erro: 'A gravação não está em curso.' } satisfies Erro)
    const termos = (await termosDoGlossario(banco)).map((t) => t.termo)
    const chave = await ia.chaveAoVivo({ casoId: null, quem: pedido.usuario!.id, termos, sensivel: g.soJuridico, referencia: `gravacao:${g.id}` })
    if (!chave) return resposta.code(503).send({ erro: MSG_SEM_AO_VIVO } satisfies Erro)
    return ChaveAoVivo.parse(chave)
  })
}
