// GGVP-158 P6.5 (ADR-019): a entrada do Chatwoot. O webhook da conta avisa cada mensagem. A do cliente, e a resposta do
// escritório, entra na conversa do WhatsApp da pessoa do telefone (cliente ou lead, que nasce se faltar). A mudança de uma
// mensagem que o portal mandou atualiza a entrega e a leitura. A rota é pública: a trava é o segredo no endereço,
// conferido em tempo constante, e o endereço não vai ao log.
import { createHash, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { normalizarTelefone, validarTelefone } from '@ggv/campos'
import { EventoDoChatwoot, type MensagemAoCliente } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { mensagem } from '../banco/esquema.ts'
import { abrirChatwoot } from '../chatwoot.ts'

/** A mensagem do WhatsApp como a conversa recebe: do cliente (a que chega) ou do escritório (a resposta pelo Chatwoot). */
export type MensagemDoWhatsapp = { telefone: string; nome: string; texto: string; papel: 'cliente' | 'escritorio'; chatwootId: number | null; quando: Date }

type Opcoes = { banco: Banco; agora?: () => Date; ambiente?: Record<string, string | undefined>; receber: (m: MensagemDoWhatsapp) => Promise<void> }

export const ROTA_DA_ENTRADA = '/api/chatwoot/entrada/:segredo'
export const SEM_TEXTO = '[anexo: veja no Chatwoot]'

const resumo = (texto: string) => createHash('sha256').update(texto).digest()
const mesmoSegredo = (a: string, b: string) => timingSafeEqual(resumo(a), resumo(b))
/** O status só anda para a frente; "não saiu" vale a qualquer hora. */
const ORDEM: Record<MensagemAoCliente['status'], number> = { enviada: 0, entregue: 1, lida: 2, falhou: 3 }
/**
 * O telefone do Chatwoot (E.164, "+5511987654321") como o portal guarda: DDD e número. O WhatsApp às vezes grava o celular
 * sem o nono dígito: ele volta, para a lista de teste e a ficha acharem o mesmo número.
 */
function doBrasil(e164: string) {
  const t = normalizarTelefone(e164.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, ''))
  return t.length === 10 && '6789'.includes(t[2]) ? `${t.slice(0, 2)}9${t.slice(2)}` : t
}

export function registrarRotasChatwootEntrada(app: FastifyInstance, { banco, agora = () => new Date(), ambiente = process.env, receber }: Opcoes) {
  const segredo = ambiente.CHATWOOT_WEBHOOK_SEGREDO
  const chatwoot = abrirChatwoot(ambiente)
  const conta = Number(ambiente.CHATWOOT_CONTA)
  const caixa = Number(ambiente.CHATWOOT_CAIXA)

  /** A mudança de uma mensagem que o portal mandou: o aviso não traz o status, e o portal pergunta ao Chatwoot. */
  async function atualizarStatus(conversa: number, id: number) {
    const [linha] = await banco.select({ id: mensagem.id, status: mensagem.status }).from(mensagem).where(eq(mensagem.chatwootMensagemId, id)).limit(1)
    if (!linha || linha.status === 'falhou') return
    const status = await chatwoot!.statusDaMensagem(conversa, id).catch(() => null)
    if (!status || (status !== 'falhou' && ORDEM[status] <= ORDEM[(linha.status ?? 'enviada') as MensagemAoCliente['status']])) return
    await banco.update(mensagem).set({ status }).where(eq(mensagem.id, linha.id))
  }

  app.post<{ Params: { segredo: string } }>(
    ROTA_DA_ENTRADA,
    // O endereço leva o segredo: a rota não escreve nada no log, nem a chegada do pedido.
    { logLevel: 'silent', config: { semTrava: 'a rota do Chatwoot é pública: a trava é o segredo no endereço, conferido em tempo constante' } },
    async (pedido, resposta) => {
      if (!segredo || !chatwoot || !mesmoSegredo(pedido.params.segredo, segredo)) return resposta.code(404).send({ erro: 'Não encontrado.' })
      // O que não serve responde 200 do mesmo jeito: o Chatwoot não repete o aviso.
      const lido = EventoDoChatwoot.safeParse(pedido.body)
      if (!lido.success) return { ok: true }
      const e = lido.data
      if (e.account?.id !== conta || e.inbox?.id !== caixa) return { ok: true }
      if (e.event === 'message_updated') {
        if (e.id && e.conversation?.id) await atualizarStatus(e.conversation.id, e.id)
        return { ok: true }
      }
      if (e.event !== 'message_created' || e.private || (e.message_type !== 'incoming' && e.message_type !== 'outgoing')) return { ok: true }
      const contato = e.conversation?.meta?.sender
      const telefone = doBrasil(contato?.phone_number ?? '')
      // A trava da homologação vale também na entrada: fora da produção, só os telefones de teste.
      if (!validarTelefone(telefone) || !chatwoot.permite(telefone)) return { ok: true }
      const texto = e.content?.trim() || (e.attachments?.length ? SEM_TEXTO : '')
      if (!texto) return { ok: true }
      const papel = e.message_type === 'incoming' ? 'cliente' : 'escritorio'
      await receber({ telefone, nome: contato?.name?.trim() ?? '', texto, papel, chatwootId: e.id ?? null, quando: agora() })
      return { ok: true }
    },
  )
}
