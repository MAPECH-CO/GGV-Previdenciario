// A segurança do contato no servidor (GGVP-138; telas da GGVP-111): terceiro não se passa pelo cliente. Telefone, e-mail e
// dados bancários só mudam com o cliente verificado (chamada de vídeo ou no escritório) e em contrato novo; a mudança
// bancária tem a segunda confirmação de outra pessoa, o aviso ao contato anterior e o alerta da prestação de contas. As
// regras são as puras das telas (regras/seguranca.ts), importadas.
// ponytail: as regras vêm de apps/web; mover para um pacote comum quando a ligação terminar.
import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { formatarTelefone } from '@ggv/campos'
import { PedidoDeMudancaBancaria, VerificacaoDaEdicao, type Erro, type PedidoBancario, type RegistroBancario } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { caso, dadoBancario, usuario } from '../banco/esquema.ts'
import { exigir, registrarHistorico } from '../sessao/rotas.ts'
import type { EdicaoFicha, Ficha } from '../../../web/src/dados/tipos.ts'
import type { IdPerfil } from '../../../web/src/dados/perfis.ts'
import {
  COMO_VERIFICOU,
  camposProtegidosQueMudam,
  erroDosDadosBancarios,
  motivoParaNaoMudar,
  pertoDaPrestacao,
  podeConfirmarSegunda,
  type Verificacao,
} from '../../../web/src/regras/seguranca.ts'
import { criarCorreio } from './mensagens.ts'
import { MSG_FICHA_NAO_ENCONTRADA, UUID, criarFichario } from './recepcao.ts'

export const MSG_SEM_PEDIDO_BANCARIO = 'Não há pedido de mudança dos dados bancários.'
/** O desfecho que leva à prestação de contas (CA2): o benefício deferido ou o juiz que deu o pedido. */
const DESFECHOS_PERTO = ['deferido', 'procedente_total', 'procedente_parcial']

const negar = (resposta: FastifyReply, status: number, erro: string) => resposta.code(status).send({ erro } satisfies Erro)
const lido = (d: { banco: string; agencia: string; conta: string; pix?: string | null }) => `${d.banco} · agência ${d.agencia} · conta ${d.conta}${d.pix ? ` · Pix: ${d.pix}` : ''}`
const comoFalado = (como: string) => COMO_VERIFICOU[como as Verificacao['como']].toLowerCase()

/**
 * O portão do telefone e do e-mail na edição da ficha (CA1): só mudam com o cliente verificado e em contrato novo; a
 * recusa fica no histórico. Completar o que estava em branco não é mudança. Passando, o antigo e o novo ficam no histórico
 * da ficha, com a verificação. A rota de editar a ficha (recepcao.ts) chama antes de gravar.
 */
export async function portaoDoContato(banco: Banco, agora: () => Date, pedido: FastifyRequest, ficha: Ficha, edicao: Pick<EdicaoFicha, 'telefone' | 'email'>): Promise<string | null> {
  const mudou = camposProtegidosQueMudam(ficha, edicao)
  if (mudou.length === 0) return null
  const entrada = VerificacaoDaEdicao.safeParse(pedido.body)
  const verificacao = (entrada.success ? (entrada.data.verificacao ?? null) : null) as Partial<Verificacao> | null
  const motivo = mudou.map((campo) => motivoParaNaoMudar(campo, verificacao)).find(Boolean)
  if (motivo) {
    await registrarHistorico(banco, agora)(pedido.usuario!.id, 'portao_bloqueado', pedido, `pessoa:${ficha.id}`, { portao: 'verificacao', passo: 'ficha', perfil: pedido.perfilAtivo, campos: mudou })
    return motivo
  }
  const { evento, nomeDe } = criarFichario(banco, agora)
  const quem = await nomeDe(pedido)
  for (const campo of mudou) {
    const falado = (v: string | undefined) => (campo === 'telefone' && v ? formatarTelefone(v) : v || '—')
    ficha.historico.push(
      evento(`Mudou o ${campo === 'telefone' ? 'telefone' : 'e-mail'} (${comoFalado(verificacao!.como!)}; em contrato novo): «${falado(ficha[campo])}» → «${falado(edicao[campo])}»`, quem),
    )
  }
  return null
}

type Opcoes = { banco: Banco; agora?: () => Date; ambiente?: Record<string, string | undefined> }

export function registrarRotasSeguranca(app: FastifyInstance, { banco, agora = () => new Date(), ambiente = process.env }: Opcoes) {
  const historico = registrarHistorico(banco, agora)
  const { evento, nomeDe, fichas, guardar, abrirTarefa } = criarFichario(banco, agora)
  const correio = criarCorreio(banco, agora, ambiente)
  const ver = { preHandler: exigir(banco, 'caso.ver', agora) }
  const pedir = { preHandler: exigir(banco, 'dados_bancarios.pedir', agora) }
  const confirmar = { preHandler: exigir(banco, 'dados_bancarios.confirmar', agora) }
  const acharFicha = async (id: string) => (UUID.test(id) ? (await fichas([id]))[0] : undefined)

  /** Os dados em vigor (a última confirmada) e o pedido aberto, com os nomes de quem pediu. */
  async function dadosDa(fichaId: string) {
    const linhas = await banco
      .select({ d: dadoBancario, quem: usuario.nome })
      .from(dadoBancario)
      .innerJoin(usuario, eq(dadoBancario.pedidoPor, usuario.id))
      .where(and(eq(dadoBancario.pessoaId, fichaId), isNull(dadoBancario.descartadoEm)))
      .orderBy(asc(dadoBancario.pedidoEm))
    const atual = linhas.filter((l) => l.d.confirmadoEm).at(-1)
    const aberto = linhas.find((l) => !l.d.confirmadoEm)
    const dados = (d: typeof dadoBancario.$inferSelect) => ({ banco: d.banco, agencia: d.agencia, conta: d.conta, ...(d.pix && { pix: d.pix }) })
    return {
      atual: atual ? ({ ...dados(atual.d), fichaId, desde: atual.d.confirmadoEm!.toISOString(), quem: atual.quem } satisfies RegistroBancario) : null,
      pedido: aberto
        ? ({
            fichaId,
            dados: dados(aberto.d),
            verificacao: { como: aberto.d.verificacao as Verificacao['como'], contratoNovo: true },
            pediu: aberto.quem,
            pedidoEm: aberto.d.pedidoEm.toISOString(),
          } satisfies PedidoBancario)
        : null,
      linhaAberta: aberto?.d,
    }
  }

  // GGVP-111: os dados em vigor e o pedido que espera a segunda confirmação.
  app.get<{ Params: { id: string } }>('/api/fichas/:id/dados-bancarios', ver, async (pedido, resposta) => {
    if (!UUID.test(pedido.params.id)) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const { atual, pedido: aberto } = await dadosDa(pedido.params.id)
    return { atual, pedido: aberto }
  })

  // GGVP-111 CA1, CA5: só com o cliente verificado e em contrato novo; espera a segunda confirmação. Outro pedido aberto sai.
  app.post<{ Params: { id: string } }>('/api/fichas/:id/dados-bancarios', pedir, async (pedido, resposta) => {
    const entrada = PedidoDeMudancaBancaria.safeParse(pedido.body)
    if (!entrada.success) return negar(resposta, 400, 'Escreva o banco.')
    const { dados } = entrada.data
    const verificacao = (entrada.data.verificacao ?? null) as Partial<Verificacao> | null
    const ficha = await acharFicha(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const erro = erroDosDadosBancarios(dados)
    if (erro) return negar(resposta, 400, erro)
    const semVerificacao = motivoParaNaoMudar('dadosBancarios', verificacao)
    if (semVerificacao) {
      await historico(pedido.usuario!.id, 'portao_bloqueado', pedido, `pessoa:${ficha.id}`, { portao: 'verificacao', passo: 'D3b.02', perfil: pedido.perfilAtivo })
      return negar(resposta, 400, semVerificacao)
    }
    await banco.update(dadoBancario).set({ descartadoEm: agora() }).where(and(eq(dadoBancario.pessoaId, ficha.id), isNull(dadoBancario.confirmadoEm), isNull(dadoBancario.descartadoEm)))
    await banco.insert(dadoBancario).values({ pessoaId: ficha.id, ...dados, pix: dados.pix || null, verificacao: verificacao!.como!, pedidoPor: pedido.usuario!.id, pedidoEm: agora() })
    ficha.historico.push(evento(`Pediu a mudança dos dados bancários (${comoFalado(verificacao!.como!)}; em contrato novo): espera a segunda confirmação`, await nomeDe(pedido)))
    await guardar(ficha)
    await historico(pedido.usuario!.id, 'dados_bancarios_pedidos', pedido, `pessoa:${ficha.id}`, { verificacao: verificacao!.como })
    return (await dadosDa(ficha.id)).pedido
  })

  /**
   * GGVP-111 CA5, CA2: a segunda pessoa confirma; os dados mudam, com o antigo e o novo no histórico; o contato anterior
   * recebe o aviso pelo Chatwoot; perto da prestação de contas, a advogada e o Financeiro recebem o alerta.
   */
  app.post<{ Params: { id: string } }>('/api/fichas/:id/dados-bancarios/confirmacao', confirmar, async (pedido, resposta) => {
    const ficha = await acharFicha(pedido.params.id)
    if (!ficha) return negar(resposta, 404, MSG_FICHA_NAO_ENCONTRADA)
    const { atual: antes, pedido: aberto, linhaAberta } = await dadosDa(ficha.id)
    if (!aberto || !linhaAberta) return negar(resposta, 404, MSG_SEM_PEDIDO_BANCARIO)
    const perfil = pedido.perfilAtivo!.replace('_', '-') as IdPerfil
    const motivo = podeConfirmarSegunda(perfil, pedido.usuario!.id, linhaAberta.pedidoPor)
    if (motivo) return negar(resposta, 403, motivo)
    const quem = await nomeDe(pedido)
    await banco.update(dadoBancario).set({ confirmadoPor: pedido.usuario!.id, confirmadoEm: agora() }).where(eq(dadoBancario.id, linhaAberta.id))
    const novo = (await dadosDa(ficha.id)).atual!
    ficha.historico.push(
      evento(
        `Mudou os dados bancários (${comoFalado(aberto.verificacao.como)}; em contrato novo; pedido de ${aberto.pediu}, segunda confirmação de ${quem}): ` +
          `«${antes ? lido(antes) : '—'}» → «${lido(novo)}»`,
        quem,
      ),
    )
    const casos = ficha.processos.length
      ? await banco.select({ id: caso.id, desfecho: caso.desfecho }).from(caso).where(and(inArray(caso.id, ficha.processos.map((p) => p.id)), isNull(caso.encerradoEm)))
      : []
    const perto = ficha.processos.find((p) => pertoDaPrestacao(p.etapa) || DESFECHOS_PERTO.includes(casos.find((c) => c.id === p.id)?.desfecho ?? ''))
    if (perto) {
      for (const setor of ['Jurídico', 'Financeiro'] as const) {
        await abrirTarefa({
          id: `banco-${ficha.id}-${randomUUID()}`,
          codigo: 'D3b.02',
          cliente: { id: ficha.id, nome: ficha.nome },
          acao: 'Dados bancários mudaram',
          detalhe: 'antes do OK e do repasse, confira a conta nova · mudança verificada hoje',
          prazo: 'hoje',
          urgente: true,
          href: `/clientes/${ficha.id}`,
          processoId: perto.id,
          setor,
        })
      }
    }
    await guardar(ficha)
    await historico(pedido.usuario!.id, 'dados_bancarios_confirmados', pedido, `pessoa:${ficha.id}`, { alerta: Boolean(perto) })
    // O aviso ao contato cadastrado, pelo Chatwoot: se não foi o cliente, ele liga para o escritório (CA5).
    const pronta = await correio.preparar(ficha, 'aviso-de-mudanca')
    await correio.enviar(pedido, ficha, { modelo: 'aviso-de-mudanca', texto: pronta.texto, conversa: pronta.conversas[0]?.id ?? 0 })
    return novo
  })
}
