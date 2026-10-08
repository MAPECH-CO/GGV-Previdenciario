// GGVP-146, parte 1: a senha do gov.br das fichas do servidor vai ao cofre de verdade, em modo misto. O servidor aqui é
// de mentira: responde pela rota, como o de verdade. Confere o lado da tela: o pedido certo, a cópia daqui com a
// situação e nenhuma senha no navegador (G9). As regras do cofre têm os testes dele, na API.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { guardarSenhaNoCofre, naoSabeASenha } from './cofre.ts'
import { registrarRenovacao } from './renovacao.ts'
import { configurarExemplo, gravar, ler, receber, sincronizarRecepcao, zerarExemplo } from './servidor.ts'
import type { Ficha, SenhaGov, TarefaEncaminhada } from './tipos.ts'

const AGORA = new Date(2026, 9, 8, 12, 0)
const ID = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
const AG = `${ID}-ag-1`
/** Senha de teste: não pode aparecer no armazenamento do navegador. */
const SENHA_DE_TESTE = 'Teste#Cofre-Servidor-5521'
const NO_COFRE: SenhaGov = { situacao: 'no-cofre', atualizadaEm: '2026-10-08T15:00:00.000Z', por: 'Ana (exemplo)' }

function doBanco(extra: Partial<Ficha> = {}): Ficha {
  return {
    id: ID,
    situacao: 'lead',
    desde: '10/2026',
    nome: 'Ivone Teste',
    telefone: '11900000050',
    senhaGov: { situacao: 'sem-senha' },
    fichaAtendimentoPreenchida: false,
    processos: [],
    agendamentos: [{ id: AG, data: '2026-10-09', hora: '14:00', oQue: 'Entrevista', com: 'Dra. Paula', estado: 'marcado' }],
    contatos: [],
    documentos: [],
    arquivos: [],
    transcricoes: 0,
    historico: [],
    ...extra,
  } as Ficha
}

/** Liga o modo misto com um servidor de mentira: cada rota ("MÉTODO /api/...") responde o que a função devolve. */
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
const naCopia = () => ler().fichas.find((f) => f.id === ID)!
const noNavegador = () => JSON.stringify(sessionStorage)

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
})
afterEach(() => {
  configurarExemplo({ servidor: false })
  vi.unstubAllGlobals()
})

describe('GGVP-146 parte 1 · a senha do gov.br da ficha do servidor vai ao cofre de verdade', () => {
  it('a caixa do cofre manda a senha ao servidor, e a cópia daqui recebe só a situação', async () => {
    const fetch = ligarServidor({ [`POST /api/fichas/${ID}/cofre/gov`]: () => ({ senhaGov: NO_COFRE, ficha: doBanco({ senhaGov: NO_COFRE }) }) })
    receber({ ficha: doBanco() })
    expect(await guardarSenhaNoCofre(ID, SENHA_DE_TESTE)).toEqual({ senhaGov: NO_COFRE })
    expect(fetch.mock.calls.map(([url, init]) => [url, init?.method, JSON.parse(String(init?.body))])).toEqual([
      [`/api/fichas/${ID}/cofre/gov`, 'POST', { senha: SENHA_DE_TESTE }],
    ])
    expect(naCopia().senhaGov).toEqual(NO_COFRE)
    // A trilha é a do servidor: a daqui não ganha linha, e a senha não fica no navegador.
    expect(ler().cofre).toEqual([])
    expect(noNavegador()).not.toContain(SENHA_DE_TESTE)
    await expect(guardarSenhaNoCofre(ID, '')).rejects.toThrow('Senha vazia')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('"Não sei a senha" vai ao servidor', async () => {
    const naoSabe: SenhaGov = { situacao: 'sem-senha', naoSabe: true }
    const fetch = ligarServidor({ [`POST /api/fichas/${ID}/cofre/gov/nao-sabe`]: () => ({ senhaGov: naoSabe, ficha: doBanco({ senhaGov: naoSabe }) }) })
    receber({ ficha: doBanco() })
    expect(await naoSabeASenha(ID)).toEqual({ senhaGov: naoSabe })
    expect(fetch.mock.calls[0][1]?.body).toBeUndefined()
    expect(naCopia().senhaGov).toEqual(naoSabe)
  })

  it('GGVP-36 · a renovação da entrevista de uma ficha do servidor vai ao cofre de verdade e fecha a tarefa daqui', async () => {
    const renovada: SenhaGov = { ...NO_COFRE, funcionouEm: '2026-10-08' }
    const renovacao = { resultado: 'renovou', quem: 'Ana (exemplo)', quando: '2026-10-08T15:00:00.000Z' }
    const fetch = ligarServidor({
      [`POST /api/entrevistas/${AG}/renovacao`]: () => ({ senhaGov: renovada, renovacao, ficha: doBanco({ senhaGov: renovada, renovacao } as Partial<Ficha>), tarefas: [] }),
    })
    receber({ ficha: doBanco() })
    const banco = ler()
    const pendente = { id: `renovar-senha-${AG}`, codigo: 'D1.08', cliente: { id: ID, nome: 'Ivone Teste' }, acao: 'Renovar senha do gov.br', setor: 'Atendimento' }
    banco.tarefas.push(pendente as TarefaEncaminhada)
    gravar(banco)

    expect(await registrarRenovacao(AG, { resultado: 'renovou', senha: SENHA_DE_TESTE, conferiMeuInss: true })).toEqual({ senhaGov: renovada, renovacao })
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ resultado: 'renovou', senha: SENHA_DE_TESTE, conferiMeuInss: true })
    expect(naCopia()).toMatchObject({ senhaGov: renovada, renovacao })
    expect(ler().tarefas.find((t) => t.id === pendente.id)?.concluida).toBe(true)
    expect(noNavegador()).not.toContain(SENHA_DE_TESTE)
  })

  it('a situação que mudou no servidor chega à cópia daqui (a senha apagada depois de 1 ano)', async () => {
    let senhaGov: SenhaGov = NO_COFRE
    ligarServidor({ 'GET /api/recepcao': () => ({ fichas: [doBanco({ senhaGov })], tarefas: [], internos: [], gravacoes: [] }) })
    await sincronizarRecepcao()
    expect(naCopia().senhaGov).toEqual(NO_COFRE)
    senhaGov = { situacao: 'sem-senha' }
    await sincronizarRecepcao()
    expect(naCopia().senhaGov).toEqual({ situacao: 'sem-senha' })
  })
})
