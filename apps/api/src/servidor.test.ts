import { describe, expect, it } from 'vitest'
import { criarServidor } from './servidor.ts'

describe('GET /saude', () => {
  it('responde 200 com o contrato Saude', async () => {
    const app = criarServidor()
    const resposta = await app.inject({ method: 'GET', url: '/saude' })
    expect(resposta.statusCode).toBe(200)
    expect(resposta.json()).toEqual({ ok: true, servico: 'api' })
    await app.close()
  })
})
