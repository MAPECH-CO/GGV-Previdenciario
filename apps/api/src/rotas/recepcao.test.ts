import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, fichaRecepcao, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let relogio = new Date('2026-10-08T15:00:00Z')

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST' | 'PATCH' | 'PUT', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })

const LEAD = {
  nome: 'Joana Ribeiro',
  idade: 66,
  pretende: 'Quer saber do BPC do idoso.',
  telefone: '11987654321',
  cpf: '52998224725',
  cidadeUf: 'Osasco / SP',
  beneficioInteresse: 'loas-idoso',
  comoChegou: 'instagram',
  outraPessoa: false,
}
const cadastrar = async (dados: object = LEAD, apelido = 'ana') => (await chamar(apelido, 'POST', '/api/fichas', dados)).json()
const pessoas = () => banco.select().from(pessoa)

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  relogio = new Date('2026-10-08T15:00:00Z')
  app = criarServidor({ banco, agora: () => relogio })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['dora', 'documentacao'], ['gabi', 'advogada'], ['julia', 'financeiro']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-125 · bloco 1: o lead e a ficha no servidor', () => {
  it('o lead nasce no balcão e a advogada, em outra sessão, acha pelo nome, CPF ou telefone e abre a ficha', async () => {
    const criada = await cadastrar()
    expect(criada).toMatchObject({ resultado: 'criada', pastas: [] })
    for (const termo of ['joana ribeiro', '529.982.247-25', '98765-4321'])
      expect((await chamar('gabi', 'POST', '/api/balcao/busca', { termo })).json().map((r: { id: string }) => r.id)).toEqual([criada.id])

    const ficha = (await chamar('gabi', 'GET', `/api/fichas/${criada.id}`)).json()
    expect(ficha).toMatchObject({
      nome: 'Joana Ribeiro',
      situacao: 'lead',
      cpf: '52998224725',
      contatos: [{ data: '2026-10-08', canal: 'Presencial (balcão)', texto: LEAD.pretende }],
      historico: [{ quem: 'ana', oQue: 'Criou a ficha no balcão (lead)' }],
      senhaGov: { situacao: 'sem-senha' },
      processos: [],
    })
    const [p] = await pessoas()
    expect(p).toMatchObject({ situacao: 'lead', telefone: '11987654321', cpf: '52998224725', cidade: 'Osasco', uf: 'SP', origem: 'instagram' })
    // Dado pessoal fica fora do registro de auditoria.
    const [e] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'ficha_criada'))
    expect(JSON.stringify(e.detalhe)).not.toMatch(/Joana|52998|98765/)
  })

  it('GGVP-16 CA6 · CPF repetido nunca grava e leva à ficha que já existe', async () => {
    const primeira = await cadastrar()
    expect(await cadastrar({ ...LEAD, nome: 'Joana Ribeiro Silva', telefone: '11911112222' }, 'dora')).toEqual({ resultado: 'ja-existe', id: primeira.id })
    expect(await pessoas()).toHaveLength(1)
  })

  it('GGVP-16 CA9 · nome ou telefone igual só grava com "É outra pessoa", e isso fica no histórico', async () => {
    await cadastrar()
    const irma = { ...LEAD, nome: 'Marta Ribeiro', cpf: undefined }
    const duplicidade = (await chamar('ana', 'POST', '/api/fichas/duplicidade', { nome: 'joana ribeiro', telefone: '11900000000', cpf: '529.982.247-25' })).json()
    expect(duplicidade).toMatchObject({ comCpf: { nome: 'Joana Ribeiro' }, parecidas: [{ nome: 'Joana Ribeiro' }] })

    expect(await cadastrar(irma)).toMatchObject({ resultado: 'parecidas', fichas: [{ nome: 'Joana Ribeiro', etapa: 'Lead · contato prévio' }] })
    expect(await pessoas()).toHaveLength(1)
    const criada = await cadastrar({ ...irma, outraPessoa: true })
    expect(criada.resultado).toBe('criada')
    const ficha = (await chamar('ana', 'GET', `/api/fichas/${criada.id}`)).json()
    expect(ficha.historico[0].oQue).toBe('Criou a ficha no balcão (lead), confirmando que é outra pessoa que Joana Ribeiro')
  })

  it('quem nasceu por outro caminho aparece na busca com os casos; editar não apaga o que a ficha não mostra', async () => {
    const [p] = await banco
      .insert(pessoa)
      .values({ nome: 'Maria Souza', situacao: 'cliente', telefone: '11955554444', origem: 'indicacao', logradouro: 'Rua das Flores, 10' })
      .returning()
    await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' })
    const [achada] = (await chamar('ana', 'POST', '/api/balcao/busca', { termo: 'souza' })).json()
    expect(achada).toMatchObject({ id: p.id, situacao: 'cliente', etapa: 'Administrativa · INSS', casos: [{ etapa: 'Administrativa · INSS' }] })

    const ficha = (await chamar('ana', 'GET', `/api/fichas/${p.id}`)).json()
    expect(ficha).toMatchObject({ endereco: 'Rua das Flores, 10', comoChegou: 'indicacao', processos: [{ beneficio: 'loas-idoso' }] })
    const salvo = await chamar('ana', 'PATCH', `/api/fichas/${p.id}`, { nome: 'Maria Souza', telefone: '11955554444', endereco: ficha.endereco, comoChegou: 'indicacao', email: 'maria@exemplo.com' })
    expect(salvo.json().ficha.historico.at(-1)).toMatchObject({ quem: 'ana', oQue: 'Alterou e-mail' })
    const [depois] = await banco.select().from(pessoa).where(eq(pessoa.id, p.id))
    expect(depois).toMatchObject({ situacao: 'cliente', origem: 'indicacao', logradouro: 'Rua das Flores, 10', email: 'maria@exemplo.com' })
  })

  it('editar: CPF de outra ficha não grava; data inválida é recusada no servidor', async () => {
    await cadastrar()
    const outra = await cadastrar({ ...LEAD, nome: 'Maria Souza', telefone: '11955554444', cpf: '11144477735' })
    // A tela manda o formulário inteiro: o que não vem é o que ficou em branco.
    const editar = (dados: object) =>
      chamar('ana', 'PATCH', `/api/fichas/${outra.id}`, { nome: 'Maria Souza', telefone: '11955554444', cidadeUf: 'Osasco / SP', comoChegou: 'instagram', ...dados })
    expect((await editar({ cpf: '52998224725' })).json()).toEqual({ erro: 'cpf-de-outra-ficha', nome: 'Joana Ribeiro' })
    expect((await editar({ nascimento: '31/02/1950' })).statusCode).toBe(400)
    expect((await editar({ email: 'sem-arroba' })).statusCode).toBe(400)
    const ok = (await editar({ cpf: '11144477735', nascimento: '1950-02-28', cep: '06010-000' })).json()
    expect(ok.ficha).toMatchObject({ nascimento: '1950-02-28', cep: '06010000' })
    expect(ok.ficha.historico.at(-1).oQue).toBe('Alterou data de nascimento e CEP')
    expect((await chamar('ana', 'GET', '/api/fichas/nao-existe')).statusCode).toBe(404)
  })

  it('GGVP-24 · a ficha de atendimento grava a triagem e os dados pessoais, nunca a senha; depois, só o que mudou', async () => {
    const { id } = await cadastrar()
    const ENVIO = { nome: 'Joana Ribeiro', cpf: '52998224725', nascimento: '10/05/1958', telefone: '11987654321', endereco: 'Rua B, 20', beneficioInteresse: 'loas-idoso', origem: 'papel', modelo: 'GGV' }
    const r = await chamar('ana', 'PUT', `/api/fichas/${id}/ficha-de-atendimento`, { ...ENVIO, senha: 'gov-segredo-123' })
    expect(r.statusCode).toBe(200)
    const ficha = r.json().ficha
    expect(ficha).toMatchObject({ fichaAtendimentoPreenchida: true, nascimento: '1958-05-10', endereco: 'Rua B, 20', fichaAtendimento: { data: '2026-10-08', origem: 'papel', modelo: 'GGV' } })
    expect(ficha.historico.at(-1)).toMatchObject({
      quem: 'ana',
      oQue: 'Salvou a ficha de atendimento (papel GGV, conferida); em branco: Quantas pessoas moram na casa, Última atividade, Desde quando está sem trabalhar e O que já pediu ao INSS',
    })
    // G9: a senha do gov.br só no cofre.
    expect(JSON.stringify(await banco.select().from(fichaRecepcao))).not.toContain('gov-segredo-123')
    expect(JSON.stringify(await banco.select().from(eventoAuditoria))).not.toContain('gov-segredo-123')
    expect((await pessoas())[0].dataNascimento).toBe('1958-05-10')

    // CA10, CA12: no dia seguinte, pelo tablet, só o que mudou entra no histórico, e a data da ficha não muda.
    relogio = new Date('2026-10-09T15:00:00Z')
    const depois = (await chamar('ana', 'PUT', `/api/fichas/${id}/ficha-de-atendimento`, { ...ENVIO, pessoasNaCasa: 3, origem: 'tablet', modelo: undefined })).json().ficha
    expect(depois.fichaAtendimento.data).toBe('2026-10-08')
    expect(depois.historico.at(-1)).toMatchObject({ quem: 'Cliente (tablet)', oQue: 'Alterou na ficha de atendimento: Quantas pessoas moram na casa' })
    expect((await chamar('ana', 'PUT', `/api/fichas/${id}/ficha-de-atendimento`, { ...ENVIO, nascimento: '10/05/2099' })).statusCode).toBe(400)
  })

  it('perfil da sessão: o Financeiro não cadastra, e a tentativa fica registrada', async () => {
    const r = await chamar('julia', 'POST', '/api/fichas', LEAD)
    expect(r.statusCode).toBe(403)
    expect(await pessoas()).toHaveLength(0)
    expect(await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'acesso_negado'))).toHaveLength(1)
  })
})
