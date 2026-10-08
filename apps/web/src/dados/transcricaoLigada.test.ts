// GGVP-133: o áudio de verdade vai ao servidor, pelas rotas que já existem da entrevista. O servidor aqui é de mentira:
// responde pela rota e guarda o formulário recebido; a transcrição tem os testes dela, na API.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enviarAudioGuardado, enviarParteDoAudio, pedirChaveAoVivo, subirAudio } from './entrevista.ts'
import { configurarExemplo, zerarExemplo } from './servidor.ts'
import type { Gravacao } from './tipos.ts'

const ID = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
const GRAVACAO = `gravacao-${ID}`
const AGENDAMENTO = `${ID}-ag-1`
const gravacao = (extra: Partial<Gravacao> = {}): Gravacao => ({
  id: GRAVACAO,
  fichaId: ID,
  agendamentoId: AGENDAMENTO,
  data: '2026-10-08',
  titulo: 'Entrevista com a advogada',
  canal: 'telefone',
  participantes: ['Dra. Paula', 'Ivone Teste'],
  duracao: 0,
  origem: 'arquivo',
  estado: 'encerrada',
  acoes: [],
  transcricao: 'transcrevendo',
  trechos: [],
  extraidas: [],
  documentos: [],
  soJuridico: true,
  marcas: [],
  ...extra,
})

type Recebido = { rota: string; corpo: FormData | undefined }
function ligarServidor(respostas: Record<string, { status?: number; corpo: unknown }>) {
  const recebidos: Recebido[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const rota = `${init?.method ?? 'GET'} ${url}`
      recebidos.push({ rota, corpo: init?.body instanceof FormData ? init.body : undefined })
      const r = respostas[rota] ?? { status: 404, corpo: { erro: 'Não encontrado.' } }
      return new Response(JSON.stringify(r.corpo), { status: r.status ?? 200 })
    }),
  )
  configurarExemplo({ servidor: true })
  return recebidos
}
const campos = (f: FormData) => Object.fromEntries([...f.entries()].map(([k, v]) => [k, v instanceof File ? `${v.name} (${v.size} B)` : v]))

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 8, 14, 0), latencia: 0 })
  zerarExemplo()
})
afterEach(() => {
  configurarExemplo({ servidor: false })
  vi.unstubAllGlobals()
})

describe('GGVP-133 · o áudio de verdade vai ao servidor', () => {
  it('CA2 · a ligação baixada do Chatwoot sobe como arquivo, na rota que já existe', async () => {
    const recebidos = ligarServidor({ [`POST /api/entrevistas/${AGENDAMENTO}/audio`]: { corpo: { gravacao: gravacao() } } })
    const arquivo = new File(['OggS'], 'ligacao.ogg', { type: 'audio/ogg' })
    const r = await subirAudio(AGENDAMENTO, { nome: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size }, arquivo)
    expect(r.gravacao.id).toBe(GRAVACAO)
    expect(recebidos.map((x) => x.rota)).toEqual([`POST /api/entrevistas/${AGENDAMENTO}/audio`])
    expect(campos(recebidos[0].corpo!)).toEqual({ arquivo: 'ligacao.ogg (4 B)' })
  })

  it('CA1, CA10 · cada parte do microfone sobe com onde começa; sem internet, as partes guardadas sobem depois e a última manda para a transcrição', async () => {
    const recebidos = ligarServidor({ [`POST /api/gravacoes/${GRAVACAO}/audio`]: { corpo: { gravacao: gravacao({ origem: 'portal' }) } } })
    await enviarParteDoAudio(GRAVACAO, { audio: new Blob(['um'], { type: 'audio/webm;codecs=opus' }), inicio: 0 })
    await enviarAudioGuardado(GRAVACAO, [
      { audio: new Blob(['dois'], { type: 'audio/webm' }), inicio: 600 },
      { audio: new Blob(['três'], { type: 'audio/ogg' }), inicio: 1200.4 },
    ])
    expect(recebidos.map((x) => campos(x.corpo!))).toEqual([
      { inicio: '0', arquivo: 'parte-0.webm (2 B)' },
      { inicio: '600', arquivo: 'parte-600.webm (4 B)' },
      { inicio: '1200', ultima: 'sim', arquivo: 'parte-1200.ogg (5 B)' },
    ])
  })

  it('CA4 · a chave temporária vem do servidor; sem ela, a tela recebe o motivo', async () => {
    ligarServidor({ [`POST /api/gravacoes/${GRAVACAO}/chave-ao-vivo`]: { corpo: { chave: 'ek_temporaria', expiraEm: '2026-10-08T17:10:00.000Z', modelo: 'gpt-4o-transcribe' } } })
    expect(await pedirChaveAoVivo(GRAVACAO)).toMatchObject({ chave: 'ek_temporaria' })
    ligarServidor({ [`POST /api/gravacoes/${GRAVACAO}/chave-ao-vivo`]: { status: 503, corpo: { erro: 'O texto ao vivo não está disponível agora.' } } })
    expect(await pedirChaveAoVivo(GRAVACAO)).toEqual({ erro: 'O texto ao vivo não está disponível agora.' })
  })
})
