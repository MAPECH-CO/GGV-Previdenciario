// SÓ PARA OS TESTES (GGVP-138). O antigo servidor de exemplo, agora o servidor falso das telas nos testes, com a semente.
// Era: Servidor de exemplo das mensagens ao cliente (GGVP-102), sobre o mesmo banco de servidor.ts. O envio sai pelo
// Chatwoot simulado (chatwoot.ts), na conversa do cliente; cada envio fica registrado com o status de entrega. O OK da
// advogada na prestação de contas (GGVP-11) e o texto aprovado do resultado desfavorável chegam aqui de exemplo. Ligar no
// servidor: trocar o corpo de cada função por fetch no endpoint da design.md (change ggvp-12).
import { hojeIso, hora } from '../../regras/datas.ts'
import { COMO, diaFalado, horaFalada, mensagemDoConvite } from '../../regras/agenda.ts'
import { MODELOS_DE_MENSAGEM, comAvisoDaSenha, ordenarConversas, problemasDaMensagem, type IdDoModelo } from '../../regras/mensagens.ts'
import { nomeBeneficio } from '../../dados/catalogos.ts'
import { buscarContatos, conversasDoContato, enviarNaConversa, type ContatoChatwoot, type ConversaChatwoot } from '../../dados/chatwoot.ts'
import { obterCobranca } from '../../dados/cobranca.ts'
import { obterComplemento } from '../../dados/complemento.ts'
import { obterConfirmacao } from '../../dados/confirmacao.ts'
import { periciaDoProcesso, type QuemAge } from './conversa.ts'
import { agora, esperar, evento, gravar, ler, type Banco } from '../../dados/servidor.ts'

export type StatusDaMensagem = 'enviada' | 'entregue' | 'lida' | 'falhou'

export const STATUS_DA_MENSAGEM: Record<StatusDaMensagem, string> = { enviada: 'enviada', entregue: 'entregue', lida: 'lida', falhou: 'não saiu' }

/** O registro de cada envio (CA4): o texto final, o canal, a data e a hora, e o status de entrega quando o canal informa. */
export type MensagemAoCliente = {
  id: string
  fichaId: string
  processoId?: string
  modelo: IdDoModelo
  texto: string
  canal: 'Chatwoot'
  /** A conversa do cliente no Chatwoot; 0 quando o Chatwoot não achou o contato. */
  conversa: number
  /** Data e hora ISO. */
  quando: string
  quem: string
  status: StatusDaMensagem
  /** O motivo do Chatwoot quando não saiu (CA5). */
  erro?: string
}

/** O texto do resultado que o Jurídico aprovou: o favorável com o OK da advogada na prestação de contas (G8), o desfavorável sem estratégia interna. */
export type AvisoAprovado = { processoId: string; tipo: 'favoravel' | 'desfavoravel'; texto: string; quem: string; quando: string }

/** A mensagem pronta para revisar (CA1): o texto, se pode editar, a trava e o cliente no Chatwoot (CA6). */
export type MensagemPronta = {
  modelo: IdDoModelo
  texto: string
  editavel: boolean
  trava: string | null
  contato: ContatoChatwoot | null
  conversas: ConversaChatwoot[]
}

/** A Lúcia Exemplo ganhou a pensão: o OK da advogada na prestação de contas, com o texto revisado (GGVP-11, de exemplo). */
function avisosDeExemplo(hoje: string): AvisoAprovado[] {
  return [
    {
      processoId: 'lucia-exemplo-1',
      tipo: 'favoravel',
      texto: 'Olá, Lúcia! Boa notícia: o juiz deu a pensão por morte para você. Os meses atrasados são pagos pelo tribunal. Vamos combinar com você a ida ao banco.',
      quem: 'Dra. Paula (exemplo)',
      quando: new Date(`${hoje}T10:10:00`).toISOString(),
    },
  ]
}

function avisosDo(banco: Banco): AvisoAprovado[] {
  banco.avisosAprovados ??= avisosDeExemplo(hojeIso(agora()))
  return banco.avisosAprovados
}

/** O texto de cada modelo, com os dados do cliente e do caso (CA1), em frases curtas e sem termo jurídico (CA3). */
async function textoDoModelo(banco: Banco, fichaId: string, modelo: IdDoModelo, processoId?: string): Promise<Pick<MensagemPronta, 'texto' | 'editavel' | 'trava'>> {
  const ficha = banco.fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  const processo = ficha.processos.find((p) => p.id === processoId) ?? ficha.processos[0]
  const primeiro = ficha.nome.split(' ')[0]
  const hoje = hojeIso(agora())
  const beneficio = nomeBeneficio(processo?.beneficio ?? ficha.beneficioInteresse) || 'benefício'
  const pronto = (texto: string, editavel = true) => ({ texto, editavel, trava: null })
  const travado = (trava: string) => ({ texto: '', editavel: false, trava })
  const entrevista = ficha.agendamentos.filter((a) => a.data >= hoje && (a.estado ?? 'marcado') === 'marcado').sort((a, b) => a.data.localeCompare(b.data))[0]
  switch (modelo) {
    case 'convite':
      if (!entrevista) return travado('Sem entrevista marcada: marque na agenda.')
      return pronto(
        mensagemDoConvite({ nome: ficha.nome, tipo: entrevista.tipo ?? 'presencial', data: entrevista.data, hora: entrevista.hora, pedirFicha: entrevista.pedirFicha ?? true, levar: entrevista.levar ?? true, gravar: entrevista.gravar ?? true }),
      )
    case 'lembrete':
      if (!entrevista) return travado('Sem entrevista marcada: marque na agenda.')
      return pronto(`Olá, ${primeiro}! Lembrete: sua conversa com o escritório GGV é ${diaFalado(entrevista.data)}, às ${horaFalada(entrevista.hora)}, ${COMO[entrevista.tipo ?? 'presencial']}. Traga RG, CPF e os laudos.`)
    case 'confirmacao': {
      const confirmacao = entrevista && (await obterConfirmacao(entrevista.id))
      return confirmacao ? pronto(confirmacao.mensagem) : travado('Sem entrevista marcada: marque na agenda.')
    }
    case 'complemento': {
      const complemento = processo && (await obterComplemento(processo.id))
      return complemento ? pronto(complemento.mensagem) : travado('Sem pedido de complemento aberto no processo.')
    }
    case 'boas-vindas':
      return pronto(`Olá, ${primeiro}! Boas-vindas ao escritório GGV. Seu caso de ${beneficio} começou. Qualquer dúvida, fale com a gente por aqui.`)
    case 'cobranca': {
      const cobranca = processo && (await obterCobranca(processo.id))
      return pronto(cobranca?.mensagem ?? `Olá, ${primeiro}! Para seguir com o seu caso de ${beneficio}, faltam documentos. Pode trazer aqui ou mandar foto por esta conversa?`)
    }
    case 'resultado-favoravel': {
      const ok = processo && avisosDo(banco).find((a) => a.processoId === processo.id && a.tipo === 'favoravel')
      return ok ? pronto(ok.texto, false) : travado('Falta o OK da advogada na prestação de contas: o aviso só sai depois dele (G8).')
    }
    case 'resultado-desfavoravel': {
      const aprovado = processo && avisosDo(banco).find((a) => a.processoId === processo.id && a.tipo === 'desfavoravel')
      return aprovado ? pronto(aprovado.texto, false) : travado('Falta o texto aprovado pelo Jurídico: o aviso usa só esse texto, sem estratégia interna.')
    }
    case 'aviso-de-mudanca':
      return pronto(`Olá, ${primeiro}. Os dados para você receber os valores do seu caso mudaram hoje, a seu pedido. Se não foi você, ligue para o escritório agora.`)
    case 'pericia-orientacao':
    case 'pericia-presenca': {
      const pericia = processo && periciaDoProcesso(processo.id)
      if (!pericia) return travado('Sem perícia marcada no processo.')
      return pronto(
        modelo === 'pericia-orientacao'
          ? `Olá, ${primeiro}! Sua perícia no INSS é ${diaFalado(pericia)}. Chegue 30 minutos antes. Leve RG, os laudos originais, exames e receitas, em ordem de data. Conte ao perito, com a verdade, o que você sente no dia a dia.`
          : `Olá, ${primeiro}! Sua perícia no INSS é ${diaFalado(pericia)}. Você confirma que vai? Responda por aqui, por favor.`,
      )
    }
  }
}

/** O cliente no Chatwoot: o contato do telefone da ficha (com o mesmo nome, quando o número é dividido) e as conversas (CA6). */
async function noChatwoot(telefone: string, nome: string): Promise<Pick<MensagemPronta, 'contato' | 'conversas'>> {
  const contatos = telefone ? await buscarContatos(telefone) : []
  const contato = contatos.find((c) => c.nome === nome) ?? contatos[0] ?? null
  return { contato, conversas: contato ? ordenarConversas(await conversasDoContato(contato)) : [] }
}

/** O cliente da ficha no Chatwoot, para as janelas que já têm a mensagem pronta (convite, confirmação, cobrança, complemento). */
export async function clienteNoChatwoot(fichaId: string): Promise<Pick<MensagemPronta, 'contato' | 'conversas'>> {
  const ficha = ler().fichas.find((f) => f.id === fichaId)
  if (!ficha) throw new Error('Ficha não encontrada')
  return noChatwoot(ficha.telefone, ficha.nome)
}

/** GET /api/fichas/:id/mensagens/:modelo. A mensagem pronta para revisar, com a trava do modelo e o cliente no Chatwoot. */
export async function prepararMensagem(fichaId: string, modelo: IdDoModelo, processoId?: string): Promise<MensagemPronta> {
  const banco = ler()
  const pronta = await textoDoModelo(banco, fichaId, modelo, processoId)
  const ficha = banco.fichas.find((f) => f.id === fichaId)!
  gravar(banco)
  // Todo modelo diz que o escritório nunca pede a senha do gov.br por mensagem (GGVP-111, CA4).
  return { modelo, ...pronta, texto: comAvisoDaSenha(pronta.texto), ...(await noChatwoot(ficha.telefone, ficha.nome)) }
}

/** `noCard: false`: a tela de origem (convite, cobrança...) já põe o contato no card; aqui fica só o registro do envio. */
export type PedidoDeMensagem = { modelo: IdDoModelo; texto: string; conversa: number; processoId?: string; noCard?: false }

/**
 * POST /api/fichas/:id/mensagens. Sai pela conversa do cliente no Chatwoot (CA6), com o texto revisado (CA1). Confere de
 * novo a trava do modelo (G8, CA8) e o que o texto não pode ter (G9, G11, G20). A falha do canal volta para a tela e fica
 * no histórico (CA5); a mesma mensagem já enviada na mesma conversa não sai de novo.
 */
export async function enviarMensagem(fichaId: string, pedido: PedidoDeMensagem, por: QuemAge): Promise<MensagemAoCliente> {
  await esperar()
  const pronta = await prepararMensagem(fichaId, pedido.modelo, pedido.processoId)
  if (pronta.trava) throw new Error(pronta.trava)
  const texto = pedido.texto.trim()
  if (!texto) throw new Error('Escreva a mensagem.')
  if (!pronta.editavel && texto !== pronta.texto) throw new Error('O texto aprovado não muda: o aviso sai como foi revisado.')
  const problema = problemasDaMensagem(texto).bloqueia[0]
  if (problema) throw new Error(problema)
  if (pronta.contato && !pronta.conversas.some((c) => c.id === pedido.conversa)) throw new Error('Escolha a conversa do cliente no Chatwoot.')
  const banco = ler()
  const ficha = banco.fichas.find((f) => f.id === fichaId)!
  const mensagens = (banco.mensagens ??= [])
  const repetida = mensagens.find((m) => m.fichaId === fichaId && m.conversa === pedido.conversa && m.texto === texto && m.status !== 'falhou')
  if (repetida) return repetida
  const envio = pronta.contato ? await enviarNaConversa(pedido.conversa, texto) : { status: 'failed' as const, erro: 'o Chatwoot não achou o contato deste telefone' }
  const status: StatusDaMensagem = envio.status === 'failed' ? 'falhou' : envio.status === 'read' ? 'lida' : envio.status === 'delivered' ? 'entregue' : 'enviada'
  const quando = agora().toISOString()
  const registro: MensagemAoCliente = {
    id: `mensagem-${mensagens.length + 1}`,
    fichaId,
    processoId: pedido.processoId ?? ficha.processos[0]?.id,
    modelo: pedido.modelo,
    texto,
    canal: 'Chatwoot',
    conversa: pronta.contato ? pedido.conversa : 0,
    quando,
    quem: por.quem,
    status,
    ...(envio.erro && { erro: envio.erro }),
  }
  mensagens.push(registro)
  const nome = MODELOS_DE_MENSAGEM[pedido.modelo].nome
  // No card do cliente: a data, o canal com a hora e o status, e o texto (CA2, CA4).
  if (pedido.noCard !== false || status === 'falhou') {
    ficha.contatos.push({ data: hojeIso(agora()), canal: `Chatwoot · ${hora(quando)} · ${STATUS_DA_MENSAGEM[status]}`, texto })
  }
  ficha.historico.push(
    evento(
      status === 'falhou' ? `A mensagem «${nome}» não saiu pelo Chatwoot: ${envio.erro}. Nada foi reenviado sozinho.` : `Enviou pelo Chatwoot a mensagem «${nome}» (${STATUS_DA_MENSAGEM[status]})`,
      por.quem,
    ),
  )
  gravar(banco)
  return registro
}

/** As mensagens mandadas ao cliente, da mais nova para a mais antiga. */
export async function mensagensDoCliente(fichaId: string): Promise<MensagemAoCliente[]> {
  return (ler().mensagens ?? []).filter((m) => m.fichaId === fichaId).reverse()
}
