import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { criarServidor, MSG_ERRO_INESPERADO } from './servidor.ts'

async function saude(opcoes: Parameters<typeof criarServidor>[0]) {
  const app = criarServidor(opcoes)
  const resposta = await app.inject({ method: 'GET', url: '/saude' })
  await app.close()
  return { status: resposta.statusCode, corpo: resposta.json() }
}

describe('GET /saude', () => {
  it('sem banco configurado: 200 e banco "sem-banco"', async () => {
    expect(await saude({})).toEqual({ status: 200, corpo: { ok: true, servico: 'api', banco: 'sem-banco', drive: 'desligado', versao: 'local' } })
  })

  it('com o banco respondendo: 200 e banco "ligado"', async () => {
    const r = await saude({ consultarBanco: async () => 1 })
    expect(r).toEqual({ status: 200, corpo: { ok: true, servico: 'api', banco: 'ligado', drive: 'desligado', versao: 'local' } })
  })

  it('com o banco fora do ar: 503, para o deploy não trocar a versão no ar', async () => {
    const r = await saude({ consultarBanco: async () => Promise.reject(new Error('ECONNREFUSED')) })
    expect(r).toEqual({ status: 503, corpo: { ok: false, servico: 'api', banco: 'fora-do-ar', drive: 'desligado', versao: 'local' } })
  })

  it('GGVP-107 CA9 · com as variáveis do Drive, drive "ligado" (sem chamar o Google)', async () => {
    const r = await saude({ consultarBanco: async () => 1, driveLigado: true })
    expect(r).toEqual({ status: 200, corpo: { ok: true, servico: 'api', banco: 'ligado', drive: 'ligado', versao: 'local' } })
  })

  it('GGVP-158 · a versão no ar: o commit gravado na imagem', async () => {
    expect((await saude({ versao: '7d37d825' })).corpo.versao).toBe('7d37d825')
  })
})

describe('GGVP-158 · erro do servidor sem SQL nem parâmetros', () => {
  it('a consulta que falha com dado do cliente responde "Algo deu errado." e o registro guarda só a rota, o código e o tipo', async () => {
    const app = criarServidor({})
    // Sem logger, o registro do pedido é o do servidor: dá para espiar o que seria gravado.
    const registro = vi.spyOn(app.log, 'error')
    app.get('/teste/erro', async () => {
      // Como o Drizzle falha: o SQL e os parâmetros na mensagem e nos campos, o código do Postgres na causa.
      const falha = new Error('Failed query: select * from pessoa where cpf = $1\nparams: 123.456.789-09')
      throw Object.assign(falha, { name: 'DrizzleQueryError', query: 'select * from pessoa where cpf = $1', params: ['123.456.789-09'], cause: { code: '42P01' } })
    })
    try {
      const r = await app.inject({ method: 'GET', url: '/teste/erro' })
      expect([r.statusCode, r.json()]).toEqual([500, { erro: MSG_ERRO_INESPERADO }])
      expect(r.body).not.toMatch(/123\.456|select/)
      expect(registro.mock.calls).toEqual([[{ rota: '/teste/erro', codigo: '42P01', tipo: 'DrizzleQueryError' }, 'erro inesperado']])
    } finally {
      registro.mockRestore()
      await app.close()
    }
  })

  it('o 4xx segue com o status e a mensagem do Fastify', async () => {
    const app = criarServidor({})
    app.post('/teste/corpo', async () => 'ok')
    const r = await app.inject({ method: 'POST', url: '/teste/corpo', headers: { 'content-type': 'application/json' }, payload: '{nao é json' })
    expect(r.statusCode).toBe(400)
    expect(r.json()).toMatchObject({ statusCode: 400, code: 'FST_ERR_CTP_INVALID_JSON_BODY' })
    await app.close()
  })
})

describe('GGVP-158 · toda rota /api com trava', () => {
  it('a rota /api nova sem trava não sobe e diz qual é; com trava, e as da sessão, sobem', () => {
    const app = criarServidor({})
    expect(() => app.get('/api/sem-trava', async () => 'x')).toThrow('Rota sem trava de permissão: GET /api/sem-trava')
    expect(() => app.get('/api/com-trava', { preHandler: async () => {} }, async () => 'x')).not.toThrow()
    expect(() => app.get('/api/sessao/teste', async () => 'x')).not.toThrow()
    expect(() => app.get('/fora-da-api', async () => 'x')).not.toThrow()
    // A exceção declarada, com o motivo: a rota que recusa sempre.
    expect(() => app.delete('/api/recusa-sempre', { config: { semTrava: 'recusa sempre' } }, async () => 'x')).not.toThrow()
  })
})

describe('GGVP-158 · cabeçalhos de segurança', () => {
  const pastaTela = mkdtempSync(join(tmpdir(), 'tela-'))
  writeFileSync(join(pastaTela, 'index.html'), '<title>Portal</title>')

  it('a tela, o /saude e a API levam nosniff, DENY e a CSP; sem HTTPS, sem HSTS', async () => {
    const app = criarServidor({ pastaTela })
    for (const url of ['/', '/clientes/novo', '/saude', '/api/nao-existe']) {
      const r = await app.inject({ method: 'GET', url })
      expect(r.headers['x-content-type-options'], url).toBe('nosniff')
      expect(r.headers['x-frame-options'], url).toBe('DENY')
      expect(r.headers['content-security-policy'], url).toContain("default-src 'self'")
      expect(r.headers['content-security-policy'], url).toContain("frame-ancestors 'none'")
      expect(r.headers['strict-transport-security'], url).toBeUndefined()
    }
    await app.close()
  })

  it('a CSP que a rota já pôs vale: o arquivo do cliente segue em sandbox', async () => {
    const app = criarServidor({})
    app.get('/teste/arquivo', async (_pedido, resposta) => resposta.header('content-security-policy', "sandbox; default-src 'none'").send('arquivo'))
    const r = await app.inject({ method: 'GET', url: '/teste/arquivo' })
    expect([r.headers['content-security-policy'], r.headers['x-frame-options']]).toEqual(["sandbox; default-src 'none'", 'DENY'])
    await app.close()
  })

  it('com o cookie seguro (HTTPS), o HSTS também', async () => {
    const app = criarServidor({ pastaTela, cookieSeguro: true })
    expect((await app.inject({ method: 'GET', url: '/' })).headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains')
    expect((await app.inject({ method: 'GET', url: '/saude' })).headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains')
    await app.close()
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
