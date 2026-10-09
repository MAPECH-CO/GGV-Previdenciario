// SÓ PARA OS TESTES (GGVP-138). O antigo servidor de exemplo, agora o servidor falso das telas nos testes, com a semente.
// Era: Servidor de exemplo da segurança do contato (GGVP-111), sobre o mesmo banco de servidor.ts: telefone, e-mail e
// dados bancários só mudam com o cliente verificado e em contrato novo; a mudança bancária tem a segunda confirmação, o
// aviso ao contato anterior e o alerta da prestação de contas. Ligar no servidor: trocar o corpo de cada função por fetch
// no endpoint da design.md (change ggvp-12).
import { formatarTelefone } from '../../campos.ts'
import { dataHora } from '../../regras/datas.ts'
import {
  COMO_VERIFICOU,
  camposProtegidosQueMudam,
  erroDosDadosBancarios,
  motivoParaNaoMudar,
  pertoDaPrestacao,
  podeConfirmarSegunda,
  type DadosBancarios,
  type Verificacao,
} from '../../regras/seguranca.ts'
import { papelDoPerfil } from '../../regras/conversa.ts'
import type { QuemAge } from './conversa.ts'
import { enviarMensagem, prepararMensagem } from './mensagens.ts'
import { agora, esperar, evento, gravar, ler, salvarFicha, type Banco } from '../../dados/servidor.ts'
import type { EdicaoFicha, Ficha, TarefaEncaminhada } from '../../dados/tipos.ts'

// O que a edição muda de telefone e e-mail é regra pura, que o servidor também usa (GGVP-138).
export { camposProtegidosQueMudam }

/** Os dados bancários em vigor de uma ficha, com quem cadastrou e desde quando. */
export type RegistroBancario = DadosBancarios & { fichaId: string; desde: string; quem: string }

/** O pedido de mudança, esperando a segunda confirmação (CA5). */
export type PedidoBancario = { fichaId: string; dados: DadosBancarios; verificacao: Verificacao; pediu: string; pedidoEm: string }

/** A conta da Lúcia Exemplo, para o repasse da pensão: dados falsos de propósito. */
function contasDeExemplo(): RegistroBancario[] {
  return [{ fichaId: 'lucia-exemplo', banco: 'Banco Exemplo', agencia: '0001', conta: '12345-6', pix: 'o telefone cadastrado', desde: '2026-07-12T14:00:00.000Z', quem: 'Atendimento' }]
}

function contasDo(banco: Banco): RegistroBancario[] {
  banco.dadosBancarios ??= contasDeExemplo()
  return banco.dadosBancarios
}

const lido = (d: DadosBancarios) => `${d.banco} · agência ${d.agencia} · conta ${d.conta}${d.pix ? ` · Pix: ${d.pix}` : ''}`

/** GET /api/fichas/:id/dados-bancarios. Os dados em vigor e o pedido que espera a segunda confirmação. */
export async function obterDadosBancarios(fichaId: string): Promise<{ atual: RegistroBancario | null; pedido: PedidoBancario | null }> {
  const banco = ler()
  return { atual: contasDo(banco).filter((c) => c.fichaId === fichaId).at(-1) ?? null, pedido: banco.pedidosBancarios?.find((p) => p.fichaId === fichaId) ?? null }
}

/** POST /api/fichas/:id/dados-bancarios. Só com o cliente verificado e em contrato novo (CA1); espera a segunda confirmação (CA5). */
export async function pedirMudancaBancaria(fichaId: string, pedido: { dados: DadosBancarios; verificacao: Partial<Verificacao> | null }, por: QuemAge): Promise<PedidoBancario> {
  await esperar()
  if (!papelDoPerfil(por.perfil)) throw new Error('A mudança dos dados bancários é do Atendimento e do Jurídico.')
  const erro = erroDosDadosBancarios(pedido.dados) ?? motivoParaNaoMudar('dadosBancarios', pedido.verificacao)
  if (erro) throw new Error(erro)
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  const novo: PedidoBancario = { fichaId, dados: pedido.dados, verificacao: pedido.verificacao as Verificacao, pediu: por.quem, pedidoEm: agora().toISOString() }
  banco.pedidosBancarios = [...(banco.pedidosBancarios ?? []).filter((p) => p.fichaId !== fichaId), novo]
  ficha.historico.push(evento(`Pediu a mudança dos dados bancários (${COMO_VERIFICOU[novo.verificacao.como].toLowerCase()}; em contrato novo): espera a segunda confirmação`, por.quem))
  gravar(banco)
  return novo
}

/**
 * POST /api/fichas/:id/dados-bancarios/confirmacao. A segunda pessoa confirma (CA5): os dados mudam, e a mudança fica no
 * histórico, sem os números (CA1); o contato anterior recebe o aviso pelo Chatwoot (CA5); perto da prestação de contas, a advogada e o
 * Financeiro recebem o alerta antes do OK e do repasse (CA2).
 */
export async function confirmarMudancaBancaria(fichaId: string, por: QuemAge): Promise<RegistroBancario> {
  await esperar()
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  const pedido = banco.pedidosBancarios?.find((p) => p.fichaId === fichaId)
  if (!ficha || !pedido) throw new Error('Não há pedido de mudança dos dados bancários.')
  const motivo = podeConfirmarSegunda(por.perfil, por.quem, pedido.pediu)
  if (motivo) throw new Error(motivo)
  const novo: RegistroBancario = { ...pedido.dados, fichaId, desde: agora().toISOString(), quem: pedido.pediu }
  contasDo(banco).push(novo)
  banco.pedidosBancarios = banco.pedidosBancarios!.filter((p) => p !== pedido)
  // GGVP-96 (LGPD, minimização): como no servidor, o histórico guarda só o fato, sem banco, conta nem Pix.
  ficha.historico.push(
    evento(`Mudou os dados bancários (${COMO_VERIFICOU[pedido.verificacao.como].toLowerCase()}; em contrato novo; pedido de ${pedido.pediu}, segunda confirmação de ${por.quem})`, por.quem),
  )
  const perto = ficha.processos.find((p) => pertoDaPrestacao(p.etapa))
  if (perto) {
    for (const setor of ['Jurídico', 'Financeiro'] as const) {
      banco.seq += 1
      const alerta: TarefaEncaminhada = {
        id: `banco-${fichaId}-${banco.seq}`,
        codigo: 'D3b.02',
        cliente: { id: ficha.id, nome: ficha.nome },
        acao: 'Dados bancários mudaram',
        detalhe: `antes do OK e do repasse, confira a conta nova (${lido(novo)}) · mudança verificada em ${dataHora(novo.desde)}`,
        prazo: 'hoje',
        urgente: true,
        href: `/clientes/${ficha.id}`,
        processoId: perto.id,
        setor,
      }
      banco.tarefas.push(alerta)
    }
  }
  gravar(banco)
  await avisarContatoAnterior(ficha, por)
  return novo
}

/** O aviso ao contato cadastrado, pelo Chatwoot: se não foi o cliente, ele liga para o escritório (CA5). */
async function avisarContatoAnterior(ficha: Ficha, por: QuemAge) {
  const pronta = await prepararMensagem(ficha.id, 'aviso-de-mudanca')
  await enviarMensagem(ficha.id, { modelo: 'aviso-de-mudanca', texto: pronta.texto, conversa: pronta.conversas[0]?.id ?? 0 }, por)
}

/**
 * PATCH /api/fichas/:id com a verificação (CA1): mudar o telefone ou o e-mail só com o cliente verificado e em contrato
 * novo; o antigo e o novo ficam no histórico. O resto da ficha segue o salvarFicha de sempre.
 */
export async function salvarFichaVerificada(
  id: string,
  edicao: EdicaoFicha,
  verificacao: Partial<Verificacao> | null,
  por: QuemAge,
): ReturnType<typeof salvarFicha> {
  const antes = ler().fichas.find((f) => f.id === id)
  if (!antes) throw new Error('Ficha não encontrada')
  const mudou = camposProtegidosQueMudam(antes, edicao)
  for (const campo of mudou) {
    const motivo = motivoParaNaoMudar(campo, verificacao)
    if (motivo) throw new Error(motivo)
  }
  const resposta = await salvarFicha(id, edicao)
  if ('erro' in resposta || mudou.length === 0) return resposta
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === id)!
  const como = COMO_VERIFICOU[verificacao!.como!].toLowerCase()
  for (const campo of mudou) {
    const lidoDe = (v: string | undefined) => (campo === 'telefone' && v ? formatarTelefone(v) : v || '—')
    ficha.historico.push(evento(`Mudou o ${campo === 'telefone' ? 'telefone' : 'e-mail'} (${como}; em contrato novo): «${lidoDe(antes[campo])}» → «${lidoDe(ficha[campo])}»`, por.quem))
  }
  gravar(banco)
  return { ficha }
}
