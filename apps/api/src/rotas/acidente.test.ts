import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE, MSG_SEM_PERMISSAO } from '../sessao/rotas.ts'
import { MSG_SO_AUXILIO_ACIDENTE } from './acidente.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let pessoaId: string

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const url = (casoId: string) => `/api/processos/${casoId}/acidente`
const DADOS = { circunstancia: 'trabalho', categoria: 'empregado', acidenteEm: '2024-03-15', auxilioAnterior: true, recusados: ['cat'] }
async function novoCaso(beneficio: 'auxilio_acidente' | 'bpc_loas_deficiente') {
  const [c] = await banco.insert(caso).values({ pessoaId, beneficio }).returning()
  return c.id
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => new Date('2026-10-08T15:00:00Z') })
  for (const [apelido, nome, perfil] of [
    ['fabio', 'Fábio', 'documentacao'],
    ['ana', 'Ana', 'atendimento'],
  ] as const) {
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Sebastião Exemplo', situacao: 'cliente' }).returning()
  pessoaId = p.id
})
afterEach(() => fechar())

describe('GGVP-132 · a prova do acidente no servidor (GGVP-47)', () => {
  it('a Documentação marca a circunstância; quem abre o caso vê; o histórico não leva o auxílio anterior', async () => {
    const casoId = await novoCaso('auxilio_acidente')
    const cookies = await cookieDe('fabio')
    expect((await app.inject({ method: 'GET', url: url(casoId), cookies })).json()).toEqual({})
    const r = await app.inject({ method: 'PUT', url: url(casoId), cookies, payload: DADOS })
    expect([r.statusCode, r.json().quem, r.json().recusados]).toEqual([200, 'Fábio', ['cat']])
    expect((await app.inject({ method: 'GET', url: url(casoId), cookies: await cookieDe('ana') })).json().dados.circunstancia).toBe('trabalho')
    const [evento] = (await banco.select().from(eventoAuditoria)).filter((e) => e.acao === 'acidente_registrado')
    expect(evento.detalhe).not.toHaveProperty('auxilioAnterior')
  })

  it('o Atendimento não marca; data futura, lista fora e outro benefício não salvam', async () => {
    const casoId = await novoCaso('auxilio_acidente')
    expect((await app.inject({ method: 'PUT', url: url(casoId), cookies: await cookieDe('ana'), payload: DADOS })).json().erro).toBe(MSG_SEM_PERMISSAO)
    const cookies = await cookieDe('fabio')
    expect((await app.inject({ method: 'PUT', url: url(casoId), cookies, payload: { ...DADOS, acidenteEm: '2027-01-01' } })).statusCode).toBe(400)
    expect((await app.inject({ method: 'PUT', url: url(casoId), cookies, payload: { ...DADOS, circunstancia: 'outra' } })).statusCode).toBe(400)
    const loas = await novoCaso('bpc_loas_deficiente')
    const r = await app.inject({ method: 'PUT', url: url(loas), cookies, payload: DADOS })
    expect([r.statusCode, r.json().erro]).toEqual([409, MSG_SO_AUXILIO_ACIDENTE])
  })
})
