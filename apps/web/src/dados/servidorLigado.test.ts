// GGVP-125, bloco 1: o lead e a ficha no servidor de verdade, em modo misto. O servidor aqui é de mentira: responde pela
// rota, como o de verdade, e a conferência é do lado da tela (a cópia local, a busca juntando os dois lados, a ficha de
// atendimento). As regras do servidor têm os testes dele, na API.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarCompromissoInterno, eventosDaAgenda, marcarEntrevista } from './agenda.ts'
import { definirBeneficio } from './beneficio.ts'
import { guardarSenhaNoCofre } from './cofre.ts'
import {
  avisarClienteDaConferencia,
  concluirAssinaturaEmPapel,
  digitalizarContratoAssinado,
  enviarParaAssinatura,
  fecharContrato,
  gerarContrato,
  imprimirCopia,
  imprimirKit,
  marcarVisitaDaCopia,
  registrarEntregaDaCopia,
  registrarTentativaDeAssinatura,
  simularLeituraDoContrato,
  simularRetornoDoZapSign,
  tarefasDoContrato,
  verificarContrato,
  type Contrato,
} from './contrato.ts'
import { registrarConfirmacao } from './confirmacao.ts'
import { encerrarGravacao, iniciarGravacao, obterEntrevista } from './entrevista.ts'
import { lerFichaEmPapel, salvarFichaDeAtendimento } from './fichaAtendimento.ts'
import { enviarArquivos, receberLote, registrarRecebimento } from './documentos.ts'
import { arquivarDocumentos, moverDocumento, tarefasDeConferirDocumento, type DocumentoLido } from './leitura.ts'
import { registrarFechamento } from './fechamento.ts'
import { obterPreparacao, tarefasDaAdvogada } from './preparacao.ts'
import { lerSegundaFichaEmPapel } from './segundaFicha.ts'
import { respostasVazias } from '../regras/segundaFicha.ts'
import { CONFERENCIAS, type IdDaConferencia } from '../regras/contrato.ts'
import { obterGravacoes } from './transcricao.ts'
import { CPF_DE_TESTE } from './exemplo.ts'
import { buscarNoBalcao, configurarExemplo, criarFicha, gravar, ler, ligarPasta, obterFicha, salvarFicha, sincronizarRecepcao, zerarExemplo } from './servidor.ts'
import type { Agendamento, Arquivo, EnvioDaFicha, EventoHistorico, Ficha, Gravacao, Marcacao, NovoCliente, TarefaEncaminhada } from './tipos.ts'

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
    let doServidor = { fichas: [doBanco()], tarefas: [tarefa('preparar-x', 'Preparar entrevista', 'Jurídico')], internos: [{ id: OUTRO, titulo: 'Gravação', data: '2026-10-06', hora: '10:00', duracao: 60, responsavel: 'atendimento', estado: 'marcado' as const }], gravacoes: [], contratos: [] }
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
    ligarServidor({ 'GET /api/recepcao': () => ({ fichas: [ficha], tarefas: [], internos: [], gravacoes: [], contratos: [] }) })
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
    ligarServidor({ 'GET /api/recepcao': () => ({ fichas: [doBanco()], tarefas: [], internos: [], gravacoes, contratos: [] }) })
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

describe('GGVP-125 · bloco 3b: as decisões depois da entrevista no servidor, em modo misto', () => {
  it('o benefício da ficha do servidor é decidido lá; a cópia recebe a decisão e as tarefas', async () => {
    const a = entrevista(`${ID}-ag-1`, { estado: 'realizado' })
    const definida = { beneficio: 'loas-idoso', agendamentoId: a.id, quem: 'gabi', quando: '2026-10-05T18:00:00.000Z', fontes: [], recusouSugestao: false }
    const fetch = ligarServidor({
      ...criada,
      [`GET /api/fichas/${ID}`]: () => doBanco({ agendamentos: [a] }),
      [`POST /api/entrevistas/${a.id}/beneficio`]: () => ({
        ficha: doBanco({ agendamentos: [a], beneficioDefinido: definida, historico: [CRIOU, naHora('2026-10-05T18:00:00.000Z', 'Definiu o benefício do caso (D1.12): BPC')] }),
        tarefas: [tarefa('definir-x', 'Definir benefício', 'Jurídico', true)],
      }),
    })
    await criarFicha(ivone)
    mexerAqui((_, banco) => banco.tarefas.push(tarefa('definir-x', 'Definir benefício', 'Jurídico')))
    const r = await definirBeneficio(a.id, { beneficio: 'loas-idoso', conferi: true })
    expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual({ beneficio: 'loas-idoso', conferi: true })
    expect(r.ficha.beneficioDefinido).toEqual(definida)
    expect(ler().tarefas.find((t) => t.id === 'definir-x')?.concluida).toBe(true)
  })

  it('não fechou e arquivado: as tarefas do servidor encerram lá, e as que são só daqui encerram aqui', async () => {
    ligarServidor({
      ...criada,
      [`GET /api/fichas/${ID}`]: () => doBanco(),
      [`POST /api/fichas/${ID}/fechamento`]: () => ({
        fechou: false,
        ficha: doBanco({ fechamento: { situacao: 'arquivado', motivo: 'preco', papel: 'atendimento', quem: 'Ana', quando: '2026-10-05T18:00:00.000Z' } }),
        tarefas: [],
      }),
    })
    await criarFicha(ivone)
    mexerAqui((_, banco) => banco.tarefas.push(tarefa('so-daqui', 'Conferir contrato', 'Atendimento')))
    const r = await registrarFechamento(ID, { fechou: false, motivo: 'preco', papel: 'atendimento', recontatar: null })
    expect(r.ficha.fechamento).toMatchObject({ situacao: 'arquivado', motivo: 'preco' })
    expect(ler().tarefas.find((t) => t.id === 'so-daqui')?.concluida).toBe(true)
  })

  it('G9: a senha vai ao cofre do portal; a rota da ficha recebe só a situação, e nada fica no navegador', async () => {
    const SENHA = 'segredo-do-gov-77'
    const fetch = ligarServidor({
      ...criada,
      [`GET /api/fichas/${ID}`]: () => doBanco(),
      [`POST /api/pessoas/${ID}/cofre`]: () => ({ ok: true, trocada: false }),
      [`POST /api/fichas/${ID}/cofre/gov`]: () => ({ senhaGov: { situacao: 'no-cofre', por: 'Ana' }, ficha: doBanco({ senhaGov: { situacao: 'no-cofre', por: 'Ana' } }) }),
    })
    await criarFicha(ivone)
    expect(await guardarSenhaNoCofre(ID, SENHA)).toEqual({ senhaGov: { situacao: 'no-cofre', por: 'Ana' } })
    const ultimas = fetch.mock.calls.slice(-2).map((c) => [c[0], JSON.parse(String(c[1]?.body))])
    expect(ultimas).toEqual([
      [`/api/pessoas/${ID}/cofre`, { senha: SENHA }],
      [`/api/fichas/${ID}/cofre/gov`, { acao: 'guardou' }],
    ])
    expect(JSON.stringify(ler())).not.toContain(SENHA)
    expect(ler().fichas.find((f) => f.id === ID)?.senhaGov.situacao).toBe('no-cofre')
  })
})

describe('GGVP-125 · bloco 3c: a segunda ficha no servidor, com a seção médica só no Jurídico', () => {
  const MEDICO = 'dor e perda de força na mão'

  it('a leitura do papel de uma ficha do servidor vai lá; a imagem vem na ficha do servidor; a seção médica não volta', async () => {
    const arquivo = { nome: 'Ficha de atendimento AUXILIO ACIDENTE - Ivone Teste - 2026-10-05.pdf', tipo: 'ficha-acidente', local: 'pessoais', data: '2026-10-05', origem: 'scanner' as const, repetido: false, aguardaLeitura: false }
    ligarServidor({
      ...criada,
      [`GET /api/fichas/${ID}`]: () => doBanco(),
      [`POST /api/fichas/${ID}/segunda-ficha/leitura`]: () => ({ arquivo, respostas: { empresa: 'Exemplo Indústria Ltda', doencas: '' }, senhaLida: false, ficha: doBanco({ arquivos: [arquivo] }) }),
    })
    await criarFicha(ivone)
    const r = await lerSegundaFichaEmPapel(ID)
    expect(r).toMatchObject({ senhaLida: false, respostas: { doencas: '' } })
    expect(ler().fichas.find((f) => f.id === ID)?.arquivos).toEqual([arquivo])
  })

  it('a preparação busca a seção médica ao abrir; ela fica só na tela, nunca na cópia do navegador', async () => {
    const a = entrevista(`${ID}-ag-1`)
    const segundaFicha = { data: '2026-10-05', origem: 'papel' as const, respostas: { ...respostasVazias(), empresa: 'Exemplo Indústria Ltda', historico: 'Prendeu a mão.' }, emBranco: [] }
    const fetch = ligarServidor({
      'GET /api/recepcao': () => ({ fichas: [doBanco({ agendamentos: [a], segundaFicha })], tarefas: [], internos: [], gravacoes: [], contratos: [] }),
      [`GET /api/fichas/${ID}/segunda-ficha`]: () => ({ medicos: { doencas: MEDICO }, lida: false }),
    })
    await sincronizarRecepcao()
    const preparacao = await obterPreparacao(a.id)
    expect(preparacao?.ficha.segundaFicha?.respostas).toMatchObject({ empresa: 'Exemplo Indústria Ltda', doencas: MEDICO })
    expect(fetch.mock.calls.at(-1)?.[0]).toBe(`/api/fichas/${ID}/segunda-ficha`)
    expect(JSON.stringify(ler())).not.toContain(MEDICO)
  })
})

describe('GGVP-125 · bloco 4a: o "fechou" vira caso no banco, com o contrato', () => {
  const CASO = '9b1c2d3e-4f50-4a61-8b72-0c1d2e3f4a5b'
  const condicoes = { representado: false, moradia: false, uniaoEstavel: false, separacaoDeFato: false }
  const contrato = (extra: Partial<Contrato> = {}): Contrato => ({ processoId: CASO, fichaId: ID, etapa: 'preparar', condicoes, kit: null, abertoEm: '2026-10-05T17:40:00.000Z', ...extra })
  const processo = { id: CASO, beneficio: 'loas-idoso', etapa: 'Contrato · preparar', proximaAcao: 'preparar o contrato', prazo: 'hoje' }
  const cliente = (extra: Partial<Ficha> = {}) =>
    doBanco({ situacao: 'cliente', desde: '10/2026', processos: [processo], historico: [CRIOU, naHora('2026-10-05T17:40:00.000Z', 'Fechou LOAS')], ...extra })

  it('fechou numa ficha do servidor: o caso nasce lá; a cópia recebe o cliente, o processo e o contrato, sem perder os da semente', async () => {
    const fetch = ligarServidor({
      ...criada,
      [`GET /api/fichas/${ID}`]: () => doBanco(),
      [`POST /api/fichas/${ID}/processos`]: () => ({ ficha: cliente(), processo, contrato: contrato() }),
    })
    await criarFicha(ivone)
    const r = await fecharContrato(ID, 'loas-idoso')
    expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual({ beneficio: 'loas-idoso' })
    expect(r.processo.id).toBe(CASO)
    expect(ler().fichas.find((f) => f.id === ID)).toMatchObject({ situacao: 'cliente', processos: [{ id: CASO, etapa: 'Contrato · preparar' }] })
    const processos = ler().contratos!.map((c) => c.processoId)
    expect(processos).toContain(CASO)
    expect(processos).toContain('cleide-exemplo-1')
    expect(tarefasDoContrato().map((t) => [t.cliente?.nome, t.acao])).toContainEqual(['Ivone Teste', 'Preparar contrato'])
  })

  it('gerar o contrato de um caso do servidor: o servidor gera; a cópia recebe o contrato e a ficha', async () => {
    const gerado = contrato({ etapa: 'assinatura', documento: { versao: 1, geradoEm: '2026-10-05T18:00:00.000Z', campos: [], textos: [] } })
    ligarServidor({
      'GET /api/recepcao': () => ({ fichas: [cliente()], tarefas: [], internos: [], gravacoes: [], contratos: [contrato()] }),
      [`POST /api/processos/${CASO}/contrato/gerar`]: () => ({
        resultado: 'gerado',
        contrato: gerado,
        ficha: cliente({ processos: [{ ...processo, etapa: 'Contrato · assinatura', proximaAcao: 'colher a assinatura' }] }),
      }),
    })
    await sincronizarRecepcao()
    const conferencias = Object.fromEntries(CONFERENCIAS.map((c) => [c.id, true])) as Record<IdDaConferencia, boolean>
    expect(await gerarContrato(CASO, { aprovados: true, conferencias, correcoes: {} })).toEqual({ resultado: 'gerado', contrato: gerado })
    expect(ler().contratos!.find((c) => c.processoId === CASO)?.etapa).toBe('assinatura')
    expect(ler().fichas.find((f) => f.id === ID)?.processos[0].etapa).toBe('Contrato · assinatura')
  })

  const assinando = cliente({ processos: [{ ...processo, etapa: 'Contrato · assinatura', proximaAcao: 'colher a assinatura' }] })
  const comContrato = (c: Contrato) => ({ 'GET /api/recepcao': () => ({ fichas: [assinando], tarefas: [], internos: [], gravacoes: [], contratos: [c] }) })

  describe('bloco 4b: a assinatura', () => {
    const paraAssinar = contrato({ etapa: 'assinatura' })
    const noZapSign = (extra: Partial<NonNullable<Contrato['assinatura']>> = {}): Contrato => ({
      ...paraAssinar,
      assinatura: {
        forma: 'digital',
        tentativas: [],
        zapsign: { documentoId: `zapsign-exemplo-${CASO}`, link: 'https://zapsign.exemplo/assinar/x', status: 'enviado', criadoEm: '2026-10-05T18:00:00.000Z', eventos: [] },
        ...extra,
      },
    })
    const assinadoEm = cliente({ processos: [{ ...processo, etapa: 'Contrato assinado em 05/10', proximaAcao: 'ler e arquivar o contrato assinado' }] })
    const arquivo = { nome: 'Contrato assinado - Ivone Teste - 2026-10-05 (ZapSign, com evidências).pdf', tipo: 'contrato', local: CASO, data: '2026-10-05', origem: 'card' as const, repetido: false, aguardaLeitura: true }
    const daSenior: TarefaEncaminhada = {
      id: `senior-assinatura-${CASO}`,
      codigo: 'D1.17',
      cliente: { id: ID, nome: 'Ivone Teste' },
      acao: 'Colher assinatura · limite de tentativas',
      detalhe: 'LOAS',
      prazo: 'hoje',
      href: `/contrato/${CASO}/assinatura`,
      processoId: CASO,
      setor: 'Jurídico',
    }

    it('ZapSign: o documento nasce lá; a tentativa vai com o canal e a mensagem; no limite, a tarefa da sênior chega aqui', async () => {
      const fetch = ligarServidor({
        ...comContrato(paraAssinar),
        [`POST /api/processos/${CASO}/contrato/zapsign`]: () => ({ resultado: 'gerado', contrato: noZapSign(), mensagem: 'Olá, Ivone! Aqui está o link', ficha: assinando }),
        [`POST /api/processos/${CASO}/contrato/tentativas`]: () => ({ contrato: noZapSign({ naSenior: true }), ficha: assinando, tarefas: [daSenior] }),
      })
      await sincronizarRecepcao()
      expect(await enviarParaAssinatura(CASO)).toEqual({ resultado: 'gerado', contrato: noZapSign(), mensagem: 'Olá, Ivone! Aqui está o link' })
      expect(ler().contratos!.find((c) => c.processoId === CASO)?.assinatura?.zapsign?.status).toBe('enviado')
      await expect(registrarTentativaDeAssinatura(CASO, 'whatsapp', ' ')).rejects.toThrow('Escreva a mensagem')
      await registrarTentativaDeAssinatura(CASO, 'whatsapp', 'Olá, Ivone! Aqui está o link')
      expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual({ canal: 'whatsapp', mensagem: 'Olá, Ivone! Aqui está o link' })
      expect(ler().tarefas.find((t) => t.id === daSenior.id)?.setor).toBe('Jurídico')
      // Na sênior, a tarefa do contrato sai da Central do Atendimento.
      expect(tarefasDoContrato().map((t) => t.processoId)).not.toContain(CASO)
    })

    it('o retorno simulado vai ao servidor: o contrato assinado e a tarefa da sênior concluída vêm de lá; o arquivo fica na pasta daqui', async () => {
      ligarServidor({
        ...comContrato(noZapSign({ naSenior: true })),
        [`POST /api/processos/${CASO}/contrato/zapsign/retorno-simulado`]: () => ({
          resultado: 'anexado',
          arquivo,
          contrato: { ...noZapSign({ naSenior: true, arquivo: arquivo.nome, assinadoEm: '2026-10-05T19:00:00.000Z' }), etapa: 'leitura' },
          ficha: { ...assinadoEm, arquivos: [arquivo] },
          tarefas: [{ ...daSenior, concluida: true }],
        }),
      })
      await sincronizarRecepcao()
      expect(await simularRetornoDoZapSign(CASO)).toEqual({ resultado: 'anexado', arquivo })
      const aqui = ler()
      expect(aqui.contratos!.find((c) => c.processoId === CASO)?.etapa).toBe('leitura')
      expect(aqui.fichas.find((f) => f.id === ID)).toMatchObject({ processos: [{ etapa: 'Contrato assinado em 05/10' }], arquivos: [arquivo] })
      expect(aqui.tarefas.find((t) => t.id === daSenior.id)?.concluida).toBe(true)
    })

    it('papel: imprimir, digitalizar e concluir vão ao servidor; a digitalização fica na pasta daqui', async () => {
      const papel = { ...paraAssinar, assinatura: { forma: 'papel' as const, tentativas: [], impressoEm: '2026-10-05T18:10:00.000Z' } }
      const digitalizado = { ...papel, assinatura: { ...papel.assinatura, arquivo: 'assinado.pdf' } }
      const scanner = { ...arquivo, nome: 'assinado.pdf', origem: 'scanner' as const }
      const fetch = ligarServidor({
        ...comContrato(paraAssinar),
        [`POST /api/processos/${CASO}/contrato/impressao`]: () => ({ contrato: papel, datas: [{ documento: 'Contrato de honorários', data: '05/10/2026' }], ficha: assinando }),
        [`POST /api/processos/${CASO}/contrato/digitalizacao`]: () => ({ arquivo: scanner, contrato: digitalizado, ficha: { ...assinando, arquivos: [scanner] } }),
        [`POST /api/processos/${CASO}/contrato/assinatura-em-papel`]: () => ({ contrato: { ...digitalizado, etapa: 'leitura' }, ficha: { ...assinadoEm, arquivos: [scanner] } }),
      })
      await sincronizarRecepcao()
      expect((await imprimirKit(CASO)).datas).toEqual([{ documento: 'Contrato de honorários', data: '05/10/2026' }])
      expect(await digitalizarContratoAssinado(CASO)).toEqual(scanner)
      expect((await concluirAssinaturaEmPapel(CASO)).etapa).toBe('leitura')
      expect(fetch.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${url}`).slice(-3)).toEqual([
        `POST /api/processos/${CASO}/contrato/impressao`,
        `POST /api/processos/${CASO}/contrato/digitalizacao`,
        `POST /api/processos/${CASO}/contrato/assinatura-em-papel`,
      ])
      expect(ler().fichas.find((f) => f.id === ID)?.arquivos).toEqual([scanner])
    })
  })

  describe('bloco 4c: a leitura, a conferência e a cópia', () => {
    const lendo = contrato({ etapa: 'leitura', assinatura: { forma: 'papel', tentativas: [], arquivo: 'assinado.pdf', assinadoEm: '2026-10-05T19:00:00.000Z' } })
    const leitura = {
      reconhecido: true,
      assinatura: { reconhecida: true, texto: 'reconhecida (nome e CPF conferem)' },
      faltam: ['pág. 4 (rubrica)'],
      pendencias: ['a página da assinatura veio cortada'],
      lidoEm: '2026-10-05T19:10:00.000Z',
    }
    const conferindo: Contrato = { ...lendo, etapa: 'conferir', leitura }

    it('a leitura vai ao servidor sem a daqui; a correção também, e a página corrigida fica na pasta daqui', async () => {
      const pagina = { nome: 'pagina 4.pdf', tipo: 'contrato', local: CASO, data: '2026-10-05', origem: 'card' as const, repetido: false, aguardaLeitura: false }
      const fetch = ligarServidor({
        ...comContrato(lendo),
        [`POST /api/processos/${CASO}/contrato/leitura-simulada`]: () => ({ contrato: conferindo, ficha: assinando }),
        [`POST /api/processos/${CASO}/contrato/verificacao`]: () => ({ contrato: { ...lendo, etapa: 'preparar', assinatura: undefined }, ficha: { ...assinando, arquivos: [pagina] }, arquivo: pagina }),
      })
      await sincronizarRecepcao()
      expect((await simularLeituraDoContrato(CASO)).etapa).toBe('conferir')
      expect(fetch.mock.calls.at(-1)![1]?.body).toBeUndefined()
      expect(tarefasDoContrato().find((t) => t.processoId === CASO)?.acao).toBe('Conferir contrato')
      const correcao = { tudoCerto: false, oQueCorrigir: 'falta a rubrica', paginaCorrigida: { nome: 'pagina 4.pdf', tamanho: 2048 } }
      expect((await verificarContrato(CASO, correcao)).etapa).toBe('preparar')
      expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual(correcao)
      expect(ler().fichas.find((f) => f.id === ID)?.arquivos).toEqual([pagina])
    })

    it('aviso, impressão, visita e entrega da cópia vão ao servidor; a visita volta na agenda da ficha', async () => {
      const copia: Contrato = { ...conferindo, etapa: 'copia' }
      const visita = { id: `copia-${CASO}-1`, data: '2026-10-13', hora: '10:00', oQue: 'Entregar cópia do contrato', tipo: 'presencial' as const, duracao: 30 }
      const comVisita = cliente({ agendamentos: [visita] })
      const entrega = { copiaDaVersaoAssinada: true, entregueEm: '05/10/2026', quemRecebeu: 'Ivone Teste', observacao: '' }
      const fetch = ligarServidor({
        ...comContrato(copia),
        [`POST /api/processos/${CASO}/contrato/conferencia/aviso`]: () => ({ ficha: assinando }),
        [`POST /api/processos/${CASO}/contrato/copia/impressao`]: () => ({ contrato: { ...copia, copia: { impressaEm: '2026-10-05T19:20:00.000Z' } }, ficha: assinando }),
        [`POST /api/processos/${CASO}/contrato/copia/visita`]: () => ({ visita, contrato: { ...copia, copia: { visitaId: visita.id } }, ficha: comVisita }),
        [`POST /api/processos/${CASO}/contrato/copia/entrega`]: () => ({ contrato: { ...copia, etapa: 'entregue' }, ficha: comVisita }),
      })
      await sincronizarRecepcao()
      await avisarClienteDaConferencia(CASO, 'Ivone, falta a página 4.')
      expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual({ mensagem: 'Ivone, falta a página 4.' })
      expect((await imprimirCopia(CASO)).copia?.impressaEm).toBe('2026-10-05T19:20:00.000Z')
      expect(await marcarVisitaDaCopia(CASO, '13/10/2026', '10:00')).toEqual(visita)
      expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual({ data: '13/10/2026', hora: '10:00' })
      expect(ler().fichas.find((f) => f.id === ID)?.agendamentos).toContainEqual(visita)
      expect((await registrarEntregaDaCopia(CASO, entrega)).etapa).toBe('entregue')
      expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual(entrega)
      // Entregue, o contrato sai das tarefas do Atendimento: o checklist do benefício é da Documentação.
      expect(tarefasDoContrato().map((t) => t.processoId)).not.toContain(CASO)
    })
  })
})

describe('GGVP-125 · bloco 5a: a lista de arquivos da ficha no servidor', () => {
  const doc = (nome: string, extra: Partial<Arquivo> = {}): Arquivo => ({
    nome,
    tipo: 'rg',
    local: 'pessoais',
    data: '2026-10-05',
    origem: 'card',
    repetido: false,
    aguardaLeitura: true,
    ...extra,
  })
  async function sincronizarCom(ficha: Ficha) {
    ligarServidor({ 'GET /api/recepcao': () => ({ fichas: [ficha], tarefas: [], internos: [], gravacoes: [], contratos: [] }) })
    await sincronizarRecepcao()
  }

  it('três vias nos arquivos: o que o servidor acrescenta ou muda vem de lá; o que só existe aqui fica; o mesmo nome noutra pasta é outro arquivo', async () => {
    await sincronizarCom(doBanco({ arquivos: [doc('rg.pdf')] }))
    mexerAqui((f) => f.arquivos.push(doc('comprovante.pdf', { tipo: 'comprovante' })))
    await sincronizarCom(doBanco({ arquivos: [doc('rg.pdf', { aguardaLeitura: false }), doc('rg.pdf', { local: 'processo-1' })] }))
    expect(ler().fichas.find((f) => f.id === ID)?.arquivos).toEqual([
      doc('rg.pdf', { aguardaLeitura: false }),
      doc('comprovante.pdf', { tipo: 'comprovante' }),
      doc('rg.pdf', { local: 'processo-1' }),
    ])
  })

  it('a ficha de atendimento em papel de uma ficha do servidor é lida lá; a imagem vem na ficha; nada vai ao cofre daqui', async () => {
    const arquivo = doc('Ficha de atendimento GGV - Ivone Teste - 2026-10-05.pdf', { tipo: 'ficha-atendimento', origem: 'scanner', aguardaLeitura: false })
    const leitura = { modelo: 'GGV' as const, arquivo, campos: { nome: 'Ivone Teste' }, naoLidos: ['cpf' as const], senhaLida: false }
    const fetch = ligarServidor({
      ...criada,
      [`GET /api/fichas/${ID}`]: () => doBanco(),
      [`POST /api/fichas/${ID}/ficha-de-atendimento/leitura`]: () => ({ ...leitura, ficha: doBanco({ arquivos: [arquivo] }) }),
    })
    await criarFicha(ivone)
    expect(await lerFichaEmPapel(ID)).toEqual(leitura)
    expect(fetch.mock.calls.at(-1)![0]).toBe(`/api/fichas/${ID}/ficha-de-atendimento/leitura`)
    const aqui = ler().fichas.find((f) => f.id === ID)
    expect(aqui?.arquivos).toEqual([arquivo])
    expect(aqui?.senhaGov.situacao).toBe('sem-senha')
  })
})

describe('GGVP-125 · bloco 5b: a chegada, a leitura e o arquivo dos documentos no servidor', () => {
  const lida = (arquivo: string, extra: Partial<DocumentoLido> = {}): DocumentoLido => ({
    id: `${ID}/${arquivo}`,
    fichaId: ID,
    arquivo,
    origem: 'card',
    tipo: 'rg',
    data: '2026-10-05',
    confianca: 90,
    lidos: { nome: 'Ivone Teste' },
    situacao: 'a-conferir',
    lidoEm: '2026-10-05T17:40:00.000Z',
    ...extra,
  })
  const rg = { nome: 'RG.pdf', tipo: 'rg', local: 'pessoais', data: '2026-10-05', origem: 'card' as const, repetido: false, aguardaLeitura: true }
  const sincronizar = (rotas: Record<string, (corpo: unknown) => unknown>, ficha: Ficha, leituras: DocumentoLido[], tarefas: TarefaEncaminhada[] = []) =>
    ligarServidor({ 'GET /api/recepcao': () => ({ fichas: [ficha], tarefas, internos: [], gravacoes: [], contratos: [], leituras }), ...rotas })

  it('as leituras vêm na cópia e dão "Conferir documento"; a ficha do servidor não é lida aqui', async () => {
    sincronizar({}, doBanco({ arquivos: [rg] }), [lida('RG.pdf')])
    await sincronizarRecepcao()
    expect(tarefasDeConferirDocumento().find((t) => t.cliente?.id === ID)).toMatchObject({ acao: 'Conferir documento', href: `/clientes/${ID}/conferir-documentos` })
    expect(ler().leituras?.some((l) => l.fichaId === ID)).toBe(false)
  })

  it('card: sem pasta e sem CPF, para aqui; com CPF, os arquivos vão ao servidor e a leitura vem de lá', async () => {
    const envio = { origem: 'card' as const, arquivos: [{ nome: 'RG.pdf', formato: 'pdf' as const, tamanho: 1000, tipo: 'rg', hash: 'a'.repeat(64) }] }
    const fetch = sincronizar(
      { [`POST /api/fichas/${ID}/arquivos`]: () => ({ resultado: 'enviado', arquivos: [rg], laudoNovo: false, ficha: doBanco({ cpf: '52998224725', arquivos: [rg] }), tarefas: [], leituras: [lida('RG.pdf')] }) },
      doBanco(),
      [],
    )
    await sincronizarRecepcao()
    expect(await enviarArquivos(ID, envio)).toEqual({ resultado: 'sem-pasta' })
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/arquivos'))).toBe(false)

    mexerAqui((f) => (f.cpf = '52998224725'))
    expect(await enviarArquivos(ID, envio)).toEqual({ resultado: 'enviado', arquivos: [rg], laudoNovo: false })
    expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual(envio)
    expect(ler().leiturasDoServidor).toEqual([lida('RG.pdf')])
  })

  it('arquivar vai ao servidor: a cópia recebe a ficha, as leituras e os contratos', async () => {
    const arquivado = lida('RG.pdf', { situacao: 'arquivado', arquivadoEm: '2026-10-05T18:00:00.000Z' })
    const fetch = sincronizar(
      {
        [`POST /api/fichas/${ID}/documentos-lidos/arquivar`]: () => ({
          arquivados: 1,
          descartados: 0,
          contrato: false,
          evento: naHora('2026-10-05T18:00:00.000Z', 'Arquivou 1 documento lidos pela IA (RG); conferiu a leitura'),
          ficha: doBanco({ arquivos: [{ ...rg, aguardaLeitura: false }] }),
          leituras: [arquivado],
          contratos: [],
        }),
      },
      doBanco({ arquivos: [rg] }),
      [lida('RG.pdf')],
    )
    await sincronizarRecepcao()
    const pedido = { conferi: true as const, documentos: [{ id: `${ID}/RG.pdf`, tipo: 'rg', data: '2026-10-05' }] }
    expect((await arquivarDocumentos(ID, pedido)).arquivados).toBe(1)
    expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual(pedido)
    expect(ler().leiturasDoServidor).toEqual([arquivado])
    expect(ler().fichas.find((f) => f.id === ID)?.arquivos).toEqual([{ ...rg, aguardaLeitura: false }])
    expect(tarefasDeConferirDocumento().some((t) => t.cliente?.id === ID)).toBe(false)
  })

  it('mover para a ficha de outra pessoa: o arquivo sai da pasta daqui também, e a leitura fica "movido"', async () => {
    const cnis = { ...rg, nome: 'CNIS.pdf', tipo: 'cnis' }
    const movido = lida('CNIS.pdf', { tipo: 'cnis', situacao: 'movido' })
    const fetch = sincronizar(
      {
        [`POST /api/documentos-lidos/${encodeURIComponent(`${ID}/CNIS.pdf`)}/mover`]: () => ({
          evento: naHora('2026-10-05T18:00:00.000Z', 'Moveu o CNIS para o caso LOAS Idoso de Marta. Motivo: é da Marta'),
          ficha: doBanco(),
          destino: { ...doBanco(), id: OUTRO, nome: 'Marta Lima', arquivos: [cnis] },
          saiu: cnis,
          leituras: [movido],
        }),
      },
      doBanco({ arquivos: [cnis] }),
      [lida('CNIS.pdf', { tipo: 'cnis' })],
    )
    await sincronizarRecepcao()
    await moverDocumento(`${ID}/CNIS.pdf`, { processoId: 'caso-da-marta', motivo: 'é da Marta' })
    expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual({ processoId: 'caso-da-marta', motivo: 'é da Marta' })
    expect(ler().fichas.find((f) => f.id === ID)?.arquivos).toEqual([])
    expect(ler().fichas.find((f) => f.id === OUTRO)?.arquivos).toEqual([cnis])
    expect(ler().leiturasDoServidor).toEqual([movido])
  })

  it('o lote e o registro da tarefa "Receber documento" de uma ficha do servidor vão ao servidor', async () => {
    const tarefa: TarefaEncaminhada = {
      id: 'balcao-1',
      codigo: 'D1.02',
      cliente: { id: ID, nome: 'Ivone Teste' },
      acao: 'Receber documento',
      detalhe: 'sem caso em andamento',
      prazo: 'agora',
      href: '/balcao/documento/balcao-1',
      setor: 'Documentação · ADM',
    }
    const lote = { loteId: 'lote-1', status: 'arquivado' as const, motivo: 'nome igual', fichaId: ID, conferirPapel: false, arquivos: [{ nome: 'CNIS.pdf', tipo: 'cnis', paginas: 3 }] }
    const fetch = sincronizar(
      {
        'POST /api/tarefas/balcao-1/lote': () => ({ lote, ficha: doBanco(), tarefas: [{ ...tarefa, lote }], leituras: [] }),
        'POST /api/tarefas/balcao-1/registro': () => ({ evento: naHora('2026-10-05T18:00:00.000Z', 'Registrou o recebimento'), ficha: doBanco(), tarefas: [{ ...tarefa, lote, concluida: true }] }),
      },
      doBanco(),
      [],
      [tarefa],
    )
    await sincronizarRecepcao()
    expect(await receberLote('balcao-1')).toEqual(lote)
    await registrarRecebimento('balcao-1', { forma: 'papel', conferiTipos: true, conferiPapel: false })
    expect(corpoDa(fetch, fetch.mock.calls.length - 1)).toEqual({ forma: 'papel', conferiTipos: true, conferiPapel: false })
    expect(ler().tarefas.find((t) => t.id === 'balcao-1')?.concluida).toBe(true)
  })
})
