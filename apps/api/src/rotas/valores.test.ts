import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, pessoa, prestacaoContas, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_SEM_VALOR, MSG_SO_A_ADVOGADA } from './valores.ts'

// GGVP-158 P7.6: o valor da causa e a renda por pessoa do LOAS, pela regra de valores do Pedro (06/10).
const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
let pessoaId: string
const ids: Record<string, string> = {}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'PUT', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const valores = (apelido: string) => chamar(apelido, 'GET', `/api/casos/${casoId}/valores`)

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco })
  for (const [apelido, perfil] of [
    ['gabi', 'advogada'],
    ['maria', 'advogada'],
    ['helena', 'senior'],
    ['ana', 'atendimento'],
    ['jessica', 'documentacao'],
    ['julia', 'financeiro'],
    ['lauro', 'socio'],
  ] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Joana Prado', situacao: 'cliente' }).returning()
  pessoaId = p.id
  const [c] = await banco.insert(caso).values({ pessoaId, beneficio: 'bpc_loas_idoso', fase: 'judicial', advogadaResponsavelId: ids.gabi }).returning()
  casoId = c.id
})
afterEach(() => fechar())

describe('GGVP-158 P7.6 · o valor da causa e a renda por pessoa do LOAS', () => {
  it('a advogada grava; o Financeiro e o Sócio leem; o histórico diz que mudou, sem o valor', async () => {
    expect((await chamar('gabi', 'PUT', `/api/casos/${casoId}/valor-da-causa`, { valor: '15.000,00' })).statusCode).toBe(200)
    expect((await chamar('gabi', 'PUT', `/api/fichas/${pessoaId}/renda-por-pessoa`, { valor: '350,00' })).statusCode).toBe(200)
    expect((await valores('julia')).json()).toEqual({ casoId, causa: '15000.00', rendaPorPessoa: '350.00', prestacao: null, podeEditar: false })
    expect((await valores('lauro')).json()).toMatchObject({ causa: '15000.00', rendaPorPessoa: '350.00' })
    expect((await valores('gabi')).json()).toEqual({ casoId, causa: '15000.00', rendaPorPessoa: '350.00', podeEditar: true })
    const eventos = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.alvo, `caso:${casoId}`))
    expect(eventos.map((e) => e.acao)).toContain('valor_da_causa_alterado')
    expect(JSON.stringify(eventos)).not.toContain('15000')
  })

  it('o Atendimento, a Documentação e a Sênior não leem nem gravam', async () => {
    await chamar('gabi', 'PUT', `/api/casos/${casoId}/valor-da-causa`, { valor: '15.000,00' })
    for (const apelido of ['ana', 'jessica']) expect((await valores(apelido)).statusCode, apelido).toBe(403)
    const senior = await valores('helena')
    expect([senior.statusCode, senior.json().erro]).toEqual([403, MSG_SEM_VALOR])
    for (const apelido of ['helena', 'ana']) {
      const r = await chamar(apelido, 'PUT', `/api/casos/${casoId}/valor-da-causa`, { valor: '1,00' })
      expect([r.statusCode, r.json().erro], apelido).toEqual([403, MSG_SO_A_ADVOGADA])
    }
    expect((await banco.select({ v: caso.valorCausa }).from(caso).where(eq(caso.id, casoId)))[0].v).toBe('15000.00')
  })

  it('o valor errado recusa e nada muda', async () => {
    const r = await chamar('gabi', 'PUT', `/api/fichas/${pessoaId}/renda-por-pessoa`, { valor: 'abc' })
    expect([r.statusCode, r.json().erro]).toEqual([400, 'Informe a renda por pessoa, como 1.234,56'])
    expect((await chamar('gabi', 'PUT', `/api/casos/${casoId}/valor-da-causa`, { valor: '-5' })).json().erro).toBe('Informe o valor da causa, como 1.234,56')
    expect((await banco.select({ r: pessoa.rendaPorPessoa }).from(pessoa).where(eq(pessoa.id, pessoaId)))[0].r).toBeNull()
  })

  it('GGVP-44 CA13 (Mateus, 14/10) · a prestação só para a Sênior e na prestação de contas; a advogada vê o valor da causa, nunca a prestação; o resumo do processo traz os valores que o perfil vê', async () => {
    await chamar('gabi', 'PUT', `/api/casos/${casoId}/valor-da-causa`, { valor: '15.000,00' })
    await banco.insert(prestacaoContas).values({ casoId, valorRecebido: '10000.00', honorarios: '3000.00', valorCliente: '7000.00', percentualHonorarios: '30.00' })
    // Fora da prestação, a Sênior não vê valor nenhum.
    expect([(await valores('helena')).statusCode, (await valores('gabi')).json().prestacao]).toEqual([403, undefined])
    await banco.insert(tarefa).values({ casoId, passo: 'D3b.02', titulo: 'Prestar contas', perfilDono: 'senior' })
    expect((await valores('helena')).json().prestacao).toEqual({ versao: 1, recebido: '10000.00', honorarios: '3000.00', repasse: '7000.00' })
    // As advogadas, mesmo a do caso, veem o valor da causa, mas não a prestação.
    for (const apelido of ['gabi', 'maria']) {
      const r = (await valores(apelido)).json()
      expect([apelido, r.causa, r.prestacao]).toEqual([apelido, '15000.00', undefined])
    }
    const daAdvogada = (await chamar('gabi', 'GET', `/api/casos/${casoId}/processo`)).json()
    expect([daAdvogada.valorDaCausa, daAdvogada.rendaPorPessoa]).toEqual(['15000.00', null])
    // O Atendimento nem abre o resumo do processo (GGVP-162).
    const doAtendimento = await chamar('ana', 'GET', `/api/casos/${casoId}/processo`)
    expect(doAtendimento.statusCode).toBe(403)
    expect(doAtendimento.body).not.toContain('15000')
  })
})
