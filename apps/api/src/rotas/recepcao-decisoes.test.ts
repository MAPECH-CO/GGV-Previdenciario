import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, chamadaIa, fichaRecepcao, gravacaoRecepcao, pessoa, resultadoInss, tarefa, usuario } from '../banco/esquema.ts'
import { MSG_IA_DESLIGADA, MSG_IA_SEM_RESPOSTA } from '../fluxo/transcricao.ts'
import { MSG_SEM_REFERENCIA } from '../ia/acervo.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { cadastroDaFicha } from '../../../web/src/regras/cadastro.ts'
import type { Ficha } from '../../../web/src/dados/tipos.ts'
import { MSG_SENHA_FORA_DO_COFRE } from './recepcao-decisoes.ts'
import { calcularCnis } from '@ggv/contratos'
import { pontosDoCnis, pontosFalados, tempoDosDias, tempoFalado } from '../../../web/src/regras/calculo.ts'
import { pontosDeAtencao } from '../../../web/src/regras/preparacao.ts'

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
    // A API revalida o que veio do formulário, mesmo se a tela for contornada.
    for (const invalido of [{ cep: '123' }, { cep: '00000000' }, { cpf: '00000000192' }, { telefone: '123' }, { nascimento: '31/02/2026' }]) {
      const recusada = await chamar('gabi', 'PUT', `/api/fichas/${fichaId}/cadastro`, { base, valores: { ...valores, ...invalido } })
      expect(recusada.statusCode).toBe(400)
    }
    expect(await json('gabi', 'GET', `/api/fichas/${fichaId}`)).toEqual(ficha)
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

describe('GGVP-158 P3.4 · o cálculo de tempo e pontos sai do CNIS digitado, no servidor', () => {
  // Inventado: o vínculo atravessa a reforma (dias até 13/11/2019, competências depois).
  const CNIS = {
    origem: 'impresso',
    extraidoEm: '05/10/2026',
    calculo: { nascimento: '10/03/1962', referencia: '01/10/2026', vinculos: [{ inicio: '01/01/1990', fim: '30/09/2026', tempo: 'conferido', carencia: 'conferido' }], excecoes: [] },
  }
  // O que a tela manda hoje: os números digitados não valem; a regra e o "pode aposentar" valem.
  const REGISTRO = { podeAposentar: true, tempo: { anos: 1, meses: 0, dias: 0 }, pontos: 1, regra: 'Transição por pontos (EC 103, art. 15)', conferi: true }
  async function comCalculo() {
    const { fichaId, agendamentoId } = await entrevistaFeita()
    await definir(agendamentoId, 'aposentadoria-idade')
    return { fichaId, url: `/api/entrevistas/${agendamentoId}` }
  }

  it('o advogado digita o CNIS; o servidor roda o mesmo cálculo da tela, guarda e registra com os números dele', async () => {
    const { fichaId, url } = await comCalculo()
    const fechar = () => json('ana', 'POST', `/api/fichas/${fichaId}/fechamento`, { fechou: true })
    expect((await fechar()).erro).toBe('Falta calcular o tempo e os pontos: obrigatório antes de fechar.')
    expect((await chamar('ana', 'PUT', `${url}/cnis`, CNIS)).statusCode).toBe(403)
    const esperado = calcularCnis(CNIS.calculo, '08/10/2026')
    if (!esperado.ok) throw new Error('o CNIS do teste devia passar')
    const guardado = await json('gabi', 'PUT', `${url}/cnis`, CNIS)
    expect(guardado.cnis).toMatchObject({ origem: 'impresso', extraidoEm: '2026-10-05', entrada: CNIS.calculo, resultado: esperado, quem: 'gabi' })
    expect(guardado.ficha.historico.at(-1).oQue).toBe('Digitou o CNIS (impresso, extraído em 05/10/2026), com 1 vínculo; o cálculo do servidor deu ' +
      `${tempoFalado(tempoDosDias(esperado.diasTotais))}, ${pontosFalados(pontosDoCnis(esperado.pontos))} pontos e ${esperado.carencia} competências de carência`)
    expect(await json('gabi', 'GET', `${url}/calculo`)).toMatchObject({ exige: true, cnis: { resultado: esperado } })

    const r = await json('gabi', 'POST', `${url}/calculo`, REGISTRO)
    expect(r.ficha.calculos).toEqual([
      expect.objectContaining({
        tempo: tempoDosDias(esperado.diasTotais),
        pontos: pontosDoCnis(esperado.pontos),
        carencia: esperado.carencia,
        regra: REGISTRO.regra,
        podeAposentar: true,
        cnisOrigem: 'impresso',
        cnisExtraidoEm: '2026-10-05',
        versao: 'rgps-comum-1',
      }),
    ])
    // O cálculo registrado libera o "Sim, fechou".
    expect(await fechar()).toMatchObject({ fechou: true })
  })

  it('CNIS com erro é recusado com os erros do cálculo; com competência pendente, o cálculo não é registrado', async () => {
    const { url } = await comCalculo()
    const semVinculo = await chamar('gabi', 'PUT', `${url}/cnis`, { ...CNIS, calculo: { ...CNIS.calculo, vinculos: [] } })
    expect([semVinculo.statusCode, semVinculo.json().erro]).toEqual([400, 'Digite ao menos um vínculo.'])
    const futuro = await chamar('gabi', 'PUT', `${url}/cnis`, { ...CNIS, calculo: { ...CNIS.calculo, referencia: '01/12/2026' } })
    expect([futuro.statusCode, futuro.json().erro]).toEqual([400, 'A data de referência não pode ser futura.'])

    const pendente = { ...CNIS, calculo: { ...CNIS.calculo, vinculos: [{ ...CNIS.calculo.vinculos[0], tempo: 'pendente' }] } }
    expect((await chamar('gabi', 'PUT', `${url}/cnis`, pendente)).statusCode).toBe(200)
    const r = await chamar('gabi', 'POST', `${url}/calculo`, REGISTRO)
    expect([r.statusCode, r.json().erro]).toEqual([400, 'O CNIS tem competências pendentes: confira antes de registrar o cálculo.'])
  })
})

describe('GGVP-158 P7.4 · a sugestão de benefício vem do acervo de verdade', () => {
  // A IA é de mentira: devolve `saida` quando o pedido é a sugestão de benefício.
  let saida: object = {}
  let enviado = ''
  const SEM_IA = (motivo: string) => `Sem a sugestão da IA: ${motivo}. Defina o benefício pela lista do escritório.`
  const chamadas = async () => (await banco.select().from(chamadaIa).where(eq(chamadaIa.finalidade, 'sugerir_beneficio'))).length
  async function comIa() {
    await app.close()
    const fetch = async (_url: unknown, init?: RequestInit) => {
      const corpo = JSON.parse(String(init?.body)) as { messages: { content: string }[] }
      const doBeneficio = corpo.messages[0].content.includes('Você sugere o benefício')
      if (doBeneficio) enviado = corpo.messages[1].content
      return new Response(JSON.stringify({ choices: [{ message: { content: doBeneficio ? JSON.stringify(saida) : 'Texto.' } }] }))
    }
    const ambiente = { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' }
    app = criarServidor({ banco, agora: () => relogio, ia: criarIa({ banco, ambiente, fetch, agora: () => relogio }) })
  }
  // Inventada: a advogada cita o auxílio-doença, e o "desde" conferido é de junho.
  const FALAS = [
    { aos: 10, quem: 'Paula', papel: 'advogada', texto: 'O que aconteceu com o seu trabalho?' },
    { aos: 20, quem: 'Joana', papel: 'cliente', texto: 'Parei de trabalhar na limpeza por causa da coluna; tenho laudo do ortopedista.' },
    { aos: 30, quem: 'Paula', papel: 'advogada', texto: 'Então vamos pedir o auxílio-doença.' },
  ]
  const DESDE = { id: 'desde-0', rotulo: 'Sem trabalhar desde', valor: '06/2026', destino: 'processo', aos: 20, trecho: FALAS[1].texto, conferidaEm: relogio.toISOString() }
  /** A entrevista transcrita (o teste não tem áudio): as falas e o "desde" que a advogada conferiu. */
  async function transcrita() {
    const { fichaId, agendamentoId } = await entrevistaFeita()
    const [g] = await banco.select().from(gravacaoRecepcao).where(eq(gravacaoRecepcao.pessoaId, fichaId))
    await banco
      .update(gravacaoRecepcao)
      .set({ dados: { ...(g.dados as object), transcricao: 'pronta', trechos: FALAS, extraidas: [DESDE] } })
      .where(eq(gravacaoRecepcao.id, g.id))
    return { fichaId, url: `/api/entrevistas/${agendamentoId}/beneficio` }
  }
  /** Outro caso da casa, indeferido pela coluna: entra no acervo pelo motivo. */
  async function casoParecido() {
    const [p] = await banco.insert(pessoa).values({ nome: 'Rita Souza' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'auxilio_incapacidade_temporaria', fase: 'administrativa' }).returning()
    await banco.insert(resultadoInss).values({ casoId: c.id, resultado: 'indeferido', dataDecisao: '2026-09-01', motivoEscrito: 'A perícia não viu incapacidade da coluna; faltou o laudo do ortopedista.' })
  }

  it('a sugestão fica pronta na rodada, com as fontes do acervo; a tela abre e a decisão registra a mesma, sem chamar de novo', async () => {
    await comIa()
    const { url } = await transcrita()
    await casoParecido()
    saida = { sugerido: 'incapacidade-temporaria', alternativa: 'incapacidade-permanente', porque: 'Parou de trabalhar pela coluna, com laudo, como um caso da casa.' }
    await app.prepararSugestoes()
    expect(await chamadas()).toBe(1)
    for (const trecho of ['Benefício de interesse: ', 'Parei de trabalhar na limpeza', 'Motivo de indeferimento: ']) expect(enviado).toContain(trecho)
    expect((await chamar('ana', 'GET', url)).statusCode).toBe(403)
    const d = await json('gabi', 'GET', url)
    expect(d).toMatchObject({ transcrita: true, citado: 'incapacidade-temporaria', aviso: null, dados: { semTrabalharDesde: '06/2026' } })
    expect(d.sugestao).toMatchObject({ sugerido: 'incapacidade-temporaria', alternativa: 'incapacidade-permanente', porque: 'Parou de trabalhar pela coluna, com laudo, como um caso da casa.' })
    expect(d.sugestao.fontes).toEqual([expect.objectContaining({ tipo: 'acervo', trecho: expect.stringContaining('ortopedista') })])
    // Os requisitos são do código (G19): sem CNIS, a carência fica sem resposta; o afastamento conta do "desde" conferido.
    expect(d.sugestao.requisitos.map((r: { atende: boolean | null }) => r.atende)).toEqual([null, true])
    expect(await chamadas()).toBe(1)
    const def = await json('gabi', 'POST', url, { beneficio: 'incapacidade-temporaria', conferi: true })
    expect(def.ficha.beneficioDefinido).toMatchObject({ citado: 'incapacidade-temporaria', sugerido: 'incapacidade-temporaria', recusouSugestao: false, fontes: [d.sugestao.fontes[0].referencia] })
    expect(await chamadas()).toBe(1)
  })

  it('sem caso parecido, o porquê diz que não há referência na casa; benefício fora do catálogo não vale', async () => {
    await comIa()
    const { url } = await transcrita()
    saida = { sugerido: 'auxilio-inventado', porque: 'Qualquer coisa.' }
    const fora = await json('gabi', 'GET', url)
    expect([fora.sugestao, fora.aviso, fora.citado]).toEqual([null, SEM_IA(MSG_IA_SEM_RESPOSTA), 'incapacidade-temporaria'])
    saida = { sugerido: 'loas-idoso', alternativa: null, porque: 'Tem 66 anos e procura o BPC.' }
    const d = await json('gabi', 'GET', url)
    expect(d.sugestao).toMatchObject({ sugerido: 'loas-idoso', porque: `${MSG_SEM_REFERENCIA} Tem 66 anos e procura o BPC.`, fontes: [] })
    expect(d.sugestao.alternativa).toBeUndefined()
  })

  it('a advogada recusa: a recusa fica no histórico, com o motivo e a sugestão recusada; a carência vem do CNIS registrado', async () => {
    await comIa()
    const { url } = await transcrita()
    const entrevista = url.replace('/beneficio', '')
    await json('gabi', 'POST', url, { beneficio: 'aposentadoria-idade', conferi: true })
    // Inventado: 13 competências de carência, de 09/2025 a 09/2026.
    const calculo = { nascimento: '10/03/1980', referencia: '01/10/2026', vinculos: [{ inicio: '01/09/2025', fim: '30/09/2026', tempo: 'conferido', carencia: 'conferido' }], excecoes: [] }
    expect((await chamar('gabi', 'PUT', `${entrevista}/cnis`, { origem: 'impresso', extraidoEm: '05/10/2026', calculo })).statusCode).toBe(200)
    saida = { sugerido: 'incapacidade-permanente', porque: 'A coluna não melhora.' }
    const d = await json('gabi', 'GET', url)
    expect(d.dados.carencia).toBe(13)
    expect(d.sugestao.requisitos).toEqual([{ texto: 'Carência: 13 contribuições no CNIS; o mínimo é 12 (calculado por código, G19)', atende: true }])
    const r = await json('gabi', 'POST', url, { beneficio: 'auxilio-acidente', conferi: true, motivoDaRecusa: 'Foi acidente no trabalho.' })
    expect(r.ficha.beneficioDefinido).toMatchObject({ beneficio: 'auxilio-acidente', sugerido: 'incapacidade-permanente', recusouSugestao: true, motivoDaRecusa: 'Foi acidente no trabalho.' })
    expect(r.ficha.historico.map((e: { oQue: string }) => e.oQue)).toContain('Recusou a sugestão da IA (Aposentadoria por Incapacidade Permanente): Foi acidente no trabalho.')
  })

  it('sem a IA: não há sugestão, o aviso diz o motivo e o citado segue; a decisão grava sem sugestão', async () => {
    const { url } = await transcrita()
    const d = await json('gabi', 'GET', url)
    expect(d).toMatchObject({ transcrita: true, sugestao: null, citado: 'incapacidade-temporaria', aviso: SEM_IA(MSG_IA_DESLIGADA) })
    const def = await json('gabi', 'POST', url, { beneficio: 'incapacidade-temporaria', conferi: true })
    expect(def.ficha.beneficioDefinido).toMatchObject({ citado: 'incapacidade-temporaria', recusouSugestao: false, fontes: [] })
    expect(def.ficha.historico.map((e: { oQue: string }) => e.oQue)).toContainEqual(expect.stringMatching(/· o que citou na entrevista \(G3\)$/))
  })
})

describe('GGVP-158 P7.2 · o fechamento do lead é linha da Central, da pessoa, sem caso', () => {
  type Linha = { id: string; casoId: string | null; titulo: string; detalhe: string; prazo: string | null; tela: string | null; cliente: { id: string } | null }
  const linha = async (apelido: string, id: string) => ((await json(apelido, 'GET', '/api/tarefas')) as Linha[]).find((t) => t.id === id)

  it('a entrevista feita abre "Registrar fechamento" na Central do Atendimento; o líder atribui pelo id da tela; registrar fecha', async () => {
    const { fichaId, agendamentoId } = await entrevistaFeita()
    const id = `fechamento-${fichaId}`
    expect(await linha('ana', id)).toMatchObject({
      casoId: null,
      passo: 'D1.14',
      cliente: { id: fichaId, nome: 'Joana Ribeiro' },
      titulo: 'Registrar fechamento',
      detalhe: expect.stringMatching(/ · entrevista em /),
      tela: `/clientes/${fichaId}/fechamento`,
      prazo: '2026-10-09',
    })
    // GGVP-147: a atribuição do líder vale pelo mesmo id.
    const [ana] = await banco.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, 'ana@exemplo.ggv'))
    expect((await json('eva', 'GET', '/api/setor')).tarefas.map((t: { id: string }) => t.id)).toContain(id)
    expect((await chamar('eva', 'POST', '/api/setor/atribuicoes', { tarefaId: id, responsavelId: ana.id })).statusCode).toBe(201)
    expect((await json('ana', 'GET', '/api/setor/minhas')).minhas.map((t: { id: string }) => t.id)).toEqual([id])

    await definir(agendamentoId, 'loas-idoso')
    await json('ana', 'POST', `/api/fichas/${fichaId}/fechamento`, { fechou: false, motivo: 'preco', detalhe: 'achou caro', recontatar: null })
    expect(await linha('ana', id)).toBeUndefined()
    expect((await banco.select({ situacao: tarefa.situacao }).from(tarefa).where(eq(tarefa.pessoaId, fichaId))).map((t) => t.situacao)).toEqual(['concluida'])
  })

  it('o recontato entra na data, pela rodada; antes, não', async () => {
    const { fichaId, agendamentoId } = await entrevistaFeita()
    await definir(agendamentoId, 'loas-idoso')
    await json('ana', 'POST', `/api/fichas/${fichaId}/fechamento`, { fechou: false, motivo: 'sem-direito', recontatar: { data: '20/10/2026', espera: 'esperar' } })
    const doLead = () =>
      banco.select({ titulo: tarefa.titulo, casoId: tarefa.casoId, prazo: tarefa.prazo, situacao: tarefa.situacao }).from(tarefa).where(eq(tarefa.pessoaId, fichaId))
    expect(await doLead()).toEqual([{ titulo: 'Registrar fechamento', casoId: null, prazo: '2026-10-09', situacao: 'concluida' }])
    const noDia = criarServidor({ banco, agora: () => new Date('2026-10-20T15:00:00Z') })
    await noDia.sincronizarRecepcao()
    await noDia.close()
    expect(await doLead()).toContainEqual({ titulo: 'Recontatar lead', casoId: null, prazo: '2026-10-20', situacao: 'aberta' })
  })
})

describe('GGVP-158 P7.2 · a entrevista que passou sem registro é linha da Central (teste do Pedro, 14/10)', () => {
  const MARCACAO = { tipo: 'presencial', data: '2026-10-09', hora: '14:00', duracao: 45, com: 'paula', gravar: false, levar: false, pedirFicha: false, confirmarHorarioOcupado: true }
  const confirmar = (fichaId: string) =>
    banco
      .select({ prazo: tarefa.prazo, situacao: tarefa.situacao, detalhe: tarefa.detalhe })
      .from(tarefa)
      .where(and(eq(tarefa.pessoaId, fichaId), eq(tarefa.titulo, 'Confirmar se a entrevista aconteceu')))
  /** O mesmo banco, com o relógio em 14/10 (o dia do teste do Pedro). */
  const em14 = () => criarServidor({ banco, agora: () => new Date('2026-10-14T15:00:00Z') })

  it('abre na virada do dia, pela rodada, atrasada na Central do Atendimento; marcar realizado fecha', async () => {
    const fichaId = await lead()
    const agendamentoId = (await json('ana', 'POST', `/api/fichas/${fichaId}/agendamentos`, MARCACAO)).agendamento.id as string
    expect(await confirmar(fichaId), 'antes do dia, nada').toEqual([])

    const depois = em14()
    await depois.sincronizarRecepcao()
    expect(await confirmar(fichaId)).toEqual([{ prazo: '2026-10-09', situacao: 'aberta', detalhe: 'fazer entrevista de 09/10 às 14:00 · marcar realizado ou faltou' }])
    const sessao = await depois.inject({ method: 'POST', url: '/api/sessao', payload: { email: 'ana@exemplo.ggv', senha: SENHA } })
    const cookies = { [COOKIE]: sessao.cookies.find((c) => c.name === COOKIE)!.value }
    const central = (await depois.inject({ method: 'GET', url: '/api/tarefas', cookies })).json() as { id: string }[]
    expect(central.find((t) => t.id === `confirmar-${fichaId}`)).toMatchObject({
      passo: 'D1.03',
      cliente: { id: fichaId, nome: 'Joana Ribeiro' },
      titulo: 'Confirmar se a entrevista aconteceu',
      prazo: '2026-10-09',
      urgente: true,
      tela: '/agenda?ver=lista',
    })

    const r = await depois.inject({ method: 'POST', url: `/api/agendamentos/${agendamentoId}/resultado`, cookies, payload: { resultado: 'realizado' } })
    expect(r.statusCode, r.body).toBe(200)
    expect((await confirmar(fichaId)).map((t) => t.situacao)).toEqual(['concluida'])
    await depois.close()
  })

  it('o compromisso remarcado não abre a linha; o novo, ainda no futuro, também não', async () => {
    const fichaId = await lead()
    const agendamentoId = (await json('ana', 'POST', `/api/fichas/${fichaId}/agendamentos`, MARCACAO)).agendamento.id as string
    const remarcou = await chamar('ana', 'POST', `/api/fichas/${fichaId}/agendamentos`, { ...MARCACAO, data: '2026-10-20', remarcar: { agendamentoId, motivo: 'o cliente pediu outro dia' } })
    expect(remarcou.statusCode, remarcou.body).toBe(200)
    const depois = em14()
    await depois.sincronizarRecepcao()
    await depois.close()
    expect(await confirmar(fichaId)).toEqual([])
  })
})

describe('GGVP-36 e GGVP-28 · a análise da ficha abre as pendências do Atendimento, no servidor', () => {
  type Pendencia = { acao: string; setor: string; codigo: string; prazo: string; urgente: boolean; detalhe: string; href: string; cliente: { id: string } }
  const PENDENCIAS = ['Renovar senha do gov.br', 'Preencher segunda ficha']
  /** As pendências da análise que o Atendimento tem abertas, na lista da Recepção que a Central dele lê. */
  const doAtendimento = async (fichaId: string) =>
    ((await json('ana', 'GET', '/api/recepcao')).tarefas as Pendencia[]).filter((t) => t.cliente.id === fichaId && PENDENCIAS.includes(t.acao))
  const analisar = (agendamentoId: string, acidentario: boolean) => json('gabi', 'POST', `/api/entrevistas/${agendamentoId}/analise`, { acidentario })
  async function comSenhaNoCofre(fichaId: string) {
    expect((await chamar('ana', 'POST', `/api/pessoas/${fichaId}/cofre`, { senha: SENHA_GOV })).statusCode).toBe(201)
    await json('ana', 'POST', `/api/fichas/${fichaId}/cofre/gov`, { acao: 'guardou' })
  }
  /** O que a advogada vê da senha na preparação da entrevista: a ficha do servidor pela regra da tela. */
  const pontoDaSenha = async (fichaId: string) => pontosDeAtencao((await json('gabi', 'GET', `/api/fichas/${fichaId}`)) as Ficha, '2026-10-08').find((p) => p.tipo === 'senha')?.texto

  it('GGVP-36 CA1 · a análise de quem está sem senha abre "Renovar senha do gov.br" para o Atendimento; com a senha no cofre, não', async () => {
    const { fichaId, agendamentoId } = await entrevistaFeita()
    await analisar(agendamentoId, false)
    expect((await doAtendimento(fichaId)).map((t) => [t.acao, t.setor, t.codigo, t.href])).toEqual([
      ['Renovar senha do gov.br', 'Atendimento', 'D1.08', `/entrevista/${agendamentoId}/renovar-senha`],
    ])
    const outra = await entrevistaFeita('Marta Lima', '11955554444')
    await comSenhaNoCofre(outra.fichaId)
    expect((await analisar(outra.agendamentoId, false)).abertas).toEqual([])
    expect(await doAtendimento(outra.fichaId)).toEqual([])
  })

  it('GGVP-36 CA4 · o prazo da renovação é o horário da entrevista: amanhã com a data; hoje, só a hora e urgente', async () => {
    const amanha = await entrevistaFeita()
    await analisar(amanha.agendamentoId, false)
    expect((await doAtendimento(amanha.fichaId)).map((t) => [t.acao, t.prazo, t.urgente])).toEqual([['Renovar senha do gov.br', 'até 09/10 14:00', false]])
    const fichaId = await lead('Marta Lima', '11955554444')
    const HOJE = { tipo: 'presencial', data: '2026-10-08', hora: '16:00', duracao: 45, com: 'paula', gravar: true, levar: true, pedirFicha: true, confirmarHorarioOcupado: true }
    const agendamentoId = (await json('ana', 'POST', `/api/fichas/${fichaId}/agendamentos`, HOJE)).agendamento.id as string
    await analisar(agendamentoId, false)
    expect((await doAtendimento(fichaId)).map((t) => [t.acao, t.prazo, t.urgente])).toEqual([['Renovar senha do gov.br', 'até 16:00', true]])
  })

  it('GGVP-36 CA7 · a advogada vê o resultado da renovação na ficha da entrevista: "não conseguiu", com o motivo, e depois "renovou"', async () => {
    const { fichaId, agendamentoId } = await entrevistaFeita()
    await analisar(agendamentoId, false)
    expect(await pontoDaSenha(fichaId)).toBe('Sem senha do gov.br · o Atendimento ainda não tentou renovar')
    const renovacao = `/api/entrevistas/${agendamentoId}/renovacao`
    await json('ana', 'POST', renovacao, { resultado: 'nao-conseguiu', motivo: 'Esqueceu o e-mail da conta', aviseiOCliente: true })
    expect((await json('gabi', 'GET', `/api/fichas/${fichaId}`)).renovacao).toMatchObject({ resultado: 'nao-conseguiu', motivo: 'Esqueceu o e-mail da conta', quem: 'ana' })
    expect(await pontoDaSenha(fichaId)).toBe('Sem senha do gov.br · o Atendimento tentou renovar e não conseguiu: Esqueceu o e-mail da conta')
    // A renovação feita fecha a pendência do Atendimento.
    expect((await doAtendimento(fichaId)).map((t) => t.acao)).toEqual([])
    expect((await chamar('ana', 'POST', `/api/pessoas/${fichaId}/cofre`, { senha: SENHA_GOV })).statusCode).toBe(201)
    await json('ana', 'POST', renovacao, { resultado: 'renovou', conferiMeuInss: true })
    expect((await json('gabi', 'GET', `/api/fichas/${fichaId}`)).renovacao).toMatchObject({ resultado: 'renovou', quem: 'ana' })
    expect(await pontoDaSenha(fichaId)).toBe('Senha do gov.br no cofre · funcionou pela última vez em 08/10')
    expect(JSON.stringify(await json('gabi', 'GET', `/api/fichas/${fichaId}`))).not.toContain(SENHA_GOV)
  })

  it('GGVP-28 CA1 · "pode ser acidentário" abre para o Atendimento a pendência de passar a segunda ficha, uma só; "não é", não abre', async () => {
    const { fichaId, agendamentoId } = await entrevistaFeita()
    await comSenhaNoCofre(fichaId)
    const analise = await analisar(agendamentoId, true)
    expect(analise.ficha.analise).toMatchObject({ acidentario: true, quem: 'gabi' })
    const esperada = [
      'Preencher segunda ficha',
      'Atendimento',
      'D1.07',
      'até 09/10 14:00',
      'FICHA DE ATENDIMENTO AUXILIO ACIDENTE em papel, preenchida pela cliente e escaneada antes da entrevista',
      `/clientes/${fichaId}/segunda-ficha`,
    ]
    const resumo = (t: Pendencia) => [t.acao, t.setor, t.codigo, t.prazo, t.detalhe, t.href]
    expect(analise.abertas.map(resumo)).toEqual([esperada])
    expect((await doAtendimento(fichaId)).map(resumo)).toEqual([esperada])
    await analisar(agendamentoId, true)
    expect(await doAtendimento(fichaId)).toHaveLength(1)

    const outra = await entrevistaFeita('Marta Lima', '11955554444')
    await comSenhaNoCofre(outra.fichaId)
    expect((await analisar(outra.agendamentoId, false)).abertas).toEqual([])
    expect(await doAtendimento(outra.fichaId)).toEqual([])
  })
})
