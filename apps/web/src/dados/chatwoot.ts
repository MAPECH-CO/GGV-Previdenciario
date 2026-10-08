// EXEMPLO. O Chatwoot simulado (GGVP-102), com funções da mesma forma da API dele (developers.chatwoot.com), sobre os
// contatos das fichas da semente. Nada aqui chama o Chatwoot de verdade. Ponta para ligar no Chatwoot: trocar o corpo de
// cada função pela chamada indicada, com o endereço, a conta, a caixa de entrada e o token da configuração do ambiente
// (nunca no código); ver a design.md da change ggvp-12, seção GGVP-102.
import { normalizarTelefone } from '../campos.ts'
import { agora, ler } from './servidor.ts'

/** O endereço da central (Pedro, 07/10). A conta vem da configuração do ambiente. */
export const URL_DO_CHATWOOT = 'https://chatwoot.mapech.com.br'
const CONTA = import.meta.env.VITE_CHATWOOT_CONTA ?? 'conta'

/** Um contato do Chatwoot: `GET /api/v1/accounts/{conta}/contacts/search?q=` devolve `payload[]` com `id`, `name`, `phone_number`. */
export type ContatoChatwoot = { id: number; nome: string; telefone: string }

/** Uma conversa do contato: `GET .../contacts/{id}/conversations` devolve `id`, `status`, `inbox_id`, `messages`, `last_activity_at`. */
export type ConversaChatwoot = { id: number; caixa: string; situacao: 'aberta' | 'resolvida'; mensagens: number; ultimaEm: string }

/** A mensagem enviada: `POST .../conversations/{id}/messages` devolve `id` e `status` (`sent`, `delivered`, `read`, `failed`). */
export type EnvioChatwoot = { id: number; status: 'sent' | 'delivered' | 'read' | 'failed'; erro?: string }

/** O link para abrir a conversa na central do Chatwoot (CA6). */
export const linkDaConversa = (conversaId: number) => `${URL_DO_CHATWOOT}/app/accounts/${CONTA}/conversations/${conversaId}`

/** O Antônio tem duas conversas: a de mais mensagens vem primeiro (CA6). As outras fichas com telefone têm uma, aberta. */
const CONVERSAS_DE_EXEMPLO: Record<string, Omit<ConversaChatwoot, 'ultimaEm'>[]> = {
  'antonio-exemplo': [
    { id: 4101, caixa: 'GGV PREV', situacao: 'resolvida', mensagens: 3 },
    { id: 4102, caixa: 'GGV PREV', situacao: 'aberta', mensagens: 14 },
  ],
}
/** Na conversa da Nair, o WhatsApp recusa a mensagem, como o `external_error` do Chatwoot (CA5). */
const RECUSA: Record<string, string> = { 'nair-exemplo': 'o WhatsApp recusou: o número não tem WhatsApp' }

/** O contato de cada ficha com telefone tem o número da ficha na semente; a conversa sem exemplo, o mesmo número. */
const ID_BASE = 5000

/** `GET /api/v1/accounts/{conta}/contacts/search?q={telefone}`: os contatos com esse telefone (mãe e filha podem dividir). */
export async function buscarContatos(telefone: string): Promise<ContatoChatwoot[]> {
  const numero = normalizarTelefone(telefone)
  if (!numero) return []
  return ler()
    .fichas.map((f, i) => ({ id: ID_BASE + i, nome: f.nome, telefone: normalizarTelefone(f.telefone) }))
    .filter((c) => c.telefone === numero)
}

/** `GET /api/v1/accounts/{conta}/contacts/{id}/conversations`. */
export async function conversasDoContato(contato: ContatoChatwoot): Promise<ConversaChatwoot[]> {
  const ficha = ler().fichas[contato.id - ID_BASE]
  const ultimaEm = agora().toISOString()
  const conversas = CONVERSAS_DE_EXEMPLO[ficha?.id ?? ''] ?? [{ id: contato.id, caixa: 'GGV PREV', situacao: 'aberta' as const, mensagens: 2 }]
  return conversas.map((c) => ({ ...c, ultimaEm }))
}

/** `POST /api/v1/accounts/{conta}/conversations/{id}/messages` com `content`, `message_type: "outgoing"` e `private: false`. */
export async function enviarNaConversa(conversaId: number, texto: string): Promise<EnvioChatwoot> {
  if (!texto.trim()) throw new Error('Mensagem vazia')
  const erro = RECUSA[ler().fichas[conversaId - ID_BASE]?.id ?? '']
  return erro ? { id: conversaId * 1000 + 1, status: 'failed', erro } : { id: conversaId * 1000 + 1, status: 'delivered' }
}
