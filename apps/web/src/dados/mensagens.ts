// As mensagens ao cliente (GGVP-102), no servidor (GGVP-138): a mensagem pronta de cada modelo, o envio pelo Chatwoot e o
// registro com o status de entrega. A trava do modelo e o que o texto não pode ter (G9, G11, G20) são conferidos lá; o
// servidor fala com o Chatwoot de verdade quando está configurado (GGVP-146), senão simula. O servidor de exemplo daqui saiu.
import type { MensagemAoCliente as MensagemDoContrato, MensagemPronta as ProntaDoContrato } from '@ggv/contratos'
import type { IdDoModelo } from '../regras/mensagens.ts'
import { noBanco } from './servidor.ts'

export type StatusDaMensagem = MensagemDoContrato['status']

export const STATUS_DA_MENSAGEM: Record<StatusDaMensagem, string> = { enviada: 'enviada', entregue: 'entregue', lida: 'lida', falhou: 'não saiu' }

/** O registro de cada envio (CA4): o texto final, o canal, a data e a hora, e o status de entrega quando o canal informa. */
export type MensagemAoCliente = MensagemDoContrato

/** O texto do resultado que o Jurídico aprovou: o favorável com o OK da advogada na prestação de contas (G8). */
export type AvisoAprovado = { processoId: string; tipo: 'favoravel' | 'desfavoravel'; texto: string; quem: string; quando: string }

/** A mensagem pronta para revisar (CA1): o texto, se pode editar, a trava e o cliente no Chatwoot (CA6). */
export type MensagemPronta = ProntaDoContrato

/** `noCard: false`: a tela de origem (convite, cobrança...) já põe o contato no card; aqui fica só o registro do envio. */
export type PedidoDeMensagem = { modelo: IdDoModelo; texto: string; conversa: number; processoId?: string; noCard?: false }

/** GET /api/fichas/:id/mensagens/:modelo. A mensagem pronta para revisar, com a trava do modelo e o cliente no Chatwoot. */
export function prepararMensagem(fichaId: string, modelo: IdDoModelo, processoId?: string): Promise<MensagemPronta> {
  return noBanco<MensagemPronta>(`/fichas/${fichaId}/mensagens/${modelo}${processoId ? `?processo=${encodeURIComponent(processoId)}` : ''}`)
}

/** O cliente da ficha no Chatwoot, para as janelas que já têm a mensagem pronta (convite, confirmação, cobrança, complemento). */
export async function clienteNoChatwoot(fichaId: string): Promise<Pick<MensagemPronta, 'contato' | 'conversas' | 'simulado'>> {
  const { contato, conversas, simulado } = await prepararMensagem(fichaId, 'boas-vindas')
  return { contato, conversas, simulado }
}

/**
 * POST /api/fichas/:id/mensagens. Sai pela conversa do cliente no Chatwoot (CA6), com o texto revisado (CA1). A falha do
 * canal volta como registro com o status "falhou" e o motivo (CA5); o que um portão barra volta como erro.
 */
export function enviarMensagem(fichaId: string, pedido: PedidoDeMensagem): Promise<MensagemAoCliente> {
  return noBanco<MensagemAoCliente>(`/fichas/${fichaId}/mensagens`, { method: 'POST', corpo: pedido })
}

/** GET /api/fichas/:id/mensagens. As mensagens mandadas ao cliente, da mais nova para a mais antiga. */
export function mensagensDoCliente(fichaId: string): Promise<MensagemAoCliente[]> {
  return noBanco<MensagemAoCliente[]>(`/fichas/${fichaId}/mensagens`)
}
