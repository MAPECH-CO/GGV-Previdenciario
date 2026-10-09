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
    expect(await saude({})).toEqual({ status: 200, corpo: { ok: true, servico: 'api', banco: 'sem-banco', drive: 'desligado' } })
  })

  it('com o banco respondendo: 200 e banco "ligado"', async () => {
    const r = await saude({ consultarBanco: async () => 1 })
    expect(r).toEqual({ status: 200, corpo: { ok: true, servico: 'api', banco: 'ligado', drive: 'desligado' } })
  })

  it('com o banco fora do ar: 503, para o deploy não trocar a versão no ar', async () => {
    const r = await saude({ consultarBanco: async () => Promise.reject(new Error('ECONNREFUSED')) })
    expect(r).toEqual({ status: 503, corpo: { ok: false, servico: 'api', banco: 'fora-do-ar', drive: 'desligado' } })
  })

  it('GGVP-107 CA9 · com as variáveis do Drive, drive "ligado" (sem chamar o Google)', async () => {
    const r = await saude({ consultarBanco: async () => 1, driveLigado: true })
    expect(r).toEqual({ status: 200, corpo: { ok: true, servico: 'api', banco: 'ligado', drive: 'ligado' } })
  })

  it('GGVP-107 CA10 · com GOOGLE_DRIVE_SO_LEITURA=sim, drive "so-leitura"', async () => {
    const conta = Buffer.from(JSON.stringify({ client_email: 'x@y', private_key: 'k' })).toString('base64')
    const vars = { GOOGLE_DRIVE_CREDENCIAIS: conta, GOOGLE_DRIVE_PASTA_CLIENTES: 'c', GOOGLE_DRIVE_PASTA_REVISAR: 'r', GOOGLE_DRIVE_SO_LEITURA: 'sim' }
    Object.assign(process.env, vars)
    try {
      expect((await saude({ consultarBanco: async () => 1 })).corpo.drive).toBe('so-leitura')
    } finally {
      for (const k of Object.keys(vars)) delete process.env[k]
    }
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
