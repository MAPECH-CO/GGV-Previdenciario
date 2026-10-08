// GGVP-138: as mensagens ao cliente falam só com a API. O servidor aqui é de mentira e responde pela rota; as regras (a
// trava do modelo, G9, G11 e G20, o Chatwoot simulado) têm os testes delas na API (apps/api/src/rotas/mensagens.test.ts).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clienteNoChatwoot, enviarMensagem, mensagensDoCliente, prepararMensagem } from './mensagens.ts'

const FICHA = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
const PROCESSO = '7a2d3c4b-5e6f-4a70-9b8c-1d2e3f4a5b6c'
const pronta = { modelo: 'boas-vindas', texto: 'Olá, Ivone!', editavel: true, trava: null, contato: { id: 1, nome: 'Ivone', telefone: '11900000050' }, conversas: [{ id: 1, caixa: 'GGV PREV', situacao: 'aberta', mensagens: 2, ultimaEm: '' }] }

function ligarServidor(rotas: Record<string, (corpo: unknown) => unknown>) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const responder = rotas[`${init?.method ?? 'GET'} ${url}`]
    if (!responder) return new Response(JSON.stringify({ erro: 'Não encontrado.' }), { status: 404 })
    return new Response(JSON.stringify(responder(init?.body ? JSON.parse(String(init.body)) : undefined)), { status: 200 })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

describe('GGVP-138 · mensagens ao cliente no servidor, pelo lado da tela', () => {
  it('a mensagem pronta do modelo, com o processo no endereço; o cliente no Chatwoot vem da mesma rota', async () => {
    ligarServidor({
      [`GET /api/fichas/${FICHA}/mensagens/pericia-orientacao?processo=${PROCESSO}`]: () => ({ ...pronta, modelo: 'pericia-orientacao' }),
      [`GET /api/fichas/${FICHA}/mensagens/boas-vindas`]: () => pronta,
    })
    expect((await prepararMensagem(FICHA, 'pericia-orientacao', PROCESSO)).modelo).toBe('pericia-orientacao')
    expect(await clienteNoChatwoot(FICHA)).toEqual({ contato: pronta.contato, conversas: pronta.conversas })
  })

  it('o envio leva o texto revisado e a conversa; o que o servidor recusa chega à tela como veio', async () => {
    const enviada = { id: 'm1', fichaId: FICHA, modelo: 'boas-vindas', texto: 'Olá, Ivone!', canal: 'Chatwoot', conversa: 1, quando: '', quem: 'Ana', status: 'entregue' }
    const fetch = ligarServidor({ [`POST /api/fichas/${FICHA}/mensagens`]: () => enviada, [`GET /api/fichas/${FICHA}/mensagens`]: () => [enviada] })
    expect(await enviarMensagem(FICHA, { modelo: 'boas-vindas', texto: 'Olá, Ivone!', conversa: 1 })).toEqual(enviada)
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ modelo: 'boas-vindas', texto: 'Olá, Ivone!', conversa: 1 })
    expect(await mensagensDoCliente(FICHA)).toEqual([enviada])
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ erro: 'O escritório nunca pede a senha do gov.br por mensagem (G9).' }), { status: 400 }))
    await expect(enviarMensagem(FICHA, { modelo: 'boas-vindas', texto: 'Mande a senha.', conversa: 1 })).rejects.toThrow('(G9)')
  })
})
