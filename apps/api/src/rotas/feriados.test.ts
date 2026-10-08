import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { feriado, usuario } from '../banco/esquema.ts'
import { feriadosNacionais } from '../fluxo/prazo-inss.ts'
import { feriadosDoProcesso } from '../fluxo/prazo-judicial.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_FERIADO_REPETIDO } from './feriados.ts'

const SENHA = 'senha-do-portal-1'
/** Um CNJ de teste do TRF3 ("4.03"). */
const CNJ_TRF3 = '00012348120264030001'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST' | 'DELETE', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const lista = async (apelido = 'helena') => (await chamar(apelido, 'GET', '/api/configuracao/feriados')).json()
const acrescentar = (apelido: string, f: object) => chamar(apelido, 'POST', '/api/configuracao/feriados', f)
const carregar = (apelido = 'helena') => chamar(apelido, 'POST', '/api/configuracao/feriados/carga')

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  // O relógio anda um segundo a cada leitura: o histórico sai na ordem em que as coisas aconteceram.
  let agora = Date.parse('2026-10-08T15:00:00Z')
  app = criarServidor({ banco, agora: () => new Date((agora += 1000)) })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['helena', 'senior'], ['lauro', 'socio'], ['julia', 'financeiro']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-146 parte 3 · feriados e suspensões dos tribunais na Configuração', () => {
  it('por perfil: a gestão vê; só a Sênior e o Sócio mudam', async () => {
    expect((await chamar('ana', 'GET', '/api/configuracao/feriados')).statusCode).toBe(403)
    expect(await lista('julia')).toMatchObject({ feriados: [], podeEditar: false })
    expect((await lista('lauro')).podeEditar).toBe(true)
    const natal = { data: '24/12/2026', tribunal: null, descricao: 'Véspera de Natal' }
    expect((await acrescentar('julia', natal)).statusCode).toBe(403)
    expect((await carregar('julia')).statusCode).toBe(403)
    expect((await acrescentar('lauro', natal)).statusCode).toBe(201)
    const [f] = (await lista()).feriados
    expect((await chamar('julia', 'DELETE', `/api/configuracao/feriados/${f.id}`)).statusCode).toBe(403)
    expect(await banco.select().from(feriado)).toHaveLength(1)
  })

  it('carrega os da lei de 2026 e 2027 uma vez; de novo, só o que falta', async () => {
    expect((await carregar()).json()).toEqual({ acrescentados: 382 })
    expect((await carregar()).json()).toEqual({ acrescentados: 0 })
    const { feriados } = await lista()
    expect(feriados.find((f: { data: string; tribunal: string | null }) => f.data === '2026-11-20' && f.tribunal === null).descricao).toBe(
      'Dia Nacional de Zumbi e da Consciência Negra (Lei 14.759/2023)',
    )
    // A contagem dos prazos já usa: o processo do TRF3 pula o recesso; o prazo do INSS, só os nacionais.
    const doTrf3 = await feriadosDoProcesso(banco, CNJ_TRF3)
    expect([doTrf3.has('2026-11-20'), doTrf3.has('2026-12-21'), doTrf3.has('2026-07-09')]).toEqual([true, true, false])
    const nacionais = await feriadosNacionais(banco)
    expect([nacionais.has('2026-11-20'), nacionais.has('2026-08-11')]).toEqual([true, false])
  })

  it('a Sênior acrescenta e tira; data pela biblioteca campos; o mesmo dia no mesmo tribunal não repete, nem o nacional', async () => {
    expect((await acrescentar('helena', { data: '31/02/2026', tribunal: '4.03', descricao: 'Suspensão' })).json()).toEqual({ erro: 'Data inválida: use dd/mm/aaaa.' })
    expect((await acrescentar('helena', { data: '20/03/2026', tribunal: '9.99', descricao: 'Suspensão' })).statusCode).toBe(400)
    const suspensao = { data: '20/03/2026', tribunal: '4.03', descricao: 'Suspensão: sistema fora do ar' }
    expect((await acrescentar('helena', suspensao)).json().feriado).toMatchObject({ data: '2026-03-20', tribunal: '4.03', descricao: 'Suspensão: sistema fora do ar' })
    expect((await acrescentar('helena', suspensao)).json()).toEqual({ erro: MSG_FERIADO_REPETIDO })
    expect((await acrescentar('helena', { ...suspensao, tribunal: '8.26' })).statusCode).toBe(201)
    const nacional = { data: '24/12/2026', tribunal: null, descricao: 'Véspera de Natal' }
    expect((await acrescentar('helena', nacional)).statusCode).toBe(201)
    expect((await acrescentar('helena', nacional)).json()).toEqual({ erro: MSG_FERIADO_REPETIDO })

    const trf3 = (await lista()).feriados.find((f: { tribunal: string | null }) => f.tribunal === '4.03')
    expect((await chamar('helena', 'DELETE', `/api/configuracao/feriados/${trf3.id}`)).json()).toEqual({ ok: true })
    expect((await chamar('helena', 'DELETE', `/api/configuracao/feriados/${trf3.id}`)).statusCode).toBe(404)
    expect((await lista()).feriados.map((f: { data: string; tribunal: string | null }) => `${f.data} ${f.tribunal}`)).toEqual(['2026-03-20 8.26', '2026-12-24 null'])
  })

  it('cada mudança fica no histórico, com quem, o dia, o tribunal e o que era', async () => {
    await acrescentar('helena', { data: '20/03/2026', tribunal: '4.03', descricao: 'Suspensão: sistema fora do ar' })
    const [f] = (await lista()).feriados
    await chamar('lauro', 'DELETE', `/api/configuracao/feriados/${f.id}`)
    await carregar()
    expect((await lista('julia')).historico.map((h: { quem: string; descricao: string }) => `${h.quem} · ${h.descricao}`)).toEqual([
      'helena · Carregou os feriados da lei de 2026 e 2027: 382 dia(s) acrescentado(s)',
      'lauro · Tirou 20/03/2026 · TRF3 · Suspensão: sistema fora do ar',
      'helena · Acrescentou 20/03/2026 · TRF3 · Suspensão: sistema fora do ar',
    ])
  })
})
