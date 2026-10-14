import { describe, expect, it } from 'vitest'
import { criarMonitor, olharSaude } from './monitor.ts'
import type { Alarme, Suporte } from './suporte.ts'

// GGVP-158 P9.5: o monitor do /saude, com o /saude e o suporte de mentira.
const URL = 'https://portal.exemplo.ggv'
type Resposta = { status: number; corpo: object } | 'sem resposta'
const OK: Resposta = { status: 200, corpo: { ok: true, servico: 'api', banco: 'ligado', drive: 'ligado', versao: 'abc123' } }
const BANCO_FORA: Resposta = { status: 503, corpo: { ok: false, servico: 'api', banco: 'fora-do-ar', drive: 'ligado', versao: 'abc123' } }

/** O /saude responde, na ordem, o que a lista diz; o relógio anda um minuto a cada olhada. */
function montar(respostas: Resposta[]) {
  const avisos: Alarme[] = []
  const suporte: Suporte = async (a) => {
    avisos.push(a)
    return { canal: 'enviado', jira: 'enviado' }
  }
  let minuto = 0
  const fetch = async (url: string) => {
    expect(url).toBe(`${URL}/saude`)
    minuto++
    const r = respostas.shift()!
    if (r === 'sem resposta') throw new Error('fetch failed')
    return new Response(JSON.stringify(r.corpo), { status: r.status })
  }
  const olhar = criarMonitor({ url: URL, suporte, fetch, agora: () => new Date(Date.UTC(2026, 9, 14, 12, minuto)) })
  return { avisos, olhar }
}

describe('GGVP-158 P9.5 · o monitor do /saude', () => {
  it('o /saude: 200 com "ok" é bom; outro status, o banco fora ou sem resposta é falha, com o motivo', async () => {
    const um = (r: Resposta) => olharSaude(URL, async () => (r === 'sem resposta' ? Promise.reject(new Error('x')) : new Response(JSON.stringify(r.corpo), { status: r.status })))
    expect(await um(OK)).toBeNull()
    expect(await um(BANCO_FORA)).toBe('respondeu 503, com o banco fora do ar')
    expect(await um({ status: 502, corpo: {} })).toBe('respondeu 502')
    expect(await um({ status: 200, corpo: { ok: false } })).toBe('respondeu sem "ok"')
    expect(await um('sem resposta')).toBe('não respondeu em até 10 segundos')
  })

  it('uma falha só, como no deploy, não avisa', async () => {
    const { avisos, olhar } = montar(['sem resposta', OK, OK])
    for (let i = 0; i < 3; i++) await olhar()
    expect(avisos).toEqual([])
  })

  it('duas falhas seguidas avisam a queda com o motivo, uma vez; a volta avisa o tempo fora; depois, uma falha só não avisa', async () => {
    const { avisos, olhar } = montar(['sem resposta', BANCO_FORA, BANCO_FORA, BANCO_FORA, OK, 'sem resposta', OK])
    const olhadas = []
    for (let i = 0; i < 7; i++) olhadas.push(await olhar())
    expect(olhadas.map((o) => o.aviso)).toEqual([null, 'caiu', null, null, 'voltou', null, null])
    expect(olhadas[1].entregas).toEqual({ canal: 'enviado', jira: 'enviado' })
    expect(avisos).toEqual([
      { titulo: 'O portal caiu', texto: `${URL}: o /saude respondeu 503, com o banco fora do ar.` },
      { titulo: 'O portal voltou', texto: `${URL} voltou a responder depois de 4 min fora do ar.` },
    ])
    // Só o endereço, o motivo e o tempo: nada do que o /saude devolve além disso.
    expect(JSON.stringify(avisos)).not.toContain('abc123')
  })
})
