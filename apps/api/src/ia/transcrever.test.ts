import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { chamadaIa, usuario } from '../banco/esquema.ts'
import { criarIa } from './ia.ts'

// GGVP-133: a terceira porta do motor (transcrever) e a chave temporária do texto ao vivo, sempre com serviço falso.
let banco: Banco
let fechar: () => Promise<void>
let quem: string
const CHAVES = { OPENAI_API_KEY: 'chave-de-teste-openai', IA_PERMITE_DADO_DE_SAUDE: 'sim' }
const AUDIO = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
const PEDIDO = { casoId: null, audio: AUDIO, mime: 'audio/webm', nome: 'entrevista.webm', sensivel: true, referencia: 'documento:audio-1' }
const DIARIZADO = {
  text: 'Bom dia. Bom dia, doutora.',
  usage: { type: 'duration', seconds: 120 },
  segments: [
    { type: 'transcript.text.segment', id: 'seg_0', speaker: 'A', start: 0.4, end: 2.1, text: ' Bom dia.' },
    { type: 'transcript.text.segment', id: 'seg_1', speaker: 'B', start: 2.5, end: 4, text: 'Bom dia, doutora.' },
  ],
}
const servico = (resposta: object, status = 200) => vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify(resposta), { status }))

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  const [u] = await banco.insert(usuario).values({ email: 'gabi@exemplo.ggv', nome: 'gabi', senhaHash: 'x', perfis: ['advogada'] }).returning()
  quem = u.id
})
afterEach(() => fechar())

describe('GGVP-133 · transcrever (OpenAI)', () => {
  it('CA1, CA3, CA9 · transcreve pelo servidor, com quem fala; registra o modelo, a duração e o custo, só com o tamanho e o hash do áudio', async () => {
    const fetch = servico(DIARIZADO)
    const r = await criarIa({ banco, ambiente: CHAVES, fetch }).transcrever({ ...PEDIDO, quem })
    expect(r?.falas).toEqual([
      { falante: 'A', inicio: 0.4, fim: 2.1, texto: 'Bom dia.' },
      { falante: 'B', inicio: 2.5, fim: 4, texto: 'Bom dia, doutora.' },
    ])
    const [url, init] = fetch.mock.calls[0]
    const corpo = init?.body as FormData
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions')
    expect([corpo.get('model'), corpo.get('response_format'), corpo.get('chunking_strategy'), corpo.get('language')]).toEqual(['gpt-4o-transcribe-diarize', 'diarized_json', 'auto', 'pt'])
    expect((corpo.get('file') as File).size).toBe(AUDIO.length)
    expect((init!.headers as Record<string, string>).authorization).toBe('Bearer chave-de-teste-openai')
    const [c] = await banco.select().from(chamadaIa)
    expect([c.id, c.finalidade, c.fornecedor, c.modelo, c.situacao, c.pedidaPor, c.entradaTamanho, c.audioSegundos, c.custoEstimado]).toEqual([
      r?.chamadaId, 'transcrever_audio', 'openai', 'gpt-4o-transcribe-diarize', 'ok', quem, AUDIO.length, 120, '0.0120',
    ])
    expect(c.entradaHash).toMatch(/^[0-9a-f]{64}$/)
    expect(c.fontes).toEqual([{ tipo: 'documento', referencia: 'documento:audio-1' }])
  })

  it('CA11 · o modelo vem da variável de ambiente, e o custo segue o preço dele', async () => {
    const fetch = servico(DIARIZADO)
    await criarIa({ banco, ambiente: { ...CHAVES, OPENAI_MODELO_TRANSCRICAO: 'gpt-4o-mini-transcribe' }, fetch }).transcrever({ ...PEDIDO, quem })
    expect((fetch.mock.calls[0][1]!.body as FormData).get('model')).toBe('gpt-4o-mini-transcribe')
    const [c] = await banco.select().from(chamadaIa)
    expect([c.modelo, c.custoEstimado]).toEqual(['gpt-4o-mini-transcribe', '0.0060'])
  })

  it('sem chave, desliga; áudio com dado de saúde sem autorização, recusa; os dois sem chamar o serviço', async () => {
    const fetch = servico(DIARIZADO)
    expect(await criarIa({ banco, ambiente: { IA_PERMITE_DADO_DE_SAUDE: 'sim' }, fetch }).transcrever({ ...PEDIDO, quem })).toBeNull()
    expect(await criarIa({ banco, ambiente: { OPENAI_API_KEY: 'x' }, fetch }).transcrever({ ...PEDIDO, quem })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect((await banco.select().from(chamadaIa)).map((c) => c.situacao).sort()).toEqual(['desligada', 'recusada'])
  })

  it('CA8 · o serviço falha: nulo e o registro diz o status, sem a chave', async () => {
    const r = await criarIa({ banco, ambiente: CHAVES, fetch: servico({ error: 'x' }, 500) }).transcrever({ ...PEDIDO, quem })
    expect(r).toBeNull()
    const [c] = await banco.select().from(chamadaIa)
    expect([c.situacao, c.erro]).toEqual(['falhou', 'OpenAI respondeu 500'])
  })
})

describe('GGVP-133 CA4 · a chave temporária do texto ao vivo', () => {
  const AO_VIVO = { casoId: null, termos: ['LOAS', 'CNIS'], sensivel: true, referencia: 'gravacao:g1' }

  it('o servidor pede a chave temporária com a chave dele; a resposta só traz a temporária, com os termos do glossário de dica; a entrega fica no registro, sem a chave', async () => {
    const fetch = servico({ value: 'ek_temporaria', expires_at: 1791500000 })
    const r = await criarIa({ banco, ambiente: CHAVES, fetch }).chaveAoVivo({ ...AO_VIVO, quem })
    expect(r).toEqual({ chave: 'ek_temporaria', expiraEm: new Date(1791500000 * 1000).toISOString(), modelo: 'gpt-4o-transcribe' })
    expect(JSON.stringify(r)).not.toContain('chave-de-teste-openai')
    const [url, init] = fetch.mock.calls[0]
    const corpo = JSON.parse(String(init?.body))
    expect(url).toBe('https://api.openai.com/v1/realtime/client_secrets')
    expect(corpo.session.type).toBe('transcription')
    expect(corpo.session.audio.input.transcription).toEqual({ model: 'gpt-4o-transcribe', language: 'pt', prompt: 'LOAS, CNIS' })
    const [c] = await banco.select().from(chamadaIa)
    expect([c.finalidade, c.situacao, c.pedidaPor, c.saida]).toEqual(['transcrever_ao_vivo', 'ok', quem, null])
    expect(JSON.stringify(c)).not.toContain('ek_temporaria')
  })

  it('gravação com dado de saúde sem a autorização do escritório: recusa, sem chamar o serviço', async () => {
    const fetch = servico({ value: 'ek_temporaria', expires_at: 1791500000 })
    expect(await criarIa({ banco, ambiente: { OPENAI_API_KEY: 'x' }, fetch }).chaveAoVivo({ ...AO_VIVO, quem })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect((await banco.select().from(chamadaIa)).map((c) => [c.finalidade, c.situacao])).toEqual([['transcrever_ao_vivo', 'recusada']])
  })

  it('sem chave, ou com o serviço fora, não há texto ao vivo', async () => {
    const fetch = servico({}, 500)
    expect(await criarIa({ banco, ambiente: { IA_PERMITE_DADO_DE_SAUDE: 'sim' }, fetch }).chaveAoVivo({ ...AO_VIVO, quem })).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    expect(await criarIa({ banco, ambiente: CHAVES, fetch }).chaveAoVivo({ ...AO_VIVO, quem })).toBeNull()
    expect((await banco.select().from(chamadaIa)).map((c) => c.situacao).sort()).toEqual(['desligada', 'falhou'])
  })
})
