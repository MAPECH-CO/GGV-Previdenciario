// GGVP-137: as telas da Perícia no servidor de verdade. O servidor aqui é de mentira: responde pela rota, como o de verdade
// (apps/api/src/rotas/pericia.ts), e a conferência é do lado da tela: a função chama a rota certa com o contrato, a cópia
// daqui recebe a perícia, as Centrais mostram as tarefas do servidor e a semente não nasce. As regras do servidor têm os
// testes dele, na API.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarPericia, naTela, type PericiaNaTela } from '../regras/periciaNoCaso.ts'
import { eventosDasPericias, etapaDaPericia, obterPericia, peritosParaLigar, registrarMarcacao, registrarTentativa, sincronizarPericias, tarefasDaDocumentacaoNaPericia, tarefasDoJuridicoAdm } from './pericia.ts'
import { configurarExemplo, ler, zerarExemplo } from './servidor.ts'
import type { Ficha, Tarefa } from './tipos.ts'

const AGORA = new Date(2026, 9, 8, 10, 0)
const CASO = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
const PESSOA = '7a2d3c4b-5e6f-4a70-9b8c-1d2e3f4a5b6c'
const PERICIA = '8b3e4d5c-6f70-4b81-8c9d-2e3f4a5b6c7d'

/** A perícia como a API devolve: a mesma regra das telas sobre a ficha mínima do servidor. */
function daApi(): PericiaNaTela {
  const ficha: Ficha = {
    id: PESSOA,
    situacao: 'cliente',
    desde: '10/2026',
    nome: 'Ivone Teste',
    telefone: '11900000050',
    senhaGov: { situacao: 'sem-senha' },
    fichaAtendimentoPreenchida: false,
    processos: [{ id: CASO, beneficio: 'loas-deficiente', etapa: 'administrativa' }],
    agendamentos: [],
    contatos: [],
    documentos: [],
    transcricoes: 0,
    historico: [],
    arquivos: [],
  }
  const mundo = { fichas: [ficha], pericias: [], peritos: [] }
  const p = criarPericia(mundo, CASO, { origem: 'd2-necessidade', tipo: 'medica', instancia: 'inss', pedidaPor: 'Gabi' }, AGORA, AGORA, PERICIA)
  return naTela(mundo, p, AGORA)
}

const MARCAR: Tarefa = { id: `pericia-marcar-${PERICIA}`, codigo: 'DP.02', cliente: { id: PESSOA, nome: 'Ivone Teste' }, acao: 'Marcar perícia', detalhe: '', href: `/casos/${CASO}/pericia/marcar` }

/** Liga o modo servidor com um servidor de mentira: cada rota ("MÉTODO /api/...") responde o que a função devolve. */
function ligarServidor(rotas: Record<string, (corpo: unknown) => unknown>) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const responder = rotas[`${init?.method ?? 'GET'} ${url}`]
    if (!responder) return new Response(JSON.stringify({ erro: 'Não encontrado.' }), { status: 404 })
    const corpo = init?.body instanceof FormData ? init.body : init?.body ? JSON.parse(String(init.body)) : undefined
    const r = responder(corpo)
    if (r instanceof Response) return r
    return new Response(JSON.stringify(r), { status: 200 })
  })
  vi.stubGlobal('fetch', fetch)
  configurarExemplo({ servidor: true })
  return fetch
}
const url = (caminho = '') => `/api/processos/${CASO}/pericia${caminho}`

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
})
afterEach(() => {
  configurarExemplo({ servidor: false })
  vi.unstubAllGlobals()
})

describe('GGVP-137 · a Perícia no servidor, do lado da tela', () => {
  it('modo misto · a perícia da semente fica aqui, sem chamar o servidor', async () => {
    const fetch = ligarServidor({})
    expect((await obterPericia('maria-exemplo-1'))?.ficha.nome).toBe('Maria Exemplo')
    expect(fetch).not.toHaveBeenCalled()
    expect(await obterPericia(CASO)).toBeNull()
    expect(fetch.mock.calls[0][0]).toBe(url())
  })

  it('CA1 · ao abrir a tela, a cópia recebe as perícias e cada Central, só as tarefas dela, vindas do servidor', async () => {
    const t = daApi()
    const fetch = ligarServidor({
      'GET /api/pericias': () => [t],
      'GET /api/pericias/tarefas': () => [MARCAR, { ...MARCAR, id: `pericia-documentos-${PERICIA}`, acao: 'Reunir documentos da perícia' }],
    })
    // Quem não é do Jurídico nem pede os peritos: nada de tentativa bloqueada no registro.
    await sincronizarPericias(false)
    expect(fetch.mock.calls.map((c) => c[0])).not.toContain('/api/peritos')
    // A Central junta as da semente e as do servidor; cada uma só com as dela.
    expect(tarefasDoJuridicoAdm().map((x) => x.id)).toContain(MARCAR.id)
    expect(tarefasDoJuridicoAdm().map((x) => x.id)).not.toContain(`pericia-documentos-${PERICIA}`)
    expect(tarefasDaDocumentacaoNaPericia().map((x) => x.id)).toContain(`pericia-documentos-${PERICIA}`)
    // A cópia tem a perícia e a ficha: a etapa do caso e a agenda leem dela.
    expect(etapaDaPericia(CASO)).toBe(t.etapa)
    expect(eventosDasPericias(ler(), '2026-10-08').map((e) => e.processoId)).not.toContain(CASO)
    // Sem os peritos (não é do Jurídico), a lista fica vazia.
    expect(peritosParaLigar('medica', CASO)).toEqual([])
  })

  it('CA1, CA2 · a tentativa vai à rota com o contrato e a tela recebe a perícia que o servidor gravou', async () => {
    const t = daApi()
    const gravada = { ...t, pericia: { ...t.pericia, tentativas: [{ dia: '2026-10-08', oQueAconteceu: 'Sem vaga hoje', quem: 'Igor', quando: AGORA.toISOString() }] } }
    const fetch = ligarServidor({ [`POST ${url('/tentativas')}`]: () => gravada })
    const r = await registrarTentativa(CASO, { dia: '2026-10-08', oQueAconteceu: 'Sem vaga hoje' }, 'ignorado: o servidor usa a sessão')
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toEqual({ dia: '2026-10-08', oQueAconteceu: 'Sem vaga hoje' })
    expect(r.pericia.tentativas).toHaveLength(1)
    expect(ler().pericias!.find((p) => p.id === PERICIA)!.tentativas).toHaveLength(1)
  })

  it('CA1 · a marcação sobe o PDF de verdade, em multipart; sem o PDF, nem chama o servidor', async () => {
    let enviado: FormData | undefined
    const fetch = ligarServidor({
      [`POST ${url('/marcacao')}`]: (corpo) => {
        enviado = corpo as FormData
        return daApi()
      },
    })
    const lido = { data: '2026-10-22', hora: '08:30', local: 'Agência INSS', modalidade: 'presencial', tipo: 'medica' as const }
    await expect(registrarMarcacao(CASO, { comprovante: { nome: 'comprovante.pdf' }, lido, pedeDocumentoNovo: false }, 'Igor')).rejects.toThrow('Anexe o PDF.')
    expect(fetch).not.toHaveBeenCalled()
    const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    await registrarMarcacao(CASO, { comprovante: { nome: 'comprovante.pdf', arquivo: pdf }, lido, pedeDocumentoNovo: true }, 'Igor')
    expect(JSON.parse(String(enviado!.get('dados')))).toEqual({ lido, pedeDocumentoNovo: true })
    expect((enviado!.get('comprovante') as File).name).toBe('comprovante.pdf')
  })

  it('CA3, CA4 · a recusa do servidor (perfil ou portão) chega à tela com a mensagem dele', async () => {
    ligarServidor({ [`POST ${url('/tentativas')}`]: () => new Response(JSON.stringify({ erro: 'Sem permissão para esta ação.' }), { status: 403 }) })
    await expect(registrarTentativa(CASO, { dia: '2026-10-08', oQueAconteceu: 'Sem vaga hoje' }, 'Ana')).rejects.toThrow('Sem permissão para esta ação.')
  })
})
