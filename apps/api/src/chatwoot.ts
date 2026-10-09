// O Chatwoot de verdade (ADR-015; GGVP-146 parte 4): o contato pelo telefone, as conversas dele na caixa do escritório,
// a conversa aberta quando não há e o envio da mensagem. Só com CHATWOOT_URL, CHATWOOT_CONTA, CHATWOOT_CAIXA e
// CHATWOOT_TOKEN no ambiente; sem elas, nulo, e as mensagens seguem simuladas. O token vai só no cabeçalho
// `api_access_token`: nunca na tela, em log ou na mensagem de erro.
import type { ContatoChatwoot, ConversaChatwoot, MensagemAoCliente } from '@ggv/contratos'

type ContatoDaApi = { id: number; name?: string; phone_number?: string; contact_inboxes?: { source_id?: string; inbox?: { id?: number; name?: string } }[] }
type ConversaDaApi = { id: number; inbox_id?: number; status?: string; last_activity_at?: number }
type MensagemDaApi = { status?: string; content_attributes?: { external_error?: string } }

const STATUS: Record<string, MensagemAoCliente['status']> = { sent: 'enviada', delivered: 'entregue', read: 'lida', failed: 'falhou' }

export type Chatwoot = NonNullable<ReturnType<typeof abrirChatwoot>>

export function abrirChatwoot(ambiente: Record<string, string | undefined> = process.env) {
  const { CHATWOOT_URL, CHATWOOT_CONTA, CHATWOOT_CAIXA, CHATWOOT_TOKEN } = ambiente
  if (!CHATWOOT_URL || !CHATWOOT_CONTA || !CHATWOOT_CAIXA || !CHATWOOT_TOKEN) return null
  const central = CHATWOOT_URL.replace(/\/+$/, '')
  const base = `${central}/api/v1/accounts/${encodeURIComponent(CHATWOOT_CONTA)}`
  const caixa = Number(CHATWOOT_CAIXA)

  async function chamar<T>(caminho: string, corpo?: object): Promise<T> {
    let resposta: Response
    try {
      resposta = await fetch(`${base}${caminho}`, {
        method: corpo ? 'POST' : 'GET',
        headers: { api_access_token: CHATWOOT_TOKEN!, ...(corpo && { 'content-type': 'application/json' }) },
        ...(corpo && { body: JSON.stringify(corpo) }),
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      throw new Error('o Chatwoot não respondeu; tente de novo em alguns minutos')
    }
    if (!resposta.ok) throw new Error(`o Chatwoot recusou o pedido (código ${resposta.status})`)
    return (await resposta.json().catch(() => {
      throw new Error('o Chatwoot respondeu fora do formato')
    })) as T
  }

  /**
   * O contato do telefone (o de mesmo nome, quando mãe e filha dividem o número). O WhatsApp às vezes grava o celular sem
   * o nono dígito: a busca vai pelos 8 últimos e aceita as duas formas.
   */
  async function contatoDe(telefone: string, nome: string) {
    const formas = [`+55${telefone}`]
    if (telefone.length === 11 && telefone[2] === '9') formas.push(`+55${telefone.slice(0, 2)}${telefone.slice(3)}`)
    const { payload = [] } = await chamar<{ payload?: ContatoDaApi[] }>(`/contacts/search?q=${telefone.slice(-8)}`)
    const doTelefone = payload.filter((c) => formas.includes(c.phone_number ?? ''))
    return doTelefone.find((c) => c.name === nome) ?? doTelefone[0]
  }

  async function conversasNaCaixa(contato: ContatoDaApi) {
    const { payload = [] } = await chamar<{ payload?: ConversaDaApi[] }>(`/contacts/${contato.id}/conversations`)
    return payload.filter((c) => c.inbox_id === caixa)
  }

  return {
    /** GET contacts/search e contacts/{id}/conversations: o cliente e as conversas dele na caixa do escritório (CA6). */
    async cliente(telefone: string, nome: string): Promise<{ contato: ContatoChatwoot | null; conversas: ConversaChatwoot[] }> {
      const contato = await contatoDe(telefone, nome)
      if (!contato) return { contato: null, conversas: [] }
      const nomeDaCaixa = contato.contact_inboxes?.find((c) => c.inbox?.id === caixa)?.inbox?.name ?? 'WhatsApp do escritório'
      const conversas = await Promise.all(
        (await conversasNaCaixa(contato)).map(async (c) => ({
          id: c.id,
          caixa: nomeDaCaixa,
          situacao: c.status === 'resolved' ? ('resolvida' as const) : ('aberta' as const),
          // ponytail: conta só a última página do Chatwoot (20 mensagens); paginar com `before` se a ordem exata importar.
          mensagens: ((await chamar<{ payload?: unknown[] }>(`/conversations/${c.id}/messages`)).payload ?? []).length,
          ultimaEm: new Date((c.last_activity_at ?? 0) * 1000).toISOString(),
          link: `${central}/app/accounts/${CHATWOOT_CONTA}/conversations/${c.id}`,
        })),
      )
      return { contato: { id: contato.id, nome: contato.name ?? nome, telefone }, conversas }
    },

    /** Sem conversa escolhida: acha ou cria o contato, liga-o à caixa e usa a conversa em aberto, ou abre uma. */
    async abrirConversa(telefone: string, nome: string): Promise<number> {
      let contato = await contatoDe(telefone, nome)
      let fonte = contato?.contact_inboxes?.find((c) => c.inbox?.id === caixa)?.source_id
      if (!contato) {
        const { payload } = await chamar<{ payload: { contact: ContatoDaApi; contact_inbox?: { source_id?: string } } }>('/contacts', { inbox_id: caixa, name: nome, phone_number: `+55${telefone}` })
        contato = payload.contact
        fonte = payload.contact_inbox?.source_id
      } else {
        const emAberto = (await conversasNaCaixa(contato)).filter((c) => c.status !== 'resolved').sort((a, b) => (b.last_activity_at ?? 0) - (a.last_activity_at ?? 0))[0]
        if (emAberto) return emAberto.id
      }
      fonte ??= (await chamar<{ source_id: string }>(`/contacts/${contato.id}/contact_inboxes`, { inbox_id: caixa })).source_id
      return (await chamar<{ id: number }>('/conversations', { source_id: fonte, inbox_id: caixa, contact_id: contato.id })).id
    },

    /** POST conversations/{id}/messages: sai como mensagem do escritório, que o cliente vê. */
    async enviar(conversa: number, texto: string): Promise<{ status: MensagemAoCliente['status']; erro?: string }> {
      const m = await chamar<MensagemDaApi>(`/conversations/${conversa}/messages`, { content: texto, message_type: 'outgoing', private: false })
      const status = STATUS[m.status ?? 'sent'] ?? 'enviada'
      return status === 'falhou' ? { status, erro: m.content_attributes?.external_error ?? 'o WhatsApp recusou a mensagem' } : { status }
    },
  }
}
