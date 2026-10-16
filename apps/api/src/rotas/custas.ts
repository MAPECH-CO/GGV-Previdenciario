// Custas do processo (GGVP-157, Lucas 13/10): o que se gastou e o que se ganhou em cada caso. A Sênior lança com o
// comprovante e o lançamento espera o Financeiro, que confere e aprova ou recusa; o que o Financeiro lança já entra
// aprovado. Ganhos são os honorários da prestação que o Financeiro recebeu. As travas são `custas.*` e, na visão do mês,
// `valores.ver`: nenhuma depende de `processo.abrir`, porque o Financeiro não abre o processo.
// O histórico de cada lançamento fica no alvo `custo:<id>`, fora da linha do processo, que o Jurídico lê sem ver valores.
// ponytail: lê todos os custos e prestações e soma aqui, como o painel Financeiro; passar a soma para o SQL quando forem milhares.
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import {
  CustasDoProcesso,
  LancarCusto,
  MSG_SEM_COMPROVANTE,
  Mes,
  ProcessoParaCusto,
  RecusarCusto,
  ROTULO_BENEFICIO,
  ROTULO_FASE_DA_LISTA,
  VisaoDasCustas,
  custasDoMes,
  pode,
  somarCustas,
  type Beneficio,
  type Erro,
  type SituacaoDoCusto,
} from '@ggv/contratos'
import type { Armazenamento } from '../armazenamento.ts'
import type { Banco } from '../banco/conexao.ts'
import { caso, custoProcesso, eventoAuditoria, pessoa, prestacaoContas, usuario } from '../banco/esquema.ts'
import { exigir } from '../sessao/rotas.ts'
import { bateNaBusca } from '../../../web/src/regras/busca.ts'
import { hojeEmBrasilia } from '../vigilia/fila.ts'
import { TIPOS_DE_ANEXO, guardarArquivo, lerFormulario } from './formulario.ts'

export const MSG_DATA_FUTURA = 'A data do gasto não pode ser depois de hoje.'
export const MSG_JA_DECIDIDO = 'Este lançamento não está esperando o Financeiro.'
export const MSG_CANCELADO = 'Este lançamento foi cancelado.'

type Opcoes = { banco: Banco; agora?: () => Date; armazenamento: Armazenamento }
type Tx = Parameters<Parameters<Banco['transaction']>[0]>[0]
type Custo = typeof custoProcesso.$inferSelect
type ComCusto = { Params: { id: string; custo: string } }
const UUID = /^[0-9a-f-]{36}$/
const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
/** O que o histórico guarda de cada versão do lançamento (CA8): o antes e o depois. */
const retrato = (c: Pick<Custo, 'data' | 'descricao' | 'valor' | 'situacao'>) => ({ data: c.data, descricao: c.descricao, valor: c.valor, situacao: c.situacao })

export function registrarRotasCustas(app: FastifyInstance, { banco, agora = () => new Date(), armazenamento }: Opcoes) {
  const noHistorico = (tx: Tx, pedido: FastifyRequest, acao: string, custoId: string, detalhe: Record<string, unknown>) =>
    tx.insert(eventoAuditoria).values({ quem: pedido.usuario!.id, acao, alvo: `custo:${custoId}`, quando: agora(), detalhe: { ip: pedido.ip, ...detalhe } })

  const doCaso = async (casoId: string) =>
    UUID.test(casoId)
      ? ((await banco.select({ cliente: pessoa.nome, beneficio: caso.beneficio, fase: caso.fase, desfecho: caso.desfecho }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(eq(caso.id, casoId)))[0] ?? null)
      : null

  /** Os ganhos de cada caso: os honorários da versão mais recente da prestação que o Financeiro recebeu (versão nova corrige a anterior, não soma). */
  async function ganhosRecebidos(casoIds?: string[]) {
    const versoes = await banco
      .select({ casoId: prestacaoContas.casoId, honorarios: prestacaoContas.honorarios, recebidaEm: prestacaoContas.recebidaEm })
      .from(prestacaoContas)
      .where(casoIds ? and(isNotNull(prestacaoContas.recebidaEm), inArray(prestacaoContas.casoId, casoIds)) : isNotNull(prestacaoContas.recebidaEm))
      .orderBy(desc(prestacaoContas.versao))
    const porCaso = new Map<string, { casoId: string; valor: string; dia: string }>()
    for (const v of versoes) if (!porCaso.has(v.casoId)) porCaso.set(v.casoId, { casoId: v.casoId, valor: v.honorarios, dia: hojeEmBrasilia(v.recebidaEm!) })
    return [...porCaso.values()]
  }

  async function nomes(ids: string[]) {
    const unicos = [...new Set(ids)]
    const linhas = unicos.length ? await banco.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, unicos)) : []
    const mapa = new Map(linhas.map((l) => [l.id, l.nome]))
    return (id: string) => mapa.get(id) ?? 'Pessoa removida'
  }

  const lancamento = (c: Custo, nome: (id: string) => string) => ({
    id: c.id,
    data: c.data,
    descricao: c.descricao,
    lancadoPor: nome(c.lancadoPor),
    valor: c.valor,
    situacao: c.situacao as SituacaoDoCusto,
    motivo: c.motivo,
  })

  const doLancamento = (casoId: string, custoId: string) => and(eq(custoProcesso.id, custoId), eq(custoProcesso.casoId, casoId))
  /** O lançamento do caso, travado na transação: dois pedidos ao mesmo tempo passam um de cada vez. */
  const custoDoCaso = async (tx: Tx, casoId: string, custoId: string) =>
    UUID.test(casoId) && UUID.test(custoId) ? ((await tx.select().from(custoProcesso).where(doLancamento(casoId, custoId)).for('update'))[0] ?? null) : null

  // CA1: o card do processo (Sênior e sócios) e o detalhe do Financeiro na visão dele (CA6).
  app.get<{ Params: { id: string } }>('/api/casos/:id/custas', { preHandler: exigir(banco, 'custas.ver', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const c = await doCaso(casoId)
    if (!c) return negar(resposta, 404, 'Caso não encontrado.')
    const custos = await banco.select().from(custoProcesso).where(eq(custoProcesso.casoId, casoId)).orderBy(desc(custoProcesso.data), desc(custoProcesso.criadoEm))
    const ganhos = await ganhosRecebidos([casoId])
    const nome = await nomes(custos.map((x) => x.lancadoPor))
    const lancamentos = custos.map((x) => lancamento(x, nome))
    return CustasDoProcesso.parse({
      casoId,
      cliente: c.cliente,
      beneficio: c.beneficio ? (ROTULO_BENEFICIO[c.beneficio as Beneficio] ?? c.beneficio) : null,
      origem: c.fase === 'judicial' || c.desfecho?.startsWith('procedente') ? 'justica' : 'inss',
      totais: somarCustas(
        ganhos.map((g) => g.valor),
        lancamentos,
      ),
      lancamentos,
      podeLancar: pode(pedido.perfilAtivo, 'custas.lancar'),
      podeAprovar: pode(pedido.perfilAtivo, 'custas.aprovar'),
    })
  })

  // CA2, CA3: lançar com data, descrição, valor e o comprovante (foto ou PDF); sem comprovante, não envia. Da Sênior espera
  // o Financeiro; do Financeiro já entra aprovado.
  app.post<{ Params: { id: string } }>('/api/casos/:id/custas', { preHandler: exigir(banco, 'custas.lancar', agora) }, async (pedido, resposta) => {
    const casoId = pedido.params.id
    const formulario = await lerFormulario(pedido)
    if (!formulario) return negar(resposta, 400, MSG_SEM_COMPROVANTE)
    const entrada = LancarCusto.safeParse(formulario.campos)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
    if (entrada.data.data > hojeEmBrasilia(agora())) return negar(resposta, 400, MSG_DATA_FUTURA)
    const arquivo = formulario.arquivo
    if (!arquivo || !TIPOS_DE_ANEXO.includes(arquivo.mime) || arquivo.conteudo.length === 0) return negar(resposta, 400, MSG_SEM_COMPROVANTE)
    if (!(await doCaso(casoId))) return negar(resposta, 404, 'Caso não encontrado.')
    const guardado = await guardarArquivo(armazenamento, casoId, arquivo, 'comprovante-custo')
    const quem = pedido.usuario!.id
    const doFinanceiro = pode(pedido.perfilAtivo, 'custas.aprovar')
    const novo = await banco.transaction(async (tx) => {
      const [c] = await tx
        .insert(custoProcesso)
        .values({
          casoId,
          ...entrada.data,
          comprovanteChave: guardado.chaveArmazenamento,
          comprovanteMime: guardado.mime,
          comprovanteNome: guardado.nomeOriginal,
          lancadoPor: quem,
          situacao: doFinanceiro ? 'aprovado' : 'esperando',
          ...(doFinanceiro && { decididoPor: quem, decididoEm: agora() }),
        })
        .returning()
      await noHistorico(tx, pedido, 'custo_lancado', c.id, { depois: retrato(c) })
      return c
    })
    return resposta.code(201).send({ id: novo.id, situacao: novo.situacao })
  })

  /** Aprovar ou recusar (CA3): só o que espera o Financeiro. */
  async function decidir(pedido: FastifyRequest<ComCusto>, resposta: FastifyReply, situacao: 'aprovado' | 'recusado', motivo: string | null) {
    const quem = pedido.usuario!.id
    const r = await banco.transaction(async (tx) => {
      const c = await custoDoCaso(tx, pedido.params.id, pedido.params.custo)
      if (!c) return 404 as const
      if (c.situacao !== 'esperando') return 409 as const
      const [depois] = await tx.update(custoProcesso).set({ situacao, motivo, decididoPor: quem, decididoEm: agora() }).where(eq(custoProcesso.id, c.id)).returning()
      await noHistorico(tx, pedido, situacao === 'aprovado' ? 'custo_aprovado' : 'custo_recusado', c.id, { antes: retrato(c), depois: retrato(depois), ...(motivo && { motivo }) })
      return depois.situacao
    })
    if (r === 404) return negar(resposta, 404, 'Lançamento não encontrado.')
    if (r === 409) return negar(resposta, 409, MSG_JA_DECIDIDO)
    return { ok: true, situacao: r }
  }

  app.post<ComCusto>('/api/casos/:id/custas/:custo/aprovacao', { preHandler: exigir(banco, 'custas.aprovar', agora) }, (pedido, resposta) => decidir(pedido, resposta, 'aprovado', null))

  app.post<ComCusto>('/api/casos/:id/custas/:custo/recusa', { preHandler: exigir(banco, 'custas.aprovar', agora) }, (pedido, resposta) => {
    const entrada = RecusarCusto.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Diga o motivo da recusa.')
    return decidir(pedido, resposta, 'recusado', entrada.data.motivo)
  })

  /**
   * CA8: corrigir ou cancelar guarda o antes e o depois, quem e quando; nada é apagado. Corrigido pela Sênior, volta a
   * esperar o Financeiro (inclusive o recusado, que ela reenvia); pelo Financeiro, fica aprovado.
   */
  async function mudar(pedido: FastifyRequest<ComCusto>, resposta: FastifyReply, acao: 'custo_corrigido' | 'custo_cancelado', campos: LancarCusto | null) {
    const quem = pedido.usuario!.id
    const doFinanceiro = pode(pedido.perfilAtivo, 'custas.aprovar')
    const r = await banco.transaction(async (tx) => {
      const c = await custoDoCaso(tx, pedido.params.id, pedido.params.custo)
      if (!c) return 404 as const
      if (c.situacao === 'cancelado') return 409 as const
      const novo = campos
        ? { ...campos, motivo: null, ...(doFinanceiro ? { situacao: 'aprovado', decididoPor: quem, decididoEm: agora() } : { situacao: 'esperando', decididoPor: null, decididoEm: null }) }
        : { situacao: 'cancelado' }
      const [depois] = await tx.update(custoProcesso).set(novo).where(eq(custoProcesso.id, c.id)).returning()
      await noHistorico(tx, pedido, acao, c.id, { antes: retrato(c), depois: retrato(depois) })
      return depois.situacao
    })
    if (r === 404) return negar(resposta, 404, 'Lançamento não encontrado.')
    if (r === 409) return negar(resposta, 409, MSG_CANCELADO)
    return { ok: true, situacao: r }
  }

  app.post<ComCusto>('/api/casos/:id/custas/:custo/correcao', { preHandler: exigir(banco, 'custas.lancar', agora) }, (pedido, resposta) => {
    const entrada = LancarCusto.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, entrada.error.issues[0]?.message ?? 'Confira os campos.')
    if (entrada.data.data > hojeEmBrasilia(agora())) return negar(resposta, 400, MSG_DATA_FUTURA)
    return mudar(pedido, resposta, 'custo_corrigido', entrada.data)
  })

  app.post<ComCusto>('/api/casos/:id/custas/:custo/cancelamento', { preHandler: exigir(banco, 'custas.lancar', agora) }, (pedido, resposta) =>
    mudar(pedido, resposta, 'custo_cancelado', null),
  )

  // O comprovante, pelas mesmas permissões das custas. Imagem e PDF abrem no navegador, sem rodar script do arquivo.
  app.get<ComCusto>('/api/casos/:id/custas/:custo/comprovante', { preHandler: exigir(banco, 'custas.ver', agora) }, async (pedido, resposta) => {
    const { id: casoId, custo } = pedido.params
    const [c] = UUID.test(casoId) && UUID.test(custo) ? await banco.select().from(custoProcesso).where(doLancamento(casoId, custo)) : []
    if (!c) return negar(resposta, 404, 'Lançamento não encontrado.')
    let conteudo: Buffer
    try {
      conteudo = await armazenamento.ler(c.comprovanteChave)
    } catch {
      return negar(resposta, 404, 'O comprovante não está no armazenamento.')
    }
    return resposta
      .header('content-type', c.comprovanteMime)
      .header('x-content-type-options', 'nosniff')
      .header('content-security-policy', "sandbox; default-src 'none'")
      .header('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(c.comprovanteNome)}`)
      .send(conteudo)
  })

  // CA6: a visão do Financeiro e dos sócios (`valores.ver`): o que aprovar, de qualquer mês, e os totais do mês por processo.
  app.get<{ Querystring: { mes?: string } }>('/api/custas', { preHandler: exigir(banco, 'valores.ver', agora) }, async (pedido, resposta) => {
    const mes = Mes.safeParse(pedido.query.mes ?? hojeEmBrasilia(agora()).slice(0, 7))
    if (!mes.success) return negar(resposta, 400, 'Mês inválido.')
    const custos = await banco.select().from(custoProcesso).orderBy(desc(custoProcesso.data), desc(custoProcesso.criadoEm))
    const ganhos = await ganhosRecebidos()
    const doMes = custasDoMes(
      ganhos,
      custos.map((c) => ({ ...c, situacao: c.situacao as SituacaoDoCusto })),
      mes.data,
    )
    const esperando = custos.filter((c) => c.situacao === 'esperando')
    const ids = [...new Set([...doMes.porProcesso.map((p) => p.casoId), ...esperando.map((c) => c.casoId)])]
    const clientes = new Map(
      (ids.length ? await banco.select({ id: caso.id, nome: pessoa.nome }).from(caso).innerJoin(pessoa, eq(caso.pessoaId, pessoa.id)).where(inArray(caso.id, ids)) : []).map((c) => [c.id, c.nome]),
    )
    const cliente = (casoId: string) => clientes.get(casoId) ?? ''
    const nome = await nomes(esperando.map((c) => c.lancadoPor))
    return VisaoDasCustas.parse({
      mes: mes.data,
      paraAprovar: esperando.map((c) => ({ ...lancamento(c, nome), casoId: c.casoId, cliente: cliente(c.casoId) })),
      porProcesso: doMes.porProcesso.map((p) => ({ ...p, cliente: cliente(p.casoId) })).sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR')),
      totalDoMes: doMes.totalDoMes,
    })
  })

  // "Novo custo" na visão das custas (Pedro, 16/10): quem lança acha o processo pelo nome, CPF ou telefone do cliente, pela
  // regra da busca do balcão. ponytail: lê todos os casos e filtra aqui, como a base de Clientes; buscar no SQL quando forem milhares.
  app.get<{ Querystring: { busca?: string } }>('/api/custas/processos', { preHandler: exigir(banco, 'custas.lancar', agora) }, async (pedido) => {
    const termo = (pedido.query.busca ?? '').trim()
    if (termo.length < 2) return []
    const casos = await banco
      .select({ casoId: caso.id, cliente: pessoa.nome, cpf: pessoa.cpf, telefone: pessoa.telefone, beneficio: caso.beneficio, fase: caso.fase })
      .from(caso)
      .innerJoin(pessoa, eq(caso.pessoaId, pessoa.id))
    return casos
      .filter((c) => bateNaBusca({ nome: c.cliente, cpf: c.cpf ?? undefined, telefone: c.telefone ?? '' }, termo))
      .sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'))
      .slice(0, 20)
      .map((c) =>
        ProcessoParaCusto.parse({
          casoId: c.casoId,
          cliente: c.cliente,
          beneficio: c.beneficio ? (ROTULO_BENEFICIO[c.beneficio as Beneficio] ?? c.beneficio) : null,
          fase: ROTULO_FASE_DA_LISTA[c.fase as keyof typeof ROTULO_FASE_DA_LISTA] ?? c.fase,
        }),
      )
  })
}
