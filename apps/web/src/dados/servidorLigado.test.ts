// GGVP-125, bloco 1: o lead e a ficha no servidor de verdade, em modo misto. O servidor aqui é de mentira: responde pela
// rota, como o de verdade, e a conferência é do lado da tela (a cópia local, a busca juntando os dois lados, a ficha de
// atendimento). As regras do servidor têm os testes dele, na API.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { salvarFichaDeAtendimento } from './fichaAtendimento.ts'
import { CPF_DE_TESTE } from './exemplo.ts'
import { buscarNoBalcao, configurarExemplo, criarFicha, gravar, ler, ligarPasta, obterFicha, salvarFicha, zerarExemplo } from './servidor.ts'
import type { EnvioDaFicha, EventoHistorico, Ficha, NovoCliente, TarefaEncaminhada } from './tipos.ts'

const AGORA = new Date(2026, 9, 5, 14, 32)
const ID = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
const ivone: NovoCliente = {
  nome: 'Ivone Teste',
  idade: 41,
  pretende: 'Afastada do trabalho há 3 meses, sem receber.',
  telefone: '11900000050',
  beneficioInteresse: 'nao-sei',
  cidadeUf: 'Diadema / SP',
  comoChegou: 'instagram',
  outraPessoa: false,
}
const naHora = (quando: string, oQue: string, quem = 'Ana'): EventoHistorico => ({ quando, quem, oQue })
const CRIOU = naHora('2026-10-05T12:00:00.000Z', 'Criou a ficha no balcão (lead)')

function doBanco(extra: Partial<Ficha> = {}): Ficha {
  return {
    id: ID,
    situacao: 'lead',
    desde: '10/2026',
    nome: 'Ivone Teste',
    idade: 41,
    telefone: '11900000050',
    cidadeUf: 'Diadema / SP',
    comoChegou: 'instagram',
    beneficioInteresse: 'nao-sei',
    senhaGov: { situacao: 'sem-senha' },
    fichaAtendimentoPreenchida: false,
    processos: [],
    agendamentos: [],
    contatos: [{ data: '2026-10-05', canal: 'Presencial (balcão)', texto: ivone.pretende }],
    documentos: [],
    arquivos: [],
    transcricoes: 0,
    historico: [CRIOU],
    ...extra,
  }
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
const corpoDa = (fetch: ReturnType<typeof ligarServidor>, i: number) => JSON.parse(String(fetch.mock.calls[i][1]?.body))
const criada = { 'POST /api/fichas': () => ({ resultado: 'criada', id: ID, pastas: [] }) }

function mexerAqui(mexer: (ficha: Ficha, banco: ReturnType<typeof ler>) => void) {
  const banco = ler()
  mexer(banco.fichas.find((f) => f.id === ID)!, banco)
  gravar(banco)
}

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
})
afterEach(() => {
  configurarExemplo({ servidor: false })
  vi.unstubAllGlobals()
})

describe('GGVP-125 · bloco 1 no servidor, em modo misto', () => {
  it('o lead nasce no servidor e ganha cópia aqui; a pasta do Drive ainda é a de exemplo', async () => {
    const fetch = ligarServidor({ ...criada, [`GET /api/fichas/${ID}`]: () => doBanco() })
    expect(await criarFicha(ivone)).toMatchObject({ resultado: 'criada', id: ID })
    expect(corpoDa(fetch, 0)).toMatchObject({ nome: 'Ivone Teste', outraPessoa: false })
    expect(ler().fichas.find((f) => f.id === ID)?.nome).toBe('Ivone Teste')

    expect(await ligarPasta(ID, 'nova')).toMatchObject({ nova: true })
    expect((await obterFicha(ID))?.historico.map((e) => e.oQue)).toEqual(['Criou a ficha no balcão (lead)', 'Criou a pasta no Drive: Leads/2026/Ivone Teste'])
  })

  it('CPF da semente responde aqui, sem ir ao servidor', async () => {
    const fetch = ligarServidor({})
    expect(await criarFicha({ ...ivone, cpf: CPF_DE_TESTE })).toEqual({ resultado: 'ja-existe', id: 'antonio-exemplo' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('a busca junta a semente e o banco; quem tem cópia aqui sai dela, com a agenda daqui', async () => {
    const OUTRA = '7a2d3c4b-5e6f-4a70-9b8c-1d2e3f4a5b6c'
    const fetch = ligarServidor({
      ...criada,
      [`GET /api/fichas/${ID}`]: () => doBanco(),
      'POST /api/balcao/busca': () => [
        { id: ID, nome: 'Ivone Teste', situacao: 'lead', etapa: 'Lead · contato prévio', casos: [], fichaAtendimentoPreenchida: false },
        { id: OUTRA, nome: 'Ivone Gomes', situacao: 'cliente', etapa: 'Judicial', casos: [], fichaAtendimentoPreenchida: false },
      ],
    })
    await criarFicha(ivone)
    mexerAqui((f) => f.agendamentos.push({ id: 'e1', data: '2026-10-05', hora: '15:30', oQue: 'Entrevista' }))

    const achadas = await buscarNoBalcao('ivone')
    expect(achadas.map((a) => [a.nome, a.etapa])).toEqual([
      ['Ivone Gomes', 'Judicial'],
      ['Ivone Teste', 'Lead · entrevista hoje 15:30'],
    ])
    // O termo vai no corpo, nunca no endereço.
    expect(fetch.mock.calls.at(-1)?.[0]).toBe('/api/balcao/busca')
    expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual({ termo: 'ivone' })
    expect((await buscarNoBalcao('josefa')).map((a) => a.id)).toContain('josefa-exemplo')
  })

  it('três vias: o que mudou no servidor vem de lá; o que as telas daqui mudaram fica', async () => {
    let ficha = doBanco()
    ligarServidor({ ...criada, [`GET /api/fichas/${ID}`]: () => ficha })
    await criarFicha(ivone)
    // Aqui, numa tela ainda não ligada: a profissão.
    mexerAqui((f) => Object.assign(f, { profissao: 'Costureira' }))
    // Lá, outra pessoa em outro computador: o e-mail.
    ficha = doBanco({ email: 'ivone@exemplo.com', historico: [CRIOU, naHora('2026-10-05T18:00:00.000Z', 'Alterou e-mail', 'Gabi')] })

    const vista = await obterFicha(ID)
    expect(vista).toMatchObject({ email: 'ivone@exemplo.com', profissao: 'Costureira' })
    expect(vista?.historico.map((e) => e.oQue)).toEqual(['Criou a ficha no balcão (lead)', 'Alterou e-mail'])
    // De novo, sem nada novo lá: nada muda nem repete.
    expect((await obterFicha(ID))?.historico).toHaveLength(2)
  })

  it('editar vai ao servidor; CPF de quem está na semente não grava', async () => {
    const fetch = ligarServidor({
      ...criada,
      [`GET /api/fichas/${ID}`]: () => doBanco(),
      [`PATCH /api/fichas/${ID}`]: () => ({ ficha: doBanco({ email: 'ivone@exemplo.com', historico: [CRIOU, naHora('2026-10-05T18:00:00.000Z', 'Alterou e-mail')] }) }),
    })
    await criarFicha(ivone)
    expect(await salvarFicha(ID, { nome: 'Ivone Teste', telefone: '11900000050', cpf: CPF_DE_TESTE })).toEqual({ erro: 'cpf-de-outra-ficha', nome: 'Antônio Exemplo' })
    const r = await salvarFicha(ID, { nome: 'Ivone Teste', telefone: '11900000050', email: 'ivone@exemplo.com' })
    expect('ficha' in r && r.ficha.email).toBe('ivone@exemplo.com')
    expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual({ nome: 'Ivone Teste', telefone: '11900000050', email: 'ivone@exemplo.com' })
    expect(ler().fichas.find((f) => f.id === ID)?.email).toBe('ivone@exemplo.com')
  })

  it('a ficha de atendimento grava no servidor e conclui a pendência "Preencher ficha" daqui', async () => {
    const envio: EnvioDaFicha = { nome: 'Ivone Teste', cpf: '52998224725', nascimento: '10/05/1985', telefone: '11900000050', beneficioInteresse: 'nao-sei', origem: 'papel', modelo: 'GGV' }
    const salva = doBanco({
      cpf: '52998224725',
      nascimento: '1985-05-10',
      fichaAtendimentoPreenchida: true,
      fichaAtendimento: { data: '2026-10-05', origem: 'papel', modelo: 'GGV', emBranco: [] },
      historico: [CRIOU, naHora('2026-10-05T18:00:00.000Z', 'Salvou a ficha de atendimento (papel GGV, conferida)')],
    })
    const fetch = ligarServidor({ ...criada, [`GET /api/fichas/${ID}`]: () => doBanco(), [`PUT /api/fichas/${ID}/ficha-de-atendimento`]: () => ({ ficha: salva }) })
    await criarFicha(ivone)
    mexerAqui((_, banco) => banco.tarefas.push({ id: 't1', cliente: { id: ID, nome: 'Ivone Teste' }, acao: 'Preencher ficha' } as TarefaEncaminhada))

    const r = await salvarFichaDeAtendimento(ID, envio)
    expect('ficha' in r && r.ficha).toMatchObject({ fichaAtendimentoPreenchida: true, nascimento: '1985-05-10' })
    expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual(envio)
    expect(ler().tarefas[0].concluida).toBe(true)
  })
})
