import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { CONFERENCIAS } from '../../../web/src/regras/contrato.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
// Quinta, 08/10/2026, meio-dia em Brasília.
const relogio = new Date('2026-10-08T15:00:00Z')

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const json = async (apelido: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) => (await chamar(apelido, method, url, payload)).json()

async function lead(nome = 'Joana Ribeiro', telefone = '11987654321', cpf?: string) {
  return (await json('ana', 'POST', '/api/fichas', { nome, idade: 66, pretende: 'Quer o BPC.', telefone, cpf, beneficioInteresse: 'loas-idoso', outraPessoa: false })).id as string
}
const fechou = (fichaId: string, beneficio = 'loas-idoso') => json('ana', 'POST', `/api/fichas/${fichaId}/processos`, { beneficio })
const TODAS = Object.fromEntries(CONFERENCIAS.map((c) => [c.id, true]))
/** Valores válidos para os campos do modelo que a ficha do balcão ainda não tem. */
const VALIDOS: Record<string, string> = {
  cpf: '52998224725',
  rg: '12.345.678-9',
  estadoCivil: 'Viúvo(a)',
  profissao: 'Do lar',
  endereco: 'Rua das Flores, 10, Centro, Osasco/SP',
  telefone: '11987654321',
  nome: 'Joana Ribeiro',
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => relogio })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['gabi', 'advogada'], ['julia', 'financeiro']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-125 · bloco 4a: o "fechou" vira caso no banco, com o contrato', () => {
  it('o caso nasce em atendimento, com o benefício do portal; a pessoa vira cliente; o contrato vai à cópia das telas', async () => {
    const fichaId = await lead()
    expect((await chamar('ana', 'POST', `/api/fichas/${fichaId}/processos`, { beneficio: 'nao-sei' })).statusCode).toBe(400)
    expect((await chamar('julia', 'POST', `/api/fichas/${fichaId}/processos`, { beneficio: 'loas-idoso' })).statusCode).toBe(403)

    const r = await fechou(fichaId)
    expect(r.processo).toMatchObject({ beneficio: 'loas-idoso', etapa: 'Contrato · preparar', proximaAcao: 'preparar o contrato' })
    expect(r.contrato).toMatchObject({ processoId: r.processo.id, fichaId, etapa: 'preparar', kit: { documentos: expect.any(Array) } })
    expect(r.ficha).toMatchObject({ situacao: 'cliente', desde: '10/2026', processos: [{ id: r.processo.id, etapa: 'Contrato · preparar' }] })
    expect(r.ficha.historico.at(-1).oQue).toMatch(/^Fechou .+: processo novo com o kit /)

    const [novo] = await banco.select().from(caso).where(eq(caso.pessoaId, fichaId))
    expect(novo).toMatchObject({ id: r.processo.id, beneficio: 'bpc_loas_idoso', fase: 'atendimento' })
    expect((await banco.select().from(pessoa).where(eq(pessoa.id, fichaId)))[0].situacao).toBe('cliente')
    expect((await json('gabi', 'GET', '/api/recepcao')).contratos).toMatchObject([{ processoId: r.processo.id, etapa: 'preparar' }])
  })

  it('as condições mudam o kit antes de gerar; o contrato só gera com os campos; a correção vai à ficha e ao histórico', async () => {
    const fichaId = await lead()
    const { processo } = await fechou(fichaId)
    const base = `/api/processos/${processo.id}/contrato`
    const condicoes = await json('ana', 'PUT', `${base}/condicoes`, { representado: false, moradia: true, uniaoEstavel: false, separacaoDeFato: false })
    expect(condicoes.contrato.condicoes.moradia).toBe(true)
    expect(condicoes.ficha.historico.at(-1).oQue).toContain('comprovante de residência em nome de outra pessoa')

    expect((await chamar('ana', 'POST', `${base}/gerar`, { aprovados: true, conferencias: {}, correcoes: {} })).statusCode).toBe(400)
    const faltam = await json('ana', 'POST', `${base}/gerar`, { aprovados: true, conferencias: TODAS, correcoes: {} })
    expect(faltam.resultado).toBe('faltam')
    const correcoes = Object.fromEntries((faltam.campos as string[]).map((c) => [c, VALIDOS[c]]))
    expect(Object.values(correcoes).every(Boolean)).toBe(true)

    const gerado = await json('ana', 'POST', `${base}/gerar`, { aprovados: false, oQueCorrigir: 'faltavam dados do cadastro', conferencias: TODAS, correcoes })
    expect(gerado).toMatchObject({ resultado: 'gerado', contrato: { etapa: 'assinatura', documento: { versao: 1 }, versoes: [{ versao: 1, motivo: 'corrigido: faltavam dados do cadastro' }] } })
    expect(gerado.ficha.processos[0]).toMatchObject({ etapa: 'Contrato · assinatura', proximaAcao: 'colher a assinatura' })
    const oQue = gerado.ficha.historico.map((e: { oQue: string }) => e.oQue)
    expect(oQue).toContainEqual(expect.stringMatching(/^Corrigiu no contrato: .+ \(faltavam dados do cadastro\)$/))
    expect(oQue.at(-1)).toMatch(/^Gerou o contrato de .+ \(versão 1\)/)
    expect((await chamar('ana', 'PUT', `${base}/condicoes`, { representado: false, moradia: false, uniaoEstavel: false, separacaoDeFato: false })).statusCode).toBe(400)
  })

  it('CPF de outra ficha não gera o contrato', async () => {
    await lead('Marta Lima', '11955554444', '11144477735')
    const fichaId = await lead()
    const { processo } = await fechou(fichaId)
    const base = `/api/processos/${processo.id}/contrato`
    const faltam = await json('ana', 'POST', `${base}/gerar`, { aprovados: true, conferencias: TODAS, correcoes: {} })
    const correcoes = { ...Object.fromEntries((faltam.campos as string[]).map((c) => [c, VALIDOS[c]])), cpf: '11144477735' }
    expect(await json('ana', 'POST', `${base}/gerar`, { aprovados: false, oQueCorrigir: 'cpf da cliente', conferencias: TODAS, correcoes })).toEqual({
      resultado: 'cpf-de-outra-ficha',
      nome: 'Marta Lima',
    })
  })
})
