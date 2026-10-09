// Conferir desfechos do lote (GGVP-55 CA7): a Sênior confere ou corrige o desfecho lido de cada processo do acervo.
// Só o conferido entra nas contas da jurimetria; o antes e o depois vão para o histórico. GGVP-41: o desfecho do portal
// ganha a ficha da IA em segundo plano, e a Sênior confere a tese junto.
import { CompletarAcervo, ConferirDesfecho, type Erro } from '@ggv/contratos'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { caso, processoAcervo } from '../banco/esquema.ts'
import { conferenciaDoAcervo } from '../fluxo/acervo.ts'
import { desfechosSemFicha, fichaDoDesfecho } from '../fluxo/ficha-do-desfecho.ts'
import type { Ia } from '../ia/ia.ts'
import type { Preparo } from '../ia/preparo.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import { UUID } from './gestao.ts'

const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)

type Opcoes = { banco: Banco; agora?: () => Date; ia: Ia; preparo: Preparo }

export function registrarRotasAcervo(app: FastifyInstance, { banco, agora = () => new Date(), ia, preparo }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const daSenior = { preHandler: exigir(banco, 'acervo.conferir_desfecho', agora) }

  // GGVP-41 CA4, CA11: a ficha de cada desfecho do portal, pela rodada da sugestão pronta (uma tentativa por dia).
  preparo.registrar(
    () => desfechosSemFicha(banco),
    (acervoId) => fichaDoDesfecho(banco, ia, acervoId, { soPreparar: true }),
  )

  app.get('/api/acervo/conferencia', daSenior, () => conferenciaDoAcervo(banco))

  app.post<{ Params: { id: string } }>('/api/acervo/processos/:id/conferencia', daSenior, async (pedido, resposta) => {
    const entrada = ConferirDesfecho.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Escolha o desfecho')
    const id = pedido.params.id
    const [antes] = UUID.test(id) ? await banco.select().from(processoAcervo).where(eq(processoAcervo.id, id)) : []
    if (!antes) return negar(resposta, 404, 'Processo não encontrado no acervo.')
    const quem = pedido.usuario!.id
    const { desfecho, tese } = entrada.data
    // GGVP-41 CA7: a tese vem junto quando a tela manda (vazia: fora do recorte por tese, CA5); sem ela, fica a que estava.
    const comTese = tese === undefined ? {} : { tese: tese || null }
    // A condição vai no próprio update: duas Sêniores ao mesmo tempo, só a primeira confere.
    const [conferido] = await banco
      .update(processoAcervo)
      .set({ desfecho, desfechoConferidoPor: quem, ...comTese })
      .where(and(eq(processoAcervo.id, id), isNotNull(processoAcervo.desfecho), isNull(processoAcervo.desfechoConferidoPor)))
      .returning()
    if (!conferido) return negar(resposta, 409, antes.desfecho ? 'Esse desfecho já foi conferido.' : 'Esse processo ainda não tem desfecho lido.')
    const teses = tese === undefined ? {} : { teseAntes: antes.tese, tese: conferido.tese }
    await historico(quem, 'acervo_desfecho_conferido', pedido, `acervo:${id}`, { antes: antes.desfecho, depois: desfecho, ...teses })
    return conferenciaDoAcervo(banco)
  })

  // GGVP-153 CA2, CA3: a pergunta de um clique só completa o que falta (o que já tem valor não muda). Vara e juiz vão ao
  // caso, de onde a Gestão recorta; vara e tese, ao processo do acervo. Nada trava enquanto ninguém responde.
  app.post<{ Params: { id: string } }>('/api/acervo/processos/:id/completar', daSenior, async (pedido, resposta) => {
    const entrada = CompletarAcervo.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Escolha ou escreva o que falta.')
    const id = pedido.params.id
    const [linha] = UUID.test(id)
      ? await banco
          .select({ casoId: caso.id, tese: processoAcervo.tese, conferido: processoAcervo.desfechoConferidoPor, vara: caso.vara, juiz: caso.juiz })
          .from(processoAcervo)
          .innerJoin(caso, eq(processoAcervo.casoId, caso.id))
          .where(eq(processoAcervo.id, id))
      : []
    if (!linha?.conferido) return negar(resposta, 404, 'Processo conferido não encontrado no acervo.')
    const { vara, juiz, tese } = entrada.data
    const novo = {
      ...(vara && !linha.vara?.trim() && { vara }),
      ...(juiz && !linha.juiz?.trim() && { juiz }),
      ...(tese && !linha.tese?.trim() && { tese }),
    }
    if (!Object.keys(novo).length) return negar(resposta, 409, 'Esse processo já tem o que você mandou.')
    await banco.transaction(async (tx) => {
      if (novo.vara || novo.juiz) await tx.update(caso).set({ ...(novo.vara && { vara: novo.vara }), ...(novo.juiz && { juiz: novo.juiz }) }).where(eq(caso.id, linha.casoId))
      if (novo.vara || novo.tese) await tx.update(processoAcervo).set({ ...(novo.vara && { vara: novo.vara }), ...(novo.tese && { tese: novo.tese }) }).where(eq(processoAcervo.id, id))
    })
    await historico(pedido.usuario!.id, 'acervo_completado', pedido, `acervo:${id}`, { caso: linha.casoId, antes: { vara: linha.vara, juiz: linha.juiz, tese: linha.tese }, depois: novo })
    return conferenciaDoAcervo(banco)
  })
}
