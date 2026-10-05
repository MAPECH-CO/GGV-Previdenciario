import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { eventoAuditoria, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE, MSG_EXPIRADA, MSG_INVALIDO, MSG_SEM_PERFIL, MSG_TRAVADO, MSG_TROCAR } from './rotas.ts'

const SENHA = 'senha-certa-123'
let banco: Banco
let fechar: () => Promise<void>
let relogio: Date

async function criarUsuario(email: string, extra: Partial<typeof usuario.$inferInsert> = {}) {
  const senhaHash = await bcrypt.hash(SENHA, 4)
  await banco.insert(usuario).values({ email, nome: 'Ana', senhaHash, perfil: 'atendimento', trocarSenha: false, ...extra })
}

function servidor() {
  return criarServidor({ banco, agora: () => relogio })
}

async function entrar(app: ReturnType<typeof servidor>, email: string, senha = SENHA) {
  return app.inject({ method: 'POST', url: '/api/sessao', payload: { email, senha } })
}

const cookieDe = (r: { cookies: { name: string; value: string }[] }): Record<string, string> => {
  const c = r.cookies.find((x) => x.name === COOKIE)
  return c ? { [COOKIE]: c.value } : {}
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  relogio = new Date('2026-10-05T12:00:00Z')
})
afterEach(() => fechar())

describe('CA1 · entrar', () => {
  it('com e-mail e senha certos devolve quem entrou e abre a sessão no cookie httpOnly', async () => {
    await criarUsuario('ana@exemplo.ggv')
    const app = servidor()
    const r = await entrar(app, '  Ana@Exemplo.GGV ')
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ nome: 'Ana', email: 'ana@exemplo.ggv', perfil: 'atendimento', trocarSenha: false })
    const cookie = r.cookies.find((c) => c.name === COOKIE)!
    expect(cookie.httpOnly).toBe(true)
    expect(cookie.expires).toEqual(new Date('2026-10-05T20:00:00Z'))
    expect((await app.inject({ method: 'GET', url: '/api/sessao', cookies: cookieDe(r) })).statusCode).toBe(200)
  })

  it('a sessão vale 8 horas e depois expira', async () => {
    await criarUsuario('ana@exemplo.ggv')
    const app = servidor()
    const cookies = cookieDe(await entrar(app, 'ana@exemplo.ggv'))
    relogio = new Date('2026-10-05T19:59:59Z')
    expect((await app.inject({ method: 'GET', url: '/api/sessao', cookies })).statusCode).toBe(200)
    relogio = new Date('2026-10-05T20:00:00Z')
    const r = await app.inject({ method: 'GET', url: '/api/sessao', cookies })
    expect(r.statusCode).toBe(401)
    expect(r.json()).toEqual({ erro: MSG_EXPIRADA })
  })

  it('sair encerra a sessão', async () => {
    await criarUsuario('ana@exemplo.ggv')
    const app = servidor()
    const cookies = cookieDe(await entrar(app, 'ana@exemplo.ggv'))
    expect((await app.inject({ method: 'DELETE', url: '/api/sessao', cookies })).statusCode).toBe(204)
    expect((await app.inject({ method: 'GET', url: '/api/sessao', cookies })).statusCode).toBe(401)
  })

  it('senha provisória: só deixa trocar a senha; depois de trocar, segue', async () => {
    await criarUsuario('bia@exemplo.ggv', { trocarSenha: true })
    const app = servidor()
    const login = await entrar(app, 'bia@exemplo.ggv')
    expect(login.json().trocarSenha).toBe(true)
    const cookies = cookieDe(login)
    expect((await app.inject({ method: 'GET', url: '/api/casos', cookies })).json()).toEqual({ erro: MSG_TROCAR })

    const curta = await app.inject({ method: 'POST', url: '/api/sessao/senha', cookies, payload: { senhaNova: '1234567' } })
    expect(curta.statusCode).toBe(400)
    const troca = await app.inject({ method: 'POST', url: '/api/sessao/senha', cookies, payload: { senhaNova: 'minha-senha-nova' } })
    expect(troca.json().trocarSenha).toBe(false)
    expect((await entrar(app, 'bia@exemplo.ggv', SENHA)).statusCode).toBe(401)
    expect((await entrar(app, 'bia@exemplo.ggv', 'minha-senha-nova')).statusCode).toBe(200)
  })
})

describe('CA2 · senha errada', () => {
  it('a mesma mensagem para e-mail que não existe e para senha errada', async () => {
    await criarUsuario('ana@exemplo.ggv')
    const app = servidor()
    const semConta = await entrar(app, 'ninguem@exemplo.ggv')
    const senhaErrada = await entrar(app, 'ana@exemplo.ggv', 'errada')
    expect([semConta.statusCode, senhaErrada.statusCode]).toEqual([401, 401])
    expect(semConta.json()).toEqual({ erro: MSG_INVALIDO })
    expect(senhaErrada.json()).toEqual({ erro: MSG_INVALIDO })
  })

  it('a 5ª errada seguida trava 15 minutos, até com a senha certa; depois libera', async () => {
    await criarUsuario('ana@exemplo.ggv')
    const app = servidor()
    for (let i = 1; i <= 4; i++) expect((await entrar(app, 'ana@exemplo.ggv', 'errada')).statusCode).toBe(401)
    const quinta = await entrar(app, 'ana@exemplo.ggv', 'errada')
    expect(quinta.statusCode).toBe(423)
    expect(quinta.json()).toEqual({ erro: MSG_TRAVADO })
    expect((await entrar(app, 'ana@exemplo.ggv')).statusCode).toBe(423)
    relogio = new Date('2026-10-05T12:15:00Z')
    expect((await entrar(app, 'ana@exemplo.ggv')).statusCode).toBe(200)
  })

  it('entrar certo zera a contagem', async () => {
    await criarUsuario('ana@exemplo.ggv')
    const app = servidor()
    for (let i = 1; i <= 4; i++) await entrar(app, 'ana@exemplo.ggv', 'errada')
    await entrar(app, 'ana@exemplo.ggv')
    expect((await entrar(app, 'ana@exemplo.ggv', 'errada')).statusCode).toBe(401)
  })
})

describe('CA4 · sem perfil', () => {
  it('entra, mas nenhuma rota de caso responde', async () => {
    await criarUsuario('caio@exemplo.ggv', { perfil: null })
    const app = servidor()
    const login = await entrar(app, 'caio@exemplo.ggv')
    expect(login.json().perfil).toBeNull()
    const r = await app.inject({ method: 'GET', url: '/api/casos', cookies: cookieDe(login) })
    expect(r.statusCode).toBe(403)
    expect(r.json()).toEqual({ erro: MSG_SEM_PERFIL })
  })
})

describe('CA5 · API sem sessão', () => {
  it('responde 401 em qualquer rota /api, existente ou não, e com token inventado', async () => {
    const app = servidor()
    for (const [method, url] of [['GET', '/api/sessao'], ['GET', '/api/casos'], ['DELETE', '/api/sessao'], ['POST', '/api/sessao/senha']] as const) {
      const r = await app.inject({ method, url })
      expect(r.statusCode, url).toBe(401)
    }
    const inventado = await app.inject({ method: 'GET', url: '/api/sessao', cookies: { [COOKIE]: 'inventado' } })
    expect(inventado.statusCode).toBe(401)
  })
})

describe('CA6 · só o hash', () => {
  it('a senha não volta na resposta e o banco guarda hash bcrypt', async () => {
    await criarUsuario('ana@exemplo.ggv')
    const r = await entrar(servidor(), 'ana@exemplo.ggv')
    expect(r.body).not.toContain(SENHA)
    expect(r.body).not.toContain('senhaHash')
    const [u] = await banco.select().from(usuario).where(eq(usuario.email, 'ana@exemplo.ggv'))
    expect(u.senhaHash).toMatch(/^\$2[aby]\$/)
  })
})

describe('CA7 · histórico', () => {
  it('registra login e logout com quem, quando e de onde', async () => {
    await criarUsuario('ana@exemplo.ggv')
    const app = servidor()
    const cookies = cookieDe(await entrar(app, 'ana@exemplo.ggv'))
    await app.inject({ method: 'DELETE', url: '/api/sessao', cookies })
    const [u] = await banco.select().from(usuario).where(eq(usuario.email, 'ana@exemplo.ggv'))
    const eventos = await banco.select().from(eventoAuditoria)
    expect(eventos.map((e) => [e.quem, e.acao])).toEqual([
      [u.id, 'login'],
      [u.id, 'logout'],
    ])
    expect(eventos[0].quando).toEqual(relogio)
    expect(eventos[0].detalhe).toEqual({ ip: '127.0.0.1' })
  })
})
