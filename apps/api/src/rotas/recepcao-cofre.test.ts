import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, credencialGovbr, eventoAuditoria, fichaRecepcao, tarefa, tarefaRecepcao, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'

const SENHA = 'senha-do-portal-1'
/** Senha de teste do gov.br: a varredura procura por ela na ficha, no histórico e nas respostas (G9). */
const SENHA_GOV = 'gov-teste-recepcao-7k2p'
const SENHA_NOVA = 'gov-teste-renovada-3m8q'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
// Quinta, 08/10/2026, meio-dia em Brasília.
const relogio = new Date('2026-10-08T15:00:00Z')

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const json = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) => (await chamar(apelido, method, url, payload)).json()
const eventos = () => banco.select().from(eventoAuditoria)
const acoesDoCofre = async () => (await eventos()).filter((e) => e.acao.startsWith('cofre_')).map((e) => e.acao)

async function lead(nome: string, telefone: string) {
  return (await json('ana', 'POST', '/api/fichas', { nome, idade: 66, pretende: 'Quer saber do BPC.', telefone, beneficioInteresse: 'loas-idoso', outraPessoa: false })).id as string
}
const MARCACAO = { tipo: 'presencial', data: '2026-10-09', hora: '14:00', duracao: 45, com: 'paula', gravar: true, levar: true, pedirFicha: true, confirmarHorarioOcupado: false }
async function entrevista(fichaId: string) {
  return (await json('ana', 'POST', `/api/fichas/${fichaId}/agendamentos`, MARCACAO)).agendamento.id as string
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => relogio })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['dora', 'documentacao'], ['gabi', 'advogada'], ['igor', 'juridico_adm'], ['julia', 'financeiro']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-146 parte 1 · a senha do gov.br das telas da Recepção vai ao cofre do servidor', () => {
  it('a caixa do cofre guarda cifrado e a ficha só vê a situação; trocar fica no histórico, nunca o valor (G9)', async () => {
    const id = await lead('Joana Ribeiro', '11987654321')
    const r = await chamar('ana', 'POST', `/api/fichas/${id}/cofre/gov`, { senha: SENHA_GOV })
    expect(r.statusCode).toBe(200)
    expect(r.json().senhaGov).toEqual({ situacao: 'no-cofre', atualizadaEm: relogio.toISOString(), por: 'ana' })
    expect(r.json().ficha.historico.at(-1)).toMatchObject({ quem: 'ana', oQue: 'Guardou a senha do gov.br no cofre' })
    expect(r.body).not.toContain(SENHA_GOV)

    // A advogada, no computador dela, troca pela caixa da entrevista.
    expect((await chamar('gabi', 'POST', `/api/fichas/${id}/cofre/gov`, { senha: SENHA_NOVA })).statusCode).toBe(200)
    const [c] = await banco.select().from(credencialGovbr).where(eq(credencialGovbr.pessoaId, id))
    expect(c.senhaCifrada.toString('utf8')).not.toContain(SENHA_NOVA)
    expect(await acoesDoCofre()).toEqual(['cofre_senha_cadastrada', 'cofre_senha_trocada'])
    expect((await eventos()).filter((e) => e.acao.startsWith('cofre_')).map((e) => e.alvo)).toEqual([`pessoa:${id}`, `pessoa:${id}`])

    const guardado = JSON.stringify([await banco.select().from(fichaRecepcao), await eventos()])
    expect(guardado).not.toContain(SENHA_GOV)
    expect(guardado).not.toContain(SENHA_NOVA)
    expect((await json('julia', 'GET', '/api/gestao/cofre')).pessoas.map((p: { quem: string; cadastros: number }) => [p.quem, p.cadastros]).sort()).toEqual([
      ['ana', 1],
      ['gabi', 1],
    ])
  })

  it('por perfil: Documentação e Financeiro não guardam; vazio não grava; ficha que não existe é 404', async () => {
    const id = await lead('Joana Ribeiro', '11987654321')
    expect((await chamar('dora', 'POST', `/api/fichas/${id}/cofre/gov`, { senha: SENHA_GOV })).statusCode).toBe(403)
    expect((await chamar('julia', 'POST', `/api/fichas/${id}/cofre/gov`, { senha: SENHA_GOV })).statusCode).toBe(403)
    expect((await chamar('julia', 'POST', `/api/fichas/${id}/cofre/gov/nao-sabe`)).statusCode).toBe(403)
    expect(await json('ana', 'POST', `/api/fichas/${id}/cofre/gov`, { senha: '' })).toEqual({ erro: 'Digite a senha do gov.br' })
    expect((await chamar('ana', 'POST', '/api/fichas/rosa-exemplo/cofre/gov', { senha: SENHA_GOV })).statusCode).toBe(404)
    expect(await banco.select().from(credencialGovbr)).toEqual([])
    expect(JSON.stringify(await eventos())).not.toContain(SENHA_GOV)
  })

  it('"Não sei a senha": a ficha segue com o alerta; com a senha já no cofre, recusa', async () => {
    const id = await lead('Joana Ribeiro', '11987654321')
    const r = await json('ana', 'POST', `/api/fichas/${id}/cofre/gov/nao-sabe`)
    expect(r.senhaGov).toEqual({ situacao: 'sem-senha', naoSabe: true })
    expect(r.ficha.historico.at(-1).oQue).toBe('Marcou "não sei a senha do gov.br": o caso segue com o alerta de senha')
    await chamar('ana', 'POST', `/api/fichas/${id}/cofre/gov`, { senha: SENHA_GOV })
    expect((await chamar('ana', 'POST', `/api/fichas/${id}/cofre/gov/nao-sabe`)).statusCode).toBe(409)
    expect(await acoesDoCofre()).toEqual(['cofre_nao_sabe', 'cofre_senha_cadastrada'])
  })

  it('a situação vem do cofre: a senha cadastrada pela tela do cofre aparece na ficha', async () => {
    const id = await lead('Joana Ribeiro', '11987654321')
    await chamar('igor', 'POST', `/api/pessoas/${id}/cofre`, { senha: SENHA_GOV })
    expect((await json('ana', 'GET', `/api/fichas/${id}`)).senhaGov).toEqual({ situacao: 'no-cofre' })
  })

  it('GGVP-36 · renovou: a senha nova vai ao cofre com a data em que funcionou, e a tarefa de renovar fecha', async () => {
    const id = await lead('Joana Ribeiro', '11987654321')
    const ag = await entrevista(id)
    const pendente = { id: `renovar-senha-${ag}`, codigo: 'D1.08', cliente: { id, nome: 'Joana Ribeiro' }, acao: 'Renovar senha do gov.br', detalhe: '', prazo: 'até 14:00', href: '', setor: 'Atendimento' }
    await banco.insert(tarefaRecepcao).values({ id: pendente.id, pessoaId: id, setor: 'Atendimento', dados: pendente })

    expect((await chamar('ana', 'POST', `/api/entrevistas/${ag}/renovacao`, { resultado: 'renovou', senha: SENHA_NOVA, conferiMeuInss: false })).statusCode).toBe(400)
    const r = await chamar('ana', 'POST', `/api/entrevistas/${ag}/renovacao`, { resultado: 'renovou', senha: SENHA_NOVA, conferiMeuInss: true })
    expect(r.statusCode).toBe(200)
    expect(r.body).not.toContain(SENHA_NOVA)
    const corpo = r.json()
    expect(corpo.senhaGov).toEqual({ situacao: 'no-cofre', atualizadaEm: relogio.toISOString(), por: 'ana', funcionouEm: '2026-10-08' })
    expect(corpo.renovacao).toEqual({ resultado: 'renovou', quem: 'ana', quando: relogio.toISOString() })
    expect(corpo.tarefas.find((t: { id: string }) => t.id === pendente.id).concluida).toBe(true)
    expect(corpo.ficha.historico.at(-1).oQue).toBe('Renovou a senha do gov.br e guardou no cofre; conferiu que o Meu INSS abre e que o CNIS aparece')
    expect(await banco.select({ pessoaId: credencialGovbr.pessoaId }).from(credencialGovbr)).toEqual([{ pessoaId: id }])
    const [cadastro] = (await eventos()).filter((e) => e.acao === 'cofre_senha_cadastrada')
    expect(cadastro.detalhe).toMatchObject({ origem: 'renovacao', perfil: 'atendimento' })
    expect(JSON.stringify([await banco.select().from(fichaRecepcao), await eventos()])).not.toContain(SENHA_NOVA)
  })

  it('GGVP-36 · não conseguiu: motivo e aviso obrigatórios, o aviso nos contatos, nada no cofre; o motivo fica fora da auditoria', async () => {
    const id = await lead('Joana Ribeiro', '11987654321')
    const ag = await entrevista(id)
    const url = `/api/entrevistas/${ag}/renovacao`
    expect((await chamar('ana', 'POST', url, { resultado: 'nao-conseguiu', motivo: 'x', aviseiOCliente: true })).statusCode).toBe(400)
    expect((await chamar('ana', 'POST', url, { resultado: 'nao-conseguiu', motivo: 'o celular não é mais dela', aviseiOCliente: false })).statusCode).toBe(400)
    const r = await json('ana', 'POST', url, { resultado: 'nao-conseguiu', motivo: '  o celular não é mais dela ', aviseiOCliente: true })
    expect(r.renovacao).toMatchObject({ resultado: 'nao-conseguiu', motivo: 'o celular não é mais dela', quem: 'ana' })
    expect(r.ficha.contatos.at(-1)).toMatchObject({ data: '2026-10-08', canal: 'Aviso' })
    expect(await banco.select().from(credencialGovbr)).toEqual([])
    expect(await acoesDoCofre()).toEqual(['cofre_renovacao_falhou'])
    expect(JSON.stringify(await eventos())).not.toContain('celular')
  })

  it('GGVP-36 · por perfil: Documentação e Financeiro não renovam; entrevista que não existe é 404', async () => {
    const id = await lead('Joana Ribeiro', '11987654321')
    const ag = await entrevista(id)
    const renovou = { resultado: 'renovou', senha: SENHA_NOVA, conferiMeuInss: true }
    expect((await chamar('dora', 'POST', `/api/entrevistas/${ag}/renovacao`, renovou)).statusCode).toBe(403)
    expect((await chamar('julia', 'POST', `/api/entrevistas/${ag}/renovacao`, renovou)).statusCode).toBe(403)
    expect((await chamar('ana', 'POST', `/api/entrevistas/${id}-ag-9/renovacao`, renovou)).statusCode).toBe(404)
    expect(await banco.select().from(credencialGovbr)).toEqual([])
  })

  it('só quem pode vê: a senha guardada pela ficha sai só pelo cofre do Jurídico, com tarefa, e a leitura fica no histórico', async () => {
    const id = await lead('Joana Ribeiro', '11987654321')
    await chamar('ana', 'POST', `/api/fichas/${id}/cofre/gov`, { senha: SENHA_GOV })
    const [c] = await banco.insert(caso).values({ pessoaId: id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
    await banco.insert(tarefa).values({ casoId: c.id, passo: 'D2.02', titulo: 'Protocolar no Meu INSS', perfilDono: 'juridico_adm' })
    const revelar = (apelido: string) => chamar(apelido, 'POST', `/api/casos/${c.id}/cofre`, { senhaDoPortal: SENHA })
    expect((await revelar('ana')).statusCode).toBe(403)
    expect((await revelar('julia')).statusCode).toBe(403)
    const r = await revelar('igor')
    expect([r.statusCode, r.json().senha]).toEqual([200, SENHA_GOV])
    expect(await acoesDoCofre()).toEqual(['cofre_senha_cadastrada', 'cofre_senha_lida'])
  })
})
