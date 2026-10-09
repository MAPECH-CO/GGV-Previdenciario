// GGVP-132: a documentação médica no servidor de verdade, em modo misto. O servidor aqui é de mentira: responde pela rota,
// como o de verdade. Confere o lado da tela: o caso do servidor vai à API (com o corpo do contrato, sem quem: quem é vem da
// sessão), o da semente fica aqui, e a sincronização leva as tarefas às Centrais e o parecer ao portão. As regras do
// servidor têm os testes dele, na API.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { salvarAcidente } from './acidente.ts'
import { decidirComplemento, obterComplemento, registrarTentativaDoComplemento, tarefasDeComplemento, tarefasDeDecidirComplemento } from './complemento.ts'
import { salvarDeficiencia } from './deficiencia.ts'
import { salvarCrianca } from './infantil.ts'
import { obterParecer, parecerParaOPortao, pedirDispensa, registrarParecer, sincronizarDocumentacaoMedica, tarefasDoParecer } from './parecer.ts'
import { obterRoteiro, obterRoteiros, salvarRoteiro } from './roteiro.ts'
import { configurarExemplo, ler, zerarExemplo } from './servidor.ts'
import type { Ficha, Tarefa } from './tipos.ts'

const AGORA = new Date(2026, 9, 8, 14, 0)
const CASO = '9b1c2d3e-4f50-4a6b-8c7d-0e1f2a3b4c5d'
const PESSOA = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5e'
const ADVOGADA = { perfil: 'advogada', nome: 'Gabi' }

/** Liga o modo misto com um servidor de mentira: cada rota ("MÉTODO /api/...") responde [status, corpo] ou o corpo. */
function ligarServidor(rotas: Record<string, (corpo: unknown) => unknown>) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const responder = rotas[`${init?.method ?? 'GET'} ${url}`]
    if (!responder) return new Response(JSON.stringify({ erro: 'Não encontrado.' }), { status: 404 })
    const r = responder(init?.body ? JSON.parse(String(init.body)) : undefined)
    const [status, corpo] = Array.isArray(r) && typeof r[0] === 'number' ? r : [200, r]
    return new Response(JSON.stringify(corpo), { status })
  })
  vi.stubGlobal('fetch', fetch)
  configurarExemplo({ servidor: true })
  return fetch
}
const corpoDa = (fetch: ReturnType<typeof ligarServidor>, i: number) => JSON.parse(String(fetch.mock.calls[i][1]?.body))
const chamadas = (fetch: ReturnType<typeof ligarServidor>) => fetch.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${url}`)

const fichaDoBanco = (): Ficha => ({
  id: PESSOA,
  situacao: 'cliente',
  desde: '09/2026',
  nome: 'Lúcia Prado',
  telefone: '11955550101',
  senhaGov: { situacao: 'sem-senha' },
  fichaAtendimentoPreenchida: false,
  processos: [{ id: CASO, beneficio: 'loas-deficiente', etapa: 'Atendimento' }],
  agendamentos: [],
  contatos: [],
  documentos: [],
  arquivos: [],
  transcricoes: 0,
  historico: [],
})
const tarefa = (id: string, acao: string): Tarefa => ({ id, codigo: 'D1.21M', cliente: { id: PESSOA, nome: 'Lúcia Prado' }, acao, detalhe: 'BPC/LOAS Deficiente', prazo: 'hoje', href: `/casos/${CASO}/parecer`, processoId: CASO })

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
})
afterEach(() => {
  configurarExemplo({ servidor: false })
  vi.unstubAllGlobals()
})

describe('GGVP-132 · o parecer no modo misto', () => {
  it('CA1 · o caso do servidor abre e registra pela API; o corpo é o do contrato, sem quem registra', async () => {
    const naTela = { ficha: { id: PESSOA, nome: 'Lúcia Prado' }, situacao: 'pendente' }
    const fetch = ligarServidor({
      [`GET /api/processos/${CASO}/parecer`]: () => naTela,
      [`POST /api/processos/${CASO}/parecer`]: () => [201, { ...naTela, situacao: 'insuficiente' }],
    })
    expect(await obterParecer(CASO, 'juridico')).toEqual(naTela)
    const pedido = { analise: '2026-10-08T17:00:00.000Z', conferidos: { natureza: 'ausente' as const }, decisao: 'insuficiente' as const, abordar: 'Qual a natureza do impedimento?' }
    expect((await registrarParecer(CASO, pedido, ADVOGADA)).situacao).toBe('insuficiente')
    expect(chamadas(fetch)).toEqual([`GET /api/processos/${CASO}/parecer`, `POST /api/processos/${CASO}/parecer`])
    expect(corpoDa(fetch, 1)).toEqual(pedido)
  })

  it('o caso da semente continua aqui: nada vai ao servidor', async () => {
    const fetch = ligarServidor({})
    expect((await obterParecer('sebastiao-exemplo-1', 'juridico'))?.situacao).toBe('suficiente')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('a recusa do servidor chega à tela com o motivo dele (G17), e o caso que não existe lá abre como "não encontrado"', async () => {
    const motivo = 'Uma pessoa sozinha não dispensa o parecer: a segunda aprovação é de outra sênior (G17).'
    const fetch = ligarServidor({ [`POST /api/processos/${CASO}/parecer/dispensa`]: () => [409, { erro: motivo }] })
    await expect(pedirDispensa(CASO, 'Caso urgente, com prazo do INSS.', { perfil: 'senior', nome: 'Helena' })).rejects.toThrow(motivo)
    expect(corpoDa(fetch, 0)).toEqual({ justificativa: 'Caso urgente, com prazo do INSS.' })
    expect(await obterParecer('2f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b', 'juridico')).toBeNull()
  })
})

describe('GGVP-132 · a sincronização da documentação médica', () => {
  it('as tarefas do servidor vão às Centrais, a ficha vem para a cópia e o portão (G17) recebe o parecer do caso', async () => {
    ligarServidor({
      'GET /api/documentacao-medica': () => ({
        fichas: [fichaDoBanco()],
        tarefas: [tarefa(`parecer-${CASO}`, 'Dar parecer médico'), tarefa(`complemento-${CASO}`, 'Pedir complemento ao médico'), tarefa(`decidir-complemento-${CASO}`, 'Decidir complemento')],
        portoes: { [CASO]: { situacao: 'insuficiente', quem: 'Gabi', data: '2026-10-08' } },
      }),
    })
    await sincronizarDocumentacaoMedica()
    const banco = ler()
    expect(banco.fichas.find((f) => f.id === PESSOA)?.nome).toBe('Lúcia Prado')
    expect(tarefasDoParecer().filter((t) => t.processoId === CASO).map((t) => t.acao)).toEqual(['Dar parecer médico'])
    expect(tarefasDeComplemento().filter((t) => t.processoId === CASO).map((t) => t.acao)).toEqual(['Pedir complemento ao médico'])
    expect(tarefasDeDecidirComplemento().map((t) => t.acao)).toEqual(['Decidir complemento'])
    expect(parecerParaOPortao(ler(), CASO)).toEqual({ situacao: 'insuficiente', quem: 'Gabi', data: '2026-10-08' })
    // O caso do servidor não ganha parecer de exemplo aqui.
    expect(ler().pareceres?.some((p) => p.processoId === CASO)).toBe(false)
  })

  it('sem o modo misto, não chama o servidor', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await sincronizarDocumentacaoMedica()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('GGVP-132 · as outras telas da documentação médica no modo misto', () => {
  it('o roteiro é o do servidor para todo o escritório; a versão nova vai com os itens, e o autor sai da sessão', async () => {
    const roteiro = { id: 'loas-deficiente', nome: 'BPC/LOAS Deficiente', beneficios: ['loas-deficiente'], laudo: true, versoes: [] }
    const fetch = ligarServidor({
      'GET /api/roteiros': () => [roteiro],
      'GET /api/roteiros/loas-deficiente': () => roteiro,
      'POST /api/roteiros/loas-deficiente/versoes': () => [201, roteiro],
    })
    expect(await obterRoteiros()).toEqual([roteiro])
    expect(await obterRoteiro('loas-deficiente')).toEqual(roteiro)
    expect(await obterRoteiro('outro')).toBeNull()
    const itens = [{ id: 'natureza', tipo: 'obrigatorio' as const, texto: 'Natureza do impedimento' }]
    await salvarRoteiro('loas-deficiente', itens, { perfil: 'senior', nome: 'Helena' })
    expect(corpoDa(fetch, 3)).toEqual({ itens })
  })

  it('o complemento: abrir, tentar e decidir vão à API; sem complemento no servidor, a tela recebe null', async () => {
    const tela = { situacao: 'aberto', tentativa: 1 }
    const fetch = ligarServidor({
      [`POST /api/processos/${CASO}/complemento/tentativas`]: () => [201, { ...tela, tentativa: 2 }],
      [`POST /api/processos/${CASO}/complemento/decisoes`]: () => [201, tela],
    })
    expect(await obterComplemento(CASO)).toBeNull()
    expect((await registrarTentativaDoComplemento(CASO, { canal: 'ligacao', resultado: 'sem-resposta' })).tentativa).toBe(2)
    await decidirComplemento(CASO, { justificativa: 'Mais uma chance', prazo: '2026-10-20' }, { perfil: 'senior', nome: 'Helena' })
    expect([corpoDa(fetch, 1), corpoDa(fetch, 2)]).toEqual([
      { canal: 'ligacao', resultado: 'sem-resposta' },
      { justificativa: 'Mais uma chance', prazo: '2026-10-20' },
    ])
  })

  it('a deficiência, o acidente e a criança gravam no servidor com o corpo do contrato', async () => {
    const fetch = ligarServidor({
      [`PUT /api/processos/${CASO}/deficiencia`]: () => ({}),
      [`PUT /api/processos/${CASO}/acidente`]: () => ({}),
      [`PUT /api/processos/${CASO}/crianca`]: () => ({}),
    })
    const deficiencia = { inicio: '2014-06-10', grau: 'leve' as const, agravamentos: [], sexo: 'feminino' as const }
    const acidente = { circunstancia: 'trabalho' as const, categoria: 'empregado' as const, acidenteEm: '2024-03-15', auxilioAnterior: false, recusados: [] }
    const crianca = { condicoes: ['neurologica' as const], terapias: [], escola: true }
    await salvarDeficiencia(CASO, deficiencia, ADVOGADA)
    await salvarAcidente(CASO, acidente, ADVOGADA)
    await salvarCrianca(CASO, crianca, ADVOGADA)
    expect([0, 1, 2].map((i) => corpoDa(fetch, i))).toEqual([deficiencia, acidente, crianca])
  })
})
