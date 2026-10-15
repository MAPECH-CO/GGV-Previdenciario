import { afterEach, describe, expect, it, vi } from 'vitest'
import { MSG_SEM_RESPOSTA, baixarApi, chamarApi } from './api.ts'

// GGVP-158 I20: sem resposta do servidor (a rede caiu, o servidor está fora), a tela recebe o erro, e não fica muda.
afterEach(() => vi.unstubAllGlobals())

describe('GGVP-158 I20 · a chamada ao servidor sem resposta', () => {
  it('a rede que cai vira erro com a mensagem de que o servidor não respondeu, na chamada e no download', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    expect(await chamarApi('/vigilia')).toEqual({ ok: false, status: 0, erro: MSG_SEM_RESPOSTA })
    expect(await chamarApi('/vigilia/rodadas/x/reprocessar', { method: 'POST' })).toEqual({ ok: false, status: 0, erro: MSG_SEM_RESPOSTA })
    expect(await baixarApi('/processos/x/contrato/kit')).toEqual({ ok: false, status: 0, erro: MSG_SEM_RESPOSTA })
  })

  it('com resposta, segue como antes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ erro: 'Não encontrado.' }), { status: 404 })))
    expect(await chamarApi('/vigilia')).toEqual({ ok: false, status: 404, erro: 'Não encontrado.' })
  })
})
