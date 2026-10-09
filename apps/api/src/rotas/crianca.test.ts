import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, caso, eventoAuditoria, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE, MSG_SEM_PERMISSAO } from '../sessao/rotas.ts'
import { MSG_SO_INFANTIL } from './crianca.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const url = (casoId: string) => `/api/processos/${casoId}/crianca`
const DADOS = { condicoes: ['neurologica'], terapias: ['fono'], escola: true }
async function novoCaso(nascimento: string) {
  const [p] = await banco.insert(pessoa).values({ nome: 'Davi Exemplo', situacao: 'cliente', dataNascimento: nascimento }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente' }).returning()
  return c.id
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => new Date('2026-10-08T15:00:00Z') })
  for (const [apelido, nome, perfil] of [
    ['gabi', 'Gabi', 'advogada'],
    ['ana', 'Ana', 'atendimento'],
  ] as const) {
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  }
})
afterEach(() => fechar())

describe('GGVP-132 · o LOAS de menor de 16 anos no servidor (GGVP-50)', () => {
  it('CA1, CA2 · a advogada marca a condição; o Atendimento vê só os relatórios que o caso pede, nunca a condição', async () => {
    const casoId = await novoCaso('2018-05-10')
    expect((await app.inject({ method: 'PUT', url: url(casoId), cookies: await cookieDe('ana'), payload: DADOS })).json().erro).toBe(MSG_SEM_PERMISSAO)
    const r = await app.inject({ method: 'PUT', url: url(casoId), cookies: await cookieDe('gabi'), payload: DADOS })
    expect([r.statusCode, r.json().idade, r.json().relatorios.length, r.json().dados.quem]).toEqual([200, 8, 3, 'Gabi'])
    const ana = (await app.inject({ method: 'GET', url: url(casoId), cookies: await cookieDe('ana') })).json()
    expect([ana.infantil, ana.dados, ana.relatorios]).toEqual([true, undefined, r.json().relatorios])
    expect(await banco.select().from(acessoDadoSensivel)).toEqual([])
    const gabi = (await app.inject({ method: 'GET', url: url(casoId), cookies: await cookieDe('gabi') })).json()
    expect(gabi.dados.condicoes).toEqual(['neurologica'])
    expect((await banco.select().from(acessoDadoSensivel)).map((a) => a.recurso)).toEqual([`crianca:${casoId}`])
    const [evento] = (await banco.select().from(eventoAuditoria)).filter((e) => e.acao === 'crianca_registrada')
    expect(JSON.stringify(evento.detalhe)).not.toContain('neurologica')
  })

  it('com 16 anos ou mais (G19, pela data de nascimento) o caso não é infantil e não recebe a condição', async () => {
    const casoId = await novoCaso('2010-10-08')
    expect((await app.inject({ method: 'GET', url: url(casoId), cookies: await cookieDe('gabi') })).json()).toEqual({ infantil: false, relatorios: [] })
    const r = await app.inject({ method: 'PUT', url: url(casoId), cookies: await cookieDe('gabi'), payload: DADOS })
    expect([r.statusCode, r.json().erro]).toEqual([409, MSG_SO_INFANTIL])
    expect((await app.inject({ method: 'PUT', url: url(await novoCaso('2018-05-10')), cookies: await cookieDe('gabi'), payload: { ...DADOS, terapias: ['outra'] } })).statusCode).toBe(400)
  })
})
