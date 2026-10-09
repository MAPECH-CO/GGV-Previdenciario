import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { fichaRecepcao, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { cadastroDaFicha } from '../../../web/src/regras/cadastro.ts'
import type { Ficha } from '../../../web/src/dados/tipos.ts'
import { MSG_SENHA_FORA_DO_COFRE } from './recepcao-decisoes.ts'

const SENHA = 'senha-do-portal-1'
/** Senha de teste do gov.br: não pode aparecer na ficha (G9). */
const SENHA_GOV = 'gov-teste-decisoes-4k2'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
// Quinta, 08/10/2026, meio-dia em Brasília.
const relogio = new Date('2026-10-08T15:00:00Z')

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const json = async (apelido: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, payload?: object) => (await chamar(apelido, method, url, payload)).json()
type Tarefa = { acao: string; concluida?: boolean }
const abertas = (tarefas: Tarefa[]) => tarefas.filter((t) => !t.concluida).map((t) => t.acao)

async function lead(nome = 'Joana Ribeiro', telefone = '11987654321', cpf?: string) {
  return (await json('ana', 'POST', '/api/fichas', { nome, idade: 66, pretende: 'Quer saber do BPC.', telefone, cpf, beneficioInteresse: 'loas-idoso', outraPessoa: false })).id as string
}

/** Lead do balcão com a entrevista de amanhã gravada e transcrita pela advogada. */
async function entrevistaFeita(nome?: string, telefone?: string) {
  const fichaId = await lead(nome, telefone)
  const MARCACAO = { tipo: 'presencial', data: '2026-10-09', hora: '14:00', duracao: 45, com: 'paula', gravar: true, levar: true, pedirFicha: true, confirmarHorarioOcupado: true }
  const agendamentoId = (await json('ana', 'POST', `/api/fichas/${fichaId}/agendamentos`, MARCACAO)).agendamento.id as string
  const { gravacao } = await json('gabi', 'POST', `/api/entrevistas/${agendamentoId}/gravacoes`, { avisei: true })
  await json('gabi', 'POST', `/api/gravacoes/${gravacao.id}/encerrar`, { aos: 300, online: true })
  await json('gabi', 'POST', `/api/gravacoes/${gravacao.id}/transcricao`, {})
  return { fichaId, agendamentoId }
}
const definir = (agendamentoId: string, beneficio: string, apelido = 'gabi') =>
  chamar(apelido, 'POST', `/api/entrevistas/${agendamentoId}/beneficio`, { beneficio, conferi: true })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => relogio })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['eva', 'atendimento_lider'], ['gabi', 'advogada']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-125 · bloco 3b: as decisões depois da entrevista no servidor', () => {
  it('G3: a advogada define o benefício, a Atendimento não; benefício com cálculo abre o cálculo, e sem CNIS ele não grava', async () => {
    const { agendamentoId } = await entrevistaFeita()
    expect((await definir(agendamentoId, 'loas-idoso', 'ana')).statusCode).toBe(403)
    expect((await definir(agendamentoId, 'nao-sei')).statusCode).toBe(400)

    const loas = (await definir(agendamentoId, 'loas-idoso')).json()
    expect(loas.ficha.beneficioDefinido).toMatchObject({ beneficio: 'loas-idoso', quem: 'gabi', agendamentoId })
    expect(loas.ficha.historico.map((e: { oQue: string }) => e.oQue)).toContainEqual(expect.stringMatching(/^Definiu o benefício do caso \(D1.12\): /))
    expect(abertas(loas.tarefas)).toEqual(['Cadastrar lead'])

    const aposentadoria = (await definir(agendamentoId, 'aposentadoria-idade')).json()
    expect(aposentadoria.tarefa).toMatchObject({ acao: 'Calcular tempo e pontos', setor: 'Jurídico' })
    expect(aposentadoria.tarefa.detalhe).toContain('sem CNIS no caso')
    expect(aposentadoria.ficha.historico.map((e: { oQue: string }) => e.oQue)).toContainEqual(expect.stringMatching(/^Trocou o benefício do caso: «.+» → «.+»$/))
    const calculo = { podeAposentar: true, tempo: { anos: 30, meses: 2, dias: 0 }, pontos: 95, regra: 'Transição por pontos (EC 103, art. 15)', conferi: true }
    expect((await json('gabi', 'POST', `/api/entrevistas/${agendamentoId}/calculo`, calculo)).erro).toBe('Sem CNIS no caso.')
    // Volta para um benefício sem cálculo: a tarefa do cálculo sai da fila.
    expect(abertas((await definir(agendamentoId, 'loas-idoso')).json().tarefas)).toEqual(['Cadastrar lead'])
  })

  it('o cadastro completa a mesma ficha, com o valor anterior no histórico; mescla com quem salvou antes; CPF de outra ficha não grava', async () => {
    const { fichaId } = await entrevistaFeita()
    const ficha: Ficha = await json('gabi', 'GET', `/api/fichas/${fichaId}`)
    const base = cadastroDaFicha(ficha)
    const valores = {
      ...base,
      cpf: '52998224725',
      rg: '12.345.678-9',
      nascimento: '10/05/1958',
      estadoCivil: 'Viúvo(a)',
      profissao: 'Do lar',
      cep: '01001000',
      rua: 'Praça da Sé, 1',
      bairro: 'Sé',
      cidade: 'São Paulo',
      uf: 'SP',
    }
    const salvo = await json('gabi', 'PUT', `/api/fichas/${fichaId}/cadastro`, { base, valores })
    expect(salvo).toMatchObject({ resultado: 'salvo', ficha: { rg: '123456789', cpf: '52998224725', bairro: 'Sé', cidadeUf: 'São Paulo / SP' } })
    const oQue = salvo.ficha.historico.map((e: { oQue: string }) => e.oQue)
    expect(oQue).toContain('Cadastrou o lead (D1.10): completou a mesma ficha do primeiro contato')
    expect(oQue).toContain('Alterou RG: «—» → «123456789»')
    expect(abertas(salvo.tarefas)).toEqual(['Definir benefício'])
    expect((await banco.select().from(pessoa).where(eq(pessoa.id, fichaId)))[0]).toMatchObject({ cpf: '52998224725', bairro: 'Sé', cidade: 'São Paulo', uf: 'SP' })

    // Outra pessoa troca o telefone enquanto esta tela estava aberta com o antigo (lead troca livre: Pedro, 08/10).
    const depois = cadastroDaFicha(salvo.ficha)
    await json('ana', 'PATCH', `/api/fichas/${fichaId}`, { nome: 'Joana Ribeiro', telefone: '11911112222', cpf: '52998224725' })
    const conflito = await json('gabi', 'PUT', `/api/fichas/${fichaId}/cadastro`, { base: depois, valores: { ...depois, telefone: '11933334444' } })
    expect(conflito).toMatchObject({ resultado: 'conflito', campos: [{ campo: 'telefone', meu: '(11) 93333-4444' }] })

    const outra = await lead('Marta Lima', '11955554444', '11144477735')
    expect(await json('gabi', 'PUT', `/api/fichas/${fichaId}/cadastro`, { base: depois, valores: { ...depois, telefone: '11911112222', cpf: '11144477735' } })).toEqual({
      resultado: 'cpf-de-outra-ficha',
      id: outra,
      nome: 'Marta Lima',
    })
  })

  it('GGVP-111: no cadastro, o lead troca o telefone livre; o de cliente só muda com a verificação, na edição da ficha', async () => {
    const { fichaId } = await entrevistaFeita()
    const ficha: Ficha = await json('gabi', 'GET', `/api/fichas/${fichaId}`)
    const base = cadastroDaFicha(ficha)
    const valores = { ...base, cpf: '52998224725', rg: '12.345.678-9', nascimento: '10/05/1958', estadoCivil: 'Viúvo(a)', profissao: 'Do lar', cep: '01001000', rua: 'Praça da Sé, 1', bairro: 'Sé', cidade: 'São Paulo', uf: 'SP', telefone: '11922223333' }
    expect(await json('gabi', 'PUT', `/api/fichas/${fichaId}/cadastro`, { base, valores })).toMatchObject({ resultado: 'salvo', ficha: { telefone: '11922223333' } })

    // Fechou: agora é cliente, e o telefone dele não muda pelo cadastro.
    await json('ana', 'POST', `/api/fichas/${fichaId}/processos`, { beneficio: 'loas-idoso' })
    const cliente = cadastroDaFicha(await json('gabi', 'GET', `/api/fichas/${fichaId}`))
    const recusa = await chamar('gabi', 'PUT', `/api/fichas/${fichaId}/cadastro`, { base: cliente, valores: { ...cliente, telefone: '11944445555' } })
    expect(recusa.statusCode).toBe(400)
    expect(recusa.json().erro).toBe('Telefone, e-mail e dados bancários só mudam com o cliente verificado por chamada de vídeo ou no escritório.')
    expect((await json('gabi', 'GET', `/api/fichas/${fichaId}`)).telefone).toBe('11922223333')
  })

  it('G16: não fechou sem recontato arquiva com o motivo na pessoa e fecha as tarefas; a recusa do escritório não é do Atendimento', async () => {
    const { fichaId, agendamentoId } = await entrevistaFeita()
    await definir(agendamentoId, 'loas-idoso')
    const url = `/api/fichas/${fichaId}/fechamento`
    expect((await json('ana', 'POST', url, { fechou: false, motivo: 'recusado', recontatar: null })).erro).toBeDefined()
    expect((await json('ana', 'POST', url, { fechou: false, motivo: '', recontatar: null })).erro).toBeDefined()

    const arquivado = await json('ana', 'POST', url, { fechou: false, motivo: 'preco', detalhe: 'achou caro', recontatar: null })
    expect(arquivado.ficha.fechamento).toMatchObject({ situacao: 'arquivado', motivo: 'preco', papel: 'atendimento', quem: 'ana' })
    expect(abertas(arquivado.tarefas)).toEqual([])
    expect((await banco.select().from(pessoa).where(eq(pessoa.id, fichaId)))[0]).toMatchObject({ situacao: 'nao_virou_cliente', motivoNaoVirou: 'Preço: achou caro' })

    // O líder do Atendimento pode registrar a recusa do escritório.
    const outro = await entrevistaFeita('Marta Lima', '11955554444')
    await definir(outro.agendamentoId, 'loas-idoso')
    const recusa = await json('eva', 'POST', `/api/fichas/${outro.fichaId}/fechamento`, { fechou: false, motivo: 'recusado', recontatar: null })
    expect(recusa.ficha.fechamento).toMatchObject({ situacao: 'arquivado', motivo: 'recusado', papel: 'atendimento-senior' })
  })

  it('recontatar marca a agenda no formato do servidor; o recontato remarca ou arquiva; fechou fica na ficha', async () => {
    const { fichaId, agendamentoId } = await entrevistaFeita()
    const url = `/api/fichas/${fichaId}/fechamento`
    await definir(agendamentoId, 'loas-idoso')

    const recontatar = await json('ana', 'POST', url, { fechou: false, motivo: 'sem-direito', recontatar: { data: '20/10/2026', espera: 'esperar' } })
    expect(recontatar.ficha.fechamento).toMatchObject({ situacao: 'recontatar', recontatarEm: '2026-10-20' })
    const marcado = recontatar.ficha.agendamentos.find((a: { oQue: string }) => a.oQue === 'Recontatar lead')
    expect(marcado.id.startsWith(`${fichaId}-ag-`)).toBe(true)
    expect(recontatar.ficha.fechamento.recontatoId).toBe(marcado.id)

    const novaData = await json('ana', 'POST', `/api/fichas/${fichaId}/recontato`, { resultado: 'nova-data', data: '27/10/2026' })
    expect(novaData.ficha.fechamento.recontatarEm).toBe('2026-10-27')
    expect(novaData.ficha.contatos.at(-1)).toMatchObject({ canal: 'Recontato', texto: 'Ainda não quer seguir; novo recontato em 27/10.' })
    expect((await json('ana', 'POST', `/api/fichas/${fichaId}/recontato`, { resultado: 'arquivar', motivo: 'recusado' })).erro).toBe('Motivo inválido.')
    const arquivou = await json('ana', 'POST', `/api/fichas/${fichaId}/recontato`, { resultado: 'arquivar', motivo: 'desistiu' })
    expect(arquivou.ficha.fechamento).toMatchObject({ situacao: 'arquivado', motivo: 'desistiu' })

    const outro = await entrevistaFeita('Marta Lima', '11955554444')
    await definir(outro.agendamentoId, 'loas-idoso')
    expect(await json('ana', 'POST', `/api/fichas/${outro.fichaId}/fechamento`, { fechou: true })).toMatchObject({
      fechou: true,
      beneficio: 'loas-idoso',
      ficha: { fechamento: { situacao: 'fechou', quem: 'ana' } },
    })
  })

  it('análise da ficha pelo Jurídico; nova demanda de quem já é cliente, com quem abriu pela sessão', async () => {
    const { fichaId, agendamentoId } = await entrevistaFeita()
    expect((await chamar('ana', 'POST', `/api/entrevistas/${agendamentoId}/analise`, { acidentario: true })).statusCode).toBe(403)
    const analise = await json('gabi', 'POST', `/api/entrevistas/${agendamentoId}/analise`, { acidentario: true })
    expect(analise.abertas.map((t: Tarefa) => t.acao)).toEqual(['Preencher segunda ficha', 'Renovar senha do gov.br'])
    expect(analise.ficha.analise).toMatchObject({ acidentario: true, quem: 'gabi' })

    expect((await json('ana', 'POST', `/api/fichas/${fichaId}/demandas`, { pretende: 'Outro pedido.', beneficio: 'auxilio-acidente', tipo: 'outro-pedido' })).erro).toBe(
      'Nova demanda é para quem já é cliente.',
    )
    const [cliente] = await banco.insert(pessoa).values({ nome: 'Paulo Reis', situacao: 'cliente' }).returning()
    const demanda = await json('gabi', 'POST', `/api/fichas/${cliente.id}/demandas`, { pretende: 'Quer pedir o auxílio-acidente.', beneficio: 'auxilio-acidente', tipo: 'outro-pedido' })
    expect(demanda.demanda).toMatchObject({ abertaPor: 'advogada', situacao: 'aberta', beneficio: 'auxilio-acidente', quem: 'gabi' })
    expect(demanda.ficha.beneficioInteresse).toBe('auxilio-acidente')
  })

  it('G9: "guardou" só com a senha no cofre do portal, que nunca fica na ficha; não sabe e renovação', async () => {
    const { fichaId, agendamentoId } = await entrevistaFeita()
    const url = `/api/fichas/${fichaId}/cofre/gov`
    expect((await json('ana', 'POST', url, { acao: 'guardou' })).erro).toBe(MSG_SENHA_FORA_DO_COFRE)
    expect((await chamar('ana', 'POST', `/api/pessoas/${fichaId}/cofre`, { senha: SENHA_GOV })).statusCode).toBe(201)
    expect((await json('ana', 'POST', url, { acao: 'guardou' })).senhaGov).toMatchObject({ situacao: 'no-cofre', por: 'ana' })
    expect((await json('gabi', 'GET', `/api/fichas/${fichaId}`)).senhaGov.situacao).toBe('no-cofre')
    expect(JSON.stringify(await banco.select().from(fichaRecepcao))).not.toContain(SENHA_GOV)

    const renovacao = `/api/entrevistas/${agendamentoId}/renovacao`
    const naoConseguiu = await json('ana', 'POST', renovacao, { resultado: 'nao-conseguiu', motivo: 'Esqueceu o e-mail da conta', aviseiOCliente: true })
    expect(naoConseguiu.ficha.contatos.at(-1)).toMatchObject({ canal: 'Aviso' })
    const renovou = await json('ana', 'POST', renovacao, { resultado: 'renovou', conferiMeuInss: true })
    expect(renovou.senhaGov).toMatchObject({ situacao: 'no-cofre', funcionouEm: '2026-10-08' })

    expect((await json('ana', 'POST', url, { acao: 'nao-sabe' })).senhaGov).toEqual({ situacao: 'sem-senha', naoSabe: true })
  })
})
