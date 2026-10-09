// Glossário do escritório (GGVP-143): uma seção da Configuração do escritório. A gestão vê; só a Sênior acrescenta,
// corrige e tira (`glossario.editar`). Cada mudança vai ao histórico da configuração na mesma transação, com o antes e
// o depois (CA1). A transcrição e a IA leem o mesmo banco por `termosDoGlossario` (CA2).
import { GlossarioDoEscritorio, SalvarTermo, pode, type Erro } from '@ggv/contratos'
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { glossarioTermo } from '../banco/esquema.ts'
import { termosDoGlossario } from '../fluxo/glossario.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'

type Opcoes = { banco: Banco; agora?: () => Date }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const UUID = /^[0-9a-f-]{36}$/
export const MSG_TERMO_REPETIDO = 'Esse termo já está no glossário.'
const MSG_NAO_ENCONTRADO = 'Termo não encontrado.'

/** O mesmo termo, mesmo com outra maiúscula, bate no índice único `glossario_termo_unico`. */
const ehRepetido = (e: unknown) => [(e as { code?: string }).code, (e as { cause?: { code?: string } }).cause?.code].includes('23505')
const comoEra = (t: typeof glossarioTermo.$inferSelect) => ({ termo: t.termo, tipo: t.tipo, significado: t.significado })

export function registrarRotasGlossario(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const editar = { preHandler: exigir(banco, 'glossario.editar', agora) }
  const historico = (tx: Banco) => registrarHistorico(tx, agora)
  const buscar = async (id: string) => (UUID.test(id) ? (await banco.select().from(glossarioTermo).where(eq(glossarioTermo.id, id)))[0] : undefined)

  app.get('/api/configuracao/glossario', { preHandler: exigir(banco, 'gestao.ver', agora) }, async (pedido) =>
    GlossarioDoEscritorio.parse({ termos: await termosDoGlossario(banco), podeEditar: pode(pedido.perfilAtivo, 'glossario.editar') }),
  )

  app.post('/api/configuracao/glossario', editar, async (pedido, resposta) => {
    const entrada = SalvarTermo.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o termo.')
    const quem = pedido.usuario!.id
    try {
      const id = await banco.transaction(async (tx) => {
        const [t] = await tx.insert(glossarioTermo).values({ ...entrada.data, alteradoPor: quem }).returning()
        await historico(tx)(quem, 'glossario_termo_acrescentado', pedido, 'configuracao', { termo: t.termo, depois: comoEra(t) })
        return t.id
      })
      return resposta.code(201).send({ ok: true, id })
    } catch (e) {
      if (ehRepetido(e)) return negar(resposta, 409, MSG_TERMO_REPETIDO)
      throw e
    }
  })

  app.put<{ Params: { id: string } }>('/api/configuracao/glossario/:id', editar, async (pedido, resposta) => {
    const entrada = SalvarTermo.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o termo.')
    const antes = await buscar(pedido.params.id)
    if (!antes) return negar(resposta, 404, MSG_NAO_ENCONTRADO)
    const quem = pedido.usuario!.id
    try {
      await banco.transaction(async (tx) => {
        const [t] = await tx
          .update(glossarioTermo)
          .set({ ...entrada.data, alteradoPor: quem, atualizadoEm: agora() })
          .where(eq(glossarioTermo.id, antes.id))
          .returning()
        await historico(tx)(quem, 'glossario_termo_corrigido', pedido, 'configuracao', { termo: antes.termo, antes: comoEra(antes), depois: comoEra(t) })
      })
      return resposta.code(201).send({ ok: true })
    } catch (e) {
      if (ehRepetido(e)) return negar(resposta, 409, MSG_TERMO_REPETIDO)
      throw e
    }
  })

  app.delete<{ Params: { id: string } }>('/api/configuracao/glossario/:id', editar, async (pedido, resposta) => {
    const antes = await buscar(pedido.params.id)
    if (!antes) return negar(resposta, 404, MSG_NAO_ENCONTRADO)
    const quem = pedido.usuario!.id
    // Tirar apaga o termo; o que ele era fica no histórico.
    await banco.transaction(async (tx) => {
      await tx.delete(glossarioTermo).where(eq(glossarioTermo.id, antes.id))
      await historico(tx)(quem, 'glossario_termo_tirado', pedido, 'configuracao', { termo: antes.termo, antes: comoEra(antes) })
    })
    return { ok: true }
  })
}
