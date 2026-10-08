// GGVP-125, bloco 1: o lead e a ficha no servidor de verdade, em modo misto. O servidor aqui é de mentira: responde pela
// rota, como o de verdade, e a conferência é do lado da tela (a cópia local, a busca juntando os dois lados, a ficha de
// atendimento). As regras do servidor têm os testes dele, na API.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarCompromissoInterno, eventosDaAgenda, marcarEntrevista } from './agenda.ts'
import { registrarConfirmacao } from './confirmacao.ts'
import { encerrarGravacao, iniciarGravacao, obterEntrevista } from './entrevista.ts'
import { salvarFichaDeAtendimento } from './fichaAtendimento.ts'
import { tarefasDaAdvogada } from './preparacao.ts'
import { obterGravacoes } from './transcricao.ts'
import { CPF_DE_TESTE } from './exemplo.ts'
import { buscarNoBalcao, configurarExemplo, criarFicha, gravar, ler, ligarPasta, obterFicha, salvarFicha, sincronizarRecepcao, zerarExemplo } from './servidor.ts'
import type { Agendamento, EnvioDaFicha, EventoHistorico, Ficha, Gravacao, Marcacao, NovoCliente, TarefaEncaminhada } from './tipos.ts'

const AGORA = new Date(2026, 9, 5, 14, 32)
const ID = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
const OUTRO = '7a2d3c4b-5e6f-4a70-9b8c-1d2e3f4a5b6c'
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
    const fetch = ligarServidor({
      ...criada,
      [`GET /api/fichas/${ID}`]: () => doBanco(),
      'POST /api/balcao/busca': () => [
        { id: ID, nome: 'Ivone Teste', situacao: 'lead', etapa: 'Lead · contato prévio', casos: [], fichaAtendimentoPreenchida: false },
        { id: OUTRO, nome: 'Ivone Gomes', situacao: 'cliente', etapa: 'Judicial', casos: [], fichaAtendimentoPreenchida: false },
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

  it('a ficha de atendimento grava no servidor; as tarefas que ela fecha e abre vêm de lá', async () => {
    const envio: EnvioDaFicha = { nome: 'Ivone Teste', cpf: '52998224725', nascimento: '10/05/1985', telefone: '11900000050', beneficioInteresse: 'nao-sei', origem: 'papel', modelo: 'GGV' }
    const salva = doBanco({
      cpf: '52998224725',
      nascimento: '1985-05-10',
      fichaAtendimentoPreenchida: true,
      fichaAtendimento: { data: '2026-10-05', origem: 'papel', modelo: 'GGV', emBranco: [] },
      historico: [CRIOU, naHora('2026-10-05T18:00:00.000Z', 'Salvou a ficha de atendimento (papel GGV, conferida)')],
    })
    const tarefas = [tarefa('preencher-ficha-x', 'Preencher ficha', 'Atendimento', true), tarefa('preparar-x', 'Preparar entrevista', 'Jurídico')]
    const fetch = ligarServidor({ ...criada, [`GET /api/fichas/${ID}`]: () => doBanco(), [`PUT /api/fichas/${ID}/ficha-de-atendimento`]: () => ({ ficha: salva, tarefas }) })
    await criarFicha(ivone)
    mexerAqui((_, banco) => banco.tarefas.push(tarefa('preencher-ficha-x', 'Preencher ficha', 'Atendimento')))

    const r = await salvarFichaDeAtendimento(ID, envio)
    expect('ficha' in r && r.ficha).toMatchObject({ fichaAtendimentoPreenchida: true, nascimento: '1985-05-10' })
    expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual(envio)
    expect(ler().tarefas.map((t) => [t.acao, t.concluida ?? false])).toEqual([
      ['Preencher ficha', true],
      ['Preparar entrevista', false],
    ])
  })
})

const tarefa = (id: string, acao: string, setor: TarefaEncaminhada['setor'], concluida = false): TarefaEncaminhada => ({
  id,
  codigo: 'D1.06',
  cliente: { id: ID, nome: 'Ivone Teste' },
  acao,
  detalhe: '',
  href: `/clientes/${ID}`,
  setor,
  ...(concluida && { concluida }),
})
const entrevista = (id: string, extra: Partial<Agendamento> = {}): Agendamento => ({ id, data: '2026-10-06', hora: '14:00', oQue: 'Entrevista', com: 'Dra. Paula', estado: 'marcado', ...extra })
const MARCACAO: Marcacao = { tipo: 'presencial', data: '2026-10-06', hora: '14:00', duracao: 45, com: 'paula', gravar: true, levar: true, pedirFicha: true, confirmarHorarioOcupado: false }

describe('GGVP-125 · bloco 2: agenda e confirmação no servidor, em modo misto', () => {
  it('ao abrir a tela, a cópia recebe fichas, tarefas e compromissos; a tarefa que sumiu lá foi concluída', async () => {
    let doServidor = { fichas: [doBanco()], tarefas: [tarefa('preparar-x', 'Preparar entrevista', 'Jurídico')], internos: [{ id: OUTRO, titulo: 'Gravação', data: '2026-10-06', hora: '10:00', duracao: 60, responsavel: 'atendimento', estado: 'marcado' as const }], gravacoes: [] }
    ligarServidor({ 'GET /api/recepcao': () => doServidor })
    await sincronizarRecepcao()
    expect(ler().fichas.some((f) => f.id === ID)).toBe(true)
    expect(tarefasDaAdvogada().some((t) => t.acao === 'Preparar entrevista')).toBe(true)
    expect((await eventosDaAgenda('2026-10-06', '2026-10-06')).map((e) => e.titulo)).toContain('Gravação')

    // Uma tarefa só daqui (tela ainda não ligada) fica; a do servidor que não veio mais foi concluída lá.
    const banco = ler()
    banco.tarefas.push(tarefa('daqui', 'Conferir contrato', 'Atendimento'))
    gravar(banco)
    doServidor = { ...doServidor, tarefas: [], internos: [] }
    await sincronizarRecepcao()
    expect(ler().tarefas.map((t) => [t.id, t.concluida ?? false])).toEqual([
      ['preparar-x', true],
      ['daqui', false],
    ])
    expect(ler().internos.some((i) => i.id === OUTRO)).toBe(false)
  })

  it('três vias na agenda: o compromisso que só existe aqui fica; o que mudou lá vem de lá', async () => {
    let ficha = doBanco({ agendamentos: [entrevista(`${ID}-ag-1`)] })
    ligarServidor({ 'GET /api/recepcao': () => ({ fichas: [ficha], tarefas: [], internos: [], gravacoes: [] }) })
    await sincronizarRecepcao()
    // Aqui, uma tela ainda não ligada marca a retirada da cópia do contrato.
    mexerAqui((f) => f.agendamentos.push(entrevista(`${ID}-ag-local`, { oQue: 'Retirada da cópia do contrato' })))
    // Lá, a entrevista foi realizada.
    ficha = doBanco({ agendamentos: [entrevista(`${ID}-ag-1`, { estado: 'realizado' })] })
    await sincronizarRecepcao()
    expect(ler().fichas.find((f) => f.id === ID)?.agendamentos.map((a) => [a.oQue, a.estado])).toEqual([
      ['Entrevista', 'realizado'],
      ['Retirada da cópia do contrato', 'marcado'],
    ])
  })

  it('marcar: o horário da semente daqui avisa sem ir ao servidor; livre, marca lá e a cópia recebe', async () => {
    const marcada = entrevista(`${ID}-ag-1`, { data: '2026-10-07', hora: '10:30', tipo: 'presencial', duracao: 45 })
    const fetch = ligarServidor({
      ...criada,
      [`GET /api/fichas/${ID}`]: () => doBanco(),
      [`POST /api/fichas/${ID}/agendamentos`]: () => ({ resultado: 'marcado', agendamento: marcada, ficha: doBanco({ agendamentos: [marcada] }) }),
    })
    await criarFicha(ivone)
    mexerAqui((_, banco) => banco.fichas.find((f) => f.id === 'josefa-exemplo')!.agendamentos.push(entrevista('josefa-ag-x', { duracao: 45 })))
    const chamadas = fetch.mock.calls.length

    expect(await marcarEntrevista(ID, MARCACAO)).toMatchObject({ resultado: 'ocupado', conflitos: [{ titulo: 'Josefa Exemplo' }] })
    expect(fetch.mock.calls.length).toBe(chamadas)
    expect(await marcarEntrevista(ID, { ...MARCACAO, data: '2026-10-07', hora: '10:30' })).toEqual({ resultado: 'marcado', agendamento: marcada })
    expect(ler().fichas.find((f) => f.id === ID)?.agendamentos).toEqual([marcada])
  })

  it('confirmação e compromisso interno vão ao servidor; a tarefa da advogada chega à Central dela', async () => {
    const a = entrevista(`${ID}-ag-1`)
    const fetch = ligarServidor({
      ...criada,
      [`GET /api/fichas/${ID}`]: () => doBanco({ agendamentos: [a] }),
      [`POST /api/agendamentos/${a.id}/confirmacao`]: () => ({
        tentativa: 1,
        naSenior: false,
        tarefa: tarefa('preparar-x', 'Preparar entrevista', 'Jurídico'),
        ficha: doBanco({ agendamentos: [{ ...a, confirmacao: { tentativas: [{ quando: '2026-10-05T17:40:00.000Z', quem: 'Ana', canal: 'ligacao', resultado: 'confirmou' }] } }] }),
        tarefas: [tarefa('preparar-x', 'Preparar entrevista', 'Jurídico')],
      }),
      'POST /api/agenda/internos': (corpo) => ({
        evento: { id: OUTRO, titulo: 'Gravação', oQue: 'Compromisso interno' },
        interno: { ...(corpo as object), id: OUTRO, estado: 'marcado' },
      }),
    })
    await criarFicha(ivone)
    expect(await registrarConfirmacao(a.id, { resultado: 'confirmou', canal: 'ligacao', jaPreencheuFicha: true })).toEqual({
      tentativa: 1,
      naSenior: false,
      tarefa: tarefa('preparar-x', 'Preparar entrevista', 'Jurídico'),
    })
    expect(tarefasDaAdvogada().map((t) => t.acao)).toContain('Preparar entrevista')

    await criarCompromissoInterno({ titulo: 'Gravação', data: '2026-10-06', hora: '10:00', duracao: 60, responsavel: 'atendimento' })
    expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual({ titulo: 'Gravação', data: '2026-10-06', hora: '10:00', duracao: 60, responsavel: 'atendimento' })
    expect(ler().internos.map((i) => i.titulo)).toEqual(['Gravação'])
  })
})

const gravacao = (id: string, extra: Partial<Gravacao> = {}): Gravacao => ({
  id,
  fichaId: ID,
  agendamentoId: `${ID}-ag-1`,
  data: '2026-10-05',
  titulo: 'Entrevista com a advogada',
  canal: 'presencial',
  participantes: ['Dra. Paula', 'Ivone Teste'],
  duracao: 0,
  origem: 'portal',
  estado: 'gravando',
  acoes: [],
  transcricao: 'transcrevendo',
  trechos: [],
  extraidas: [],
  documentos: [],
  soJuridico: true,
  marcas: [],
  ...extra,
})

describe('GGVP-125 · bloco 3a: entrevista gravada e transcrição no servidor, em modo misto', () => {
  it('a cópia recebe as gravações que o perfil pode ver; a que não veio mais sai daqui', async () => {
    let gravacoes = [gravacao(`gravacao-${OUTRO}`)]
    ligarServidor({ 'GET /api/recepcao': () => ({ fichas: [doBanco()], tarefas: [], internos: [], gravacoes }) })
    await sincronizarRecepcao()
    expect((await obterGravacoes(ID)).map((g) => g.id)).toEqual([`gravacao-${OUTRO}`])
    // Outro perfil na mesma aba (sem dado de saúde): a entrevista do Jurídico não fica na cópia.
    gravacoes = []
    await sincronizarRecepcao()
    expect(await obterGravacoes(ID)).toEqual([])
  })

  it('gravar e encerrar a entrevista de uma ficha do servidor: a gravação e as tarefas vêm de lá', async () => {
    const a = entrevista(`${ID}-ag-1`)
    const id = `gravacao-${OUTRO}`
    const encerrada = gravacao(id, { estado: 'encerrada', duracao: 300 })
    const fetch = ligarServidor({
      ...criada,
      [`GET /api/fichas/${ID}`]: () => doBanco({ agendamentos: [a] }),
      [`POST /api/entrevistas/${a.id}/gravacoes`]: () => ({ gravacao: gravacao(id), ficha: doBanco({ agendamentos: [a] }) }),
      [`POST /api/gravacoes/${id}/encerrar`]: () => ({
        gravacao: encerrada,
        tarefa: tarefa('cadastrar-x', 'Cadastrar lead', 'Jurídico'),
        ficha: doBanco({ agendamentos: [{ ...a, estado: 'realizado' }] }),
        tarefas: [tarefa('cadastrar-x', 'Cadastrar lead', 'Jurídico')],
      }),
    })
    await criarFicha(ivone)
    expect((await iniciarGravacao(a.id, { avisei: true })).id).toBe(id)
    expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual({ avisei: true })
    expect(await encerrarGravacao(id, { aos: 300, online: true })).toEqual({ gravacao: encerrada, tarefa: tarefa('cadastrar-x', 'Cadastrar lead', 'Jurídico') })
    expect((await obterEntrevista(a.id))?.gravacao).toEqual(encerrada)
    expect(ler().fichas.find((f) => f.id === ID)?.agendamentos[0].estado).toBe('realizado')
    expect(tarefasDaAdvogada().map((t) => t.acao)).toContain('Cadastrar lead')
  })
})
