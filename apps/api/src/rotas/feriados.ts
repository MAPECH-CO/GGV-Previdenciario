// Feriados e suspensões dos tribunais na Configuração do escritório (GGVP-146, parte 3). A gestão vê; quem muda a
// configuração (Sênior e Sócio) acrescenta, tira e carrega os da lei de 2026 e 2027. Cada mudança entra no histórico
// na mesma transação, com o dia, o tribunal e o que era: nada se perde quando um feriado sai da lista.
import { ANOS_DE_FERIADOS, FeriadosDoEscritorio, NovoFeriado, TRIBUNAIS_CONHECIDOS, pode, type Erro, type TribunalConhecido } from '@ggv/contratos'
import { dataParaIso, isoParaData, normalizarData } from '@ggv/campos'
import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { Banco } from '../banco/conexao.ts'
import { eventoAuditoria, feriado, usuario } from '../banco/esquema.ts'
import { feriadosDaLei } from '../fluxo/feriados.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'

export const MSG_FERIADO_REPETIDO = 'Este dia já está na lista deste tribunal.'
const ALVO = 'feriados'
const UUID = /^[0-9a-f-]{36}$/

type Opcoes = { banco: Banco; agora?: () => Date }
type Detalhe = { data?: string; tribunal?: TribunalConhecido | null; descricao?: string; anos?: number[]; acrescentados?: number }
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const onde = (tribunal: TribunalConhecido | null | undefined) => (tribunal ? TRIBUNAIS_CONHECIDOS[tribunal] : 'nacional')
/** Um dia por tribunal: a unicidade do banco não pega o nacional (tribunal nulo), então a conferência é aqui. */
const chave = (data: string, tribunal: string | null) => `${data}|${tribunal ?? ''}`
/** Uma mudança na lista por vez: duas gravações ao mesmo tempo não repetem o dia nacional. Sai no fim da transação. */
const umaPorVez = (tx: Pick<Banco, 'execute'>) => tx.execute(sql`select pg_advisory_xact_lock(hashtext('feriados'))`)

function descrever(acao: string, d: Detalhe) {
  if (acao === 'feriados_carregados') return `Carregou os feriados da lei de ${d.anos?.join(' e ')}: ${d.acrescentados} dia(s) acrescentado(s)`
  const verbo = acao === 'feriado_tirado' ? 'Tirou' : 'Acrescentou'
  return `${verbo} ${isoParaData(d.data) ?? d.data} · ${onde(d.tribunal)} · ${d.descricao}`
}

export function registrarRotasFeriados(app: FastifyInstance, { banco, agora = () => new Date() }: Opcoes) {
  const editar = { preHandler: exigir(banco, 'configuracao.editar', agora) }

  app.get('/api/configuracao/feriados', { preHandler: exigir(banco, 'gestao.ver', agora) }, async (pedido) => {
    const feriados = await banco.select().from(feriado).orderBy(asc(feriado.data), asc(feriado.tribunal))
    const eventos = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.alvo, ALVO)).orderBy(desc(eventoAuditoria.quando)).limit(50)
    const ids = [...new Set(eventos.map((e) => e.quem).filter((q) => UUID.test(q)))]
    const nomes = new Map((ids.length ? await banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, ids)) : []).map((u) => [u.id, u.nome]))
    return FeriadosDoEscritorio.parse({
      feriados,
      historico: eventos.map((e) => ({ quando: e.quando.toISOString(), quem: nomes.get(e.quem) ?? 'Sem sessão', descricao: descrever(e.acao, e.detalhe as Detalhe) })),
      podeEditar: pode(pedido.perfilAtivo, 'configuracao.editar'),
    })
  })

  app.post('/api/configuracao/feriados', editar, async (pedido, resposta) => {
    const entrada = NovoFeriado.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira o feriado.')
    const { tribunal, descricao } = entrada.data
    const data = dataParaIso(normalizarData(entrada.data.data))!
    const quem = pedido.usuario!.id
    const criado = await banco.transaction(async (tx) => {
      await umaPorVez(tx)
      const mesmoDia = await tx.select().from(feriado).where(eq(feriado.data, data))
      if (mesmoDia.some((f) => f.tribunal === tribunal)) return null
      const [f] = await tx.insert(feriado).values({ data, tribunal, descricao }).returning()
      await registrarHistorico(tx, agora)(quem, 'feriado_acrescentado', pedido, ALVO, { data, tribunal, descricao })
      return f
    })
    if (!criado) return negar(resposta, 409, MSG_FERIADO_REPETIDO)
    return resposta.code(201).send({ feriado: criado })
  })

  app.delete<{ Params: { id: string } }>('/api/configuracao/feriados/:id', editar, async (pedido, resposta) => {
    if (!UUID.test(pedido.params.id)) return negar(resposta, 404, 'Feriado não encontrado.')
    const quem = pedido.usuario!.id
    const tirado = await banco.transaction(async (tx) => {
      const [f] = await tx.delete(feriado).where(eq(feriado.id, pedido.params.id)).returning()
      if (f) await registrarHistorico(tx, agora)(quem, 'feriado_tirado', pedido, ALVO, { data: f.data, tribunal: f.tribunal, descricao: f.descricao })
      return f
    })
    return tirado ? { ok: true } : negar(resposta, 404, 'Feriado não encontrado.')
  })

  // Os da lei de 2026 e 2027: acrescenta só o dia que falta; o que a Sênior acrescentou fica como está.
  app.post('/api/configuracao/feriados/carga', editar, async (pedido) => {
    const quem = pedido.usuario!.id
    const acrescentados = await banco.transaction(async (tx) => {
      await umaPorVez(tx)
      const existentes = new Set((await tx.select().from(feriado)).map((f) => chave(f.data, f.tribunal)))
      const novos = ANOS_DE_FERIADOS.flatMap((ano) => feriadosDaLei(ano)).filter((f) => !existentes.has(chave(f.data, f.tribunal)))
      if (novos.length > 0) await tx.insert(feriado).values(novos)
      await registrarHistorico(tx, agora)(quem, 'feriados_carregados', pedido, ALVO, { anos: [...ANOS_DE_FERIADOS], acrescentados: novos.length })
      return novos.length
    })
    return { acrescentados }
  })
}
