// GGVP-138: a conversa com o cliente fala só com a API. O servidor aqui é de mentira e responde pela rota; o que se confere
// é o lado da tela: o caminho, o corpo e a cópia local da ficha e da gravação. As regras do servidor têm os testes dele, na
// API (apps/api/src/rotas/conversa.test.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  abrirConversa,
  conferirConversa,
  conversaDaGravacao,
  cumprirPendencia,
  novoPrazoDaPendencia,
  obterConversa,
  obterVersoes,
  registrarAcaoNaConversa,
  responsaveisDaPendencia,
  transcreverConversa,
  voltarParaVersao,
} from './conversa.ts'
import { configurarExemplo, ler, zerarExemplo } from './servidor.ts'
import type { Ficha, Gravacao } from './tipos.ts'

const FICHA = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
const CONVERSA = '7a2d3c4b-5e6f-4a70-9b8c-1d2e3f4a5b6c'

const ficha = { id: FICHA, nome: 'Ivone Teste', historico: [], contatos: [], agendamentos: [], processos: [] } as unknown as Ficha
const gravacao = { id: `gravacao-${CONVERSA}`, fichaId: FICHA, conversaId: CONVERSA, acoes: [], trechos: [], extraidas: [] } as unknown as Gravacao
const conversa = { id: CONVERSA, fichaId: FICHA, canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo', quem: 'Ana', papel: 'atendimento', abertaEm: '2026-10-08T12:00:00.000Z' }
const aberta = { conversa, ficha, gravacao }

/** O servidor de mentira: cada rota ("MÉTODO /api/...") responde o que a função devolve; o resto, 404. */
function ligarServidor(rotas: Record<string, (corpo: unknown) => unknown>) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const responder = rotas[`${init?.method ?? 'GET'} ${url}`]
    if (!responder) return new Response(JSON.stringify({ erro: 'Conversa não encontrada.' }), { status: 404 })
    const r = responder(init?.body ? JSON.parse(String(init.body)) : undefined)
    return r instanceof Response ? r : new Response(JSON.stringify(r), { status: 200 })
  })
  vi.stubGlobal('fetch', fetch)
  configurarExemplo({ servidor: true })
  return fetch
}
const corpoDa = (fetch: ReturnType<typeof ligarServidor>, i: number) => JSON.parse(String(fetch.mock.calls[i][1]?.body))

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 8, 12, 0), latencia: 0 })
  zerarExemplo()
})
afterEach(() => {
  configurarExemplo({ servidor: false })
  vi.unstubAllGlobals()
})

describe('GGVP-138 · a conversa com o cliente no servidor, pelo lado da tela', () => {
  it('abrir: a ficha vai no corpo; a ficha e a gravação que voltam entram na cópia das telas', async () => {
    const fetch = ligarServidor({ 'POST /api/conversas': () => aberta })
    expect(await abrirConversa(FICHA, { canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo' })).toEqual(conversa)
    expect(corpoDa(fetch, 0)).toEqual({ fichaId: FICHA, canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo' })
    expect(ler().fichas.find((f) => f.id === FICHA)?.nome).toBe('Ivone Teste')
    expect(ler().gravacoes.find((g) => g.id === gravacao.id)?.conversaId).toBe(CONVERSA)
  })

  it('a conversa que não existe, ou que o perfil não abre, volta vazia; o erro do servidor chega à tela como veio', async () => {
    ligarServidor({ [`POST /api/conversas/${CONVERSA}/transcricao`]: () => new Response(JSON.stringify({ erro: 'Sem permissão para esta ação.' }), { status: 403 }) })
    expect(await obterConversa(CONVERSA)).toBeNull()
    await expect(transcreverConversa(CONVERSA)).rejects.toThrow('Sem permissão para esta ação.')
  })

  it('cada passo vai à rota da conversa, com o corpo da design.md; o perfil vem da sessão, nunca do pedido', async () => {
    const url = `/api/conversas/${CONVERSA}`
    const fetch = ligarServidor({
      [`POST ${url}/acoes`]: () => aberta,
      [`POST ${url}/conferencia`]: () => aberta,
      [`POST ${url}/pendencia/cumprida`]: () => aberta,
      [`POST ${url}/pendencia/prazo`]: () => aberta,
    })
    await registrarAcaoNaConversa(CONVERSA, 'pausou', 30)
    await conferirConversa(CONVERSA, { decisoes: [{ id: 'ficha-telefone-1', decisao: 'confirmada' }], pendencia: { surgiu: false }, verificacao: { como: 'video', contratoNovo: true } })
    await cumprirPendencia(CONVERSA)
    await novoPrazoDaPendencia(CONVERSA, '20/10/2026')
    expect(fetch.mock.calls.map(([u, init]) => `${init?.method} ${u}`)).toEqual([`POST ${url}/acoes`, `POST ${url}/conferencia`, `POST ${url}/pendencia/cumprida`, `POST ${url}/pendencia/prazo`])
    expect(corpoDa(fetch, 0)).toEqual({ acao: 'pausou', aos: 30 })
    expect(corpoDa(fetch, 1)).toEqual({ decisoes: [{ id: 'ficha-telefone-1', decisao: 'confirmada' }], pendencia: { surgiu: false }, verificacao: { como: 'video', contratoNovo: true } })
    expect(corpoDa(fetch, 3)).toEqual({ prazo: '20/10/2026' })
    expect(fetch.mock.calls.some(([, init]) => String(init?.body ?? '').includes('perfil'))).toBe(false)
  })

  it('as versões e a volta da Sênior; quem pode ficar com a pendência vem do servidor; a gravação leva à conversa', async () => {
    const versoes = [{ fichaId: FICHA, onde: 'ficha', campo: 'telefone', valor: '11987654321', quem: 'Valor de antes da conversa', quando: '2026-10-08T12:00:00.000Z', origem: 'antes' }]
    const fetch = ligarServidor({
      [`GET /api/fichas/${FICHA}/versoes`]: () => versoes,
      [`POST /api/fichas/${FICHA}/versoes/telefone/volta`]: () => versoes,
      'GET /api/conversas/responsaveis': () => [{ nome: 'Ana', setor: 'Atendimento' }],
    })
    expect(await obterVersoes(FICHA)).toEqual(versoes)
    await voltarParaVersao({ fichaId: FICHA, onde: 'ficha', campo: 'telefone' }, 0)
    expect(corpoDa(fetch, 1)).toEqual({ onde: 'ficha', versao: 0 })
    expect(await responsaveisDaPendencia()).toEqual([{ nome: 'Ana', setor: 'Atendimento' }])
    expect(conversaDaGravacao(gravacao)).toBe(CONVERSA)
  })
})
