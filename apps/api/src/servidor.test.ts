import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { criarServidor } from './servidor.ts'

async function saude(opcoes: Parameters<typeof criarServidor>[0]) {
  const app = criarServidor(opcoes)
  const resposta = await app.inject({ method: 'GET', url: '/saude' })
  await app.close()
  return { status: resposta.statusCode, corpo: resposta.json() }
}

describe('GET /saude', () => {
  it('sem banco configurado: 200 e banco "sem-banco"', async () => {
    expect(await saude({})).toEqual({ status: 200, corpo: { ok: true, servico: 'api', banco: 'sem-banco' } })
  })

  it('com o banco respondendo: 200 e banco "ligado"', async () => {
    const r = await saude({ consultarBanco: async () => 1 })
    expect(r).toEqual({ status: 200, corpo: { ok: true, servico: 'api', banco: 'ligado' } })
  })

  it('com o banco fora do ar: 503, para o deploy não trocar a versão no ar', async () => {
    const r = await saude({ consultarBanco: async () => Promise.reject(new Error('ECONNREFUSED')) })
    expect(r).toEqual({ status: 503, corpo: { ok: false, servico: 'api', banco: 'fora-do-ar' } })
  })
})

describe('tela montada', () => {
  const pastaTela = mkdtempSync(join(tmpdir(), 'tela-'))
  writeFileSync(join(pastaTela, 'index.html'), '<title>Portal</title>')

  it('serve o index.html na raiz e em qualquer caminho da tela', async () => {
    const app = criarServidor({ pastaTela })
    for (const url of ['/', '/tokens', '/clientes/novo']) {
      const resposta = await app.inject({ method: 'GET', url })
      expect(resposta.statusCode, url).toBe(200)
      expect(resposta.body, url).toContain('<title>Portal</title>')
    }
    await app.close()
  })

  it('a rota de saúde continua sendo da API', async () => {
    const app = criarServidor({ pastaTela })
    expect((await app.inject({ method: 'GET', url: '/saude' })).json().servico).toBe('api')
    await app.close()
  })

  it('sem a pasta da tela, caminho desconhecido é 404', async () => {
    const app = criarServidor({ pastaTela: join(pastaTela, 'nao-existe') })
    expect((await app.inject({ method: 'GET', url: '/tokens' })).statusCode).toBe(404)
    await app.close()
  })
})
