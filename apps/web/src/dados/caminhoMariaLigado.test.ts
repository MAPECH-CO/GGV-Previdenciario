import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eventosDaAgenda } from './agenda.ts'
import { obterEntrevista } from './entrevista.ts'
import { obterPreparacao } from './preparacao.ts'
import { configurarExemplo, gravar, zerarExemplo } from './servidor.ts'
import { bancoInventado, ENTREVISTA_FICTICIA, fichaInventada, ID_FICTICIO } from './caminhoMaria.fixture.ts'

beforeEach(() => {
  configurarExemplo({ servidor: true, agora: () => new Date('2026-10-11T12:00:00Z'), latencia: 0 })
  zerarExemplo()
  gravar(bancoInventado([{ ...fichaInventada(), nome: 'Cópia antiga inventada' }]))
})
afterEach(() => { configurarExemplo({ servidor: false }); zerarExemplo(); vi.unstubAllGlobals() })

describe('leituras da entrevista no servidor', () => {
  it('preparação lê a ficha atual, sem depender da cópia antiga', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(fichaInventada())))
    vi.stubGlobal('fetch', fetch)
    expect((await obterPreparacao(ENTREVISTA_FICTICIA))?.ficha.nome).toBe('Pessoa Inventada no Teste')
    expect(fetch.mock.calls[0][0]).toBe('/api/fichas/' + ID_FICTICIO)
  })
  it('entrevista lê a agenda e a gravação atuais pela Recepção', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(bancoInventado([fichaInventada()]))))
    vi.stubGlobal('fetch', fetch)
    expect((await obterEntrevista(ENTREVISTA_FICTICIA))?.agendamento.id).toBe(ENTREVISTA_FICTICIA)
    expect(fetch.mock.calls[0][0]).toBe('/api/recepcao')
  })
  it('agenda atualiza as entrevistas sem reutilizar a ficha antiga', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, _init?: RequestInit) => new Response(JSON.stringify(url.endsWith('/pericias') ? [] : bancoInventado([fichaInventada()])))))
    const eventos = await eventosDaAgenda('2026-10-01', '2026-10-31')
    expect(eventos).toHaveLength(1)
    expect(eventos[0].titulo).toBe('Pessoa Inventada no Teste')
  })
  it('falha no servidor não volta à cópia local', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ erro: 'Indisponível' }), { status: 503 })))
    await expect(obterPreparacao(ENTREVISTA_FICTICIA)).rejects.toThrow('Indisponível')
    await expect(obterEntrevista(ENTREVISTA_FICTICIA)).rejects.toThrow('Indisponível')
    await expect(eventosDaAgenda('2026-10-01', '2026-10-31')).rejects.toThrow('Indisponível')
  })
})
