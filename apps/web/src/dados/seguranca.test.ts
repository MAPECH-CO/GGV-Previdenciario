// GGVP-138: a segurança do contato fala com a API. O servidor aqui é de mentira e responde pela rota; as regras (a
// verificação, a segunda confirmação, o aviso e o alerta) têm os testes delas na API (apps/api/src/rotas/seguranca.test.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { camposProtegidosQueMudam, confirmarMudancaBancaria, obterDadosBancarios, pedirMudancaBancaria, salvarFichaVerificada } from './seguranca.ts'
import { configurarExemplo, ler, obterFicha, zerarExemplo } from './servidor.ts'
import type { EdicaoFicha, Ficha } from './tipos.ts'

const FICHA = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
const CONTA = { banco: 'Banco Exemplo Dois', agencia: '0002', conta: '65432-1' }
const VIDEO = { como: 'video' as const, contratoNovo: true as const }

const edicaoDe = (f: Pick<Ficha, 'nome' | 'telefone' | 'email'>): EdicaoFicha => ({ nome: f.nome, telefone: f.telefone, email: f.email })

function ligarServidor(rotas: Record<string, (corpo: unknown) => unknown>) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const responder = rotas[`${init?.method ?? 'GET'} ${url}`]
    if (!responder) return new Response(JSON.stringify({ erro: 'Não encontrado.' }), { status: 404 })
    return new Response(JSON.stringify(responder(init?.body ? JSON.parse(String(init.body)) : undefined)), { status: 200 })
  })
  vi.stubGlobal('fetch', fetch)
  configurarExemplo({ servidor: true })
  return fetch
}

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 8, 12, 0), latencia: 0 })
  zerarExemplo()
})
afterEach(() => {
  configurarExemplo({ servidor: false })
  vi.unstubAllGlobals()
})

describe('GGVP-138 · terceiro não se passa pelo cliente, pelo lado da tela', () => {
  it('dados bancários: o pedido leva os dados e a verificação; a confirmação vai sem corpo, porque quem confirma é a sessão', async () => {
    const pedido = { fichaId: FICHA, dados: CONTA, verificacao: VIDEO, pediu: 'Ana', pedidoEm: '' }
    const fetch = ligarServidor({
      [`GET /api/fichas/${FICHA}/dados-bancarios`]: () => ({ atual: null, pedido }),
      [`POST /api/fichas/${FICHA}/dados-bancarios`]: () => pedido,
      [`POST /api/fichas/${FICHA}/dados-bancarios/confirmacao`]: () => ({ ...CONTA, fichaId: FICHA, desde: '', quem: 'Ana' }),
    })
    expect(await obterDadosBancarios(FICHA)).toEqual({ atual: null, pedido })
    expect(await pedirMudancaBancaria(FICHA, { dados: CONTA, verificacao: VIDEO })).toEqual(pedido)
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ dados: CONTA, verificacao: VIDEO })
    expect((await confirmarMudancaBancaria(FICHA)).quem).toBe('Ana')
    expect(fetch.mock.calls[2][1]?.body).toBeUndefined()
  })

  it('a ficha do servidor: a edição leva a verificação junto, e a ficha que volta entra na cópia das telas', async () => {
    const doBanco = { id: FICHA, nome: 'Ivone Teste', telefone: '11900000077', historico: [], contatos: [], agendamentos: [], processos: [] } as unknown as Ficha
    const fetch = ligarServidor({ [`PATCH /api/fichas/${FICHA}`]: () => ({ ficha: doBanco }) })
    const r = await salvarFichaVerificada(FICHA, edicaoDe(doBanco), VIDEO)
    expect('ficha' in r && r.ficha.telefone).toBe('11900000077')
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({ telefone: '11900000077', verificacao: VIDEO })
    expect(ler().fichas.find((f) => f.id === FICHA)?.telefone).toBe('11900000077')
  })

  it('a ficha da semente segue a edição da Recepção, com a mesma regra: telefone só com o cliente verificado', async () => {
    const maria = (await obterFicha('maria-exemplo'))!
    const novo = { ...edicaoDe(maria), telefone: '11900000044' }
    await expect(salvarFichaVerificada('maria-exemplo', novo, null)).rejects.toThrow('só mudam com o cliente verificado')
    const r = await salvarFichaVerificada('maria-exemplo', novo, VIDEO)
    expect('ficha' in r && r.ficha.telefone).toBe('11900000044')
  })

  it('CA1 · completar o telefone ou o e-mail em branco não é mudança; trocar, apagar ou só formatar diferente, conforme o caso', () => {
    expect(camposProtegidosQueMudam({ telefone: '', email: '' }, { telefone: '11900000044', email: 'maria@exemplo.com' })).toEqual([])
    expect(camposProtegidosQueMudam({ telefone: '11900000004', email: 'maria@exemplo.com' }, { telefone: '(11) 90000-0004', email: ' Maria@Exemplo.com ' })).toEqual([])
    expect(camposProtegidosQueMudam({ telefone: '11900000004', email: 'maria@exemplo.com' }, { telefone: '', email: 'outra@exemplo.com' })).toEqual(['telefone', 'email'])
  })
})
