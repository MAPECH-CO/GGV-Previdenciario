import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, configuracao, gravacaoRecepcao, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_CONFIRMACAO_NA_SENIOR } from './recepcao-agenda.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
// Quinta, 08/10/2026, meio-dia em Brasília.
let relogio = new Date('2026-10-08T15:00:00Z')

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const json = async (apelido: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) => (await chamar(apelido, method, url, payload)).json()

async function lead(nome: string, telefone: string) {
  return (await json('ana', 'POST', '/api/fichas', { nome, idade: 66, pretende: 'Quer saber do BPC.', telefone, beneficioInteresse: 'loas-idoso', outraPessoa: false })).id as string
}
const MARCACAO = { tipo: 'presencial', data: '2026-10-09', hora: '14:00', duracao: 45, com: 'paula', gravar: true, levar: true, pedirFicha: true, confirmarHorarioOcupado: false }
const marcar = (fichaId: string, extra: object = {}) => json('ana', 'POST', `/api/fichas/${fichaId}/agendamentos`, { ...MARCACAO, ...extra })
const tarefasAbertas = async (apelido = 'ana') => (await json(apelido, 'GET', '/api/recepcao')).tarefas.map((t: { acao: string; setor: string }) => `${t.acao} · ${t.setor}`)

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  relogio = new Date('2026-10-08T15:00:00Z')
  app = criarServidor({ banco, agora: () => relogio })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['gabi', 'advogada'], ['helena', 'senior'], ['julia', 'financeiro']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-125 · bloco 2: agenda e confirmação no servidor', () => {
  it('a agenda é do escritório: horário ocupado avisa para todos, e a remarcação tem limite (G15)', async () => {
    const joana = await lead('Joana Ribeiro', '11987654321')
    const marta = await lead('Marta Lima', '11955554444')
    const marcada = await marcar(joana)
    expect(marcada).toMatchObject({ resultado: 'marcado', agendamento: { data: '2026-10-09', hora: '14:00', com: 'Dra. Paula', estado: 'marcado', remarcacoes: 0 } })
    expect(marcada.agendamento.id.startsWith(`${joana}-ag-`)).toBe(true)
    expect(marcada.ficha.historico.at(-1)).toMatchObject({ quem: 'ana', oQue: 'Marcou a entrevista para 09/10 às 14:00 (presencial) com Dra. Paula' })

    // Outra pessoa, no mesmo horário: avisa, e marca só se confirmar (duas salas).
    expect(await marcar(marta)).toMatchObject({ resultado: 'ocupado', conflitos: [{ titulo: 'Joana Ribeiro', oQue: 'Fazer entrevista' }] })
    expect(await marcar(marta, { confirmarHorarioOcupado: true })).toMatchObject({ resultado: 'marcado' })
    // A advogada, no computador dela, vê a agenda.
    const copia = await json('gabi', 'GET', '/api/recepcao')
    expect(copia.fichas.find((f: { id: string }) => f.id === joana).agendamentos).toHaveLength(1)

    let atual = marcada.agendamento.id
    for (const [n, data] of [[1, '2026-10-13'], [2, '2026-10-14']] as const) {
      const r = await marcar(joana, { data, hora: '10:30', remarcar: { agendamentoId: atual, motivo: 'pediu outro dia' } })
      expect(r).toMatchObject({ resultado: 'marcado', agendamento: { remarcacoes: n } })
      atual = r.agendamento.id
    }
    expect(await marcar(joana, { data: '2026-10-15', remarcar: { agendamentoId: atual, motivo: 'de novo' } })).toEqual({ resultado: 'limite' })
    const ficha = await json('ana', 'GET', `/api/fichas/${joana}`)
    expect(ficha.agendamentos.map((a: { estado: string }) => a.estado)).toEqual(['remarcado', 'remarcado', 'marcado'])
    expect(ficha.contatos.at(-1)).toEqual({ data: '2026-10-08', canal: 'Remarcação', texto: 'pediu outro dia' })

    expect((await chamar('ana', 'POST', `/api/fichas/${joana}/agendamentos`, { ...MARCACAO, hora: '13:00' })).statusCode).toBe(400)
    expect((await chamar('ana', 'POST', `/api/fichas/${joana}/agendamentos`, { ...MARCACAO, data: '2026-10-07' })).statusCode).toBe(400)
  })

  it('confirmou sem ficha: a pendência do Atendimento; a ficha salva abre o "Preparar entrevista" da advogada', async () => {
    const joana = await lead('Joana Ribeiro', '11987654321')
    const { agendamento } = await marcar(joana)
    const convite = await json('ana', 'POST', `/api/agendamentos/${agendamento.id}/convite`, { mensagem: 'Olá, Joana! Sua entrevista é sexta às 14h.' })
    expect(convite.ficha.contatos.at(-1)).toMatchObject({ canal: 'Chatwoot', texto: 'Convite da entrevista de 09/10 às 14:00: Olá, Joana! Sua entrevista é sexta às 14h.' })
    expect(convite.ficha.agendamentos[0].conviteEnviadoEm).toBeDefined()

    const r = await json('ana', 'POST', `/api/agendamentos/${agendamento.id}/confirmacao`, { resultado: 'confirmou', canal: 'ligacao', jaPreencheuFicha: false })
    expect(r).toMatchObject({ tentativa: 1, naSenior: false, tarefa: { acao: 'Preencher ficha', setor: 'Atendimento' } })
    expect(await tarefasAbertas()).toEqual(['Preencher ficha · Atendimento'])

    const ENVIO = { nome: 'Joana Ribeiro', cpf: '52998224725', nascimento: '10/05/1958', telefone: '11987654321', beneficioInteresse: 'loas-idoso', origem: 'papel', modelo: 'GGV' }
    const salva = await json('ana', 'PUT', `/api/fichas/${joana}/ficha-de-atendimento`, ENVIO)
    expect(salva.tarefas.map((t: { acao: string; concluida?: boolean }) => [t.acao, t.concluida ?? false])).toEqual([
      ['Preencher ficha', true],
      ['Preparar entrevista', false],
    ])
    expect(await tarefasAbertas('gabi')).toEqual(['Preparar entrevista · Jurídico'])
    expect(salva.ficha.historico.at(-1).oQue).toBe('Mandou ao Jurídico: preparar a entrevista de 09/10 às 14:00')
  })

  it('entrevista iniciada na hora segue o BPMN: sem ficha, "Preencher ficha"; a ficha salva abre o "Preparar entrevista"', async () => {
    const joana = await lead('Joana Ribeiro', '11987654321')
    const r = await json('ana', 'POST', `/api/fichas/${joana}/entrevistas/agora`, { tipo: 'presencial', com: 'paula', duracao: 45, gravar: true })
    // A pessoa está no balcão: a presença já está confirmada.
    expect(r.agendamento.confirmacao).toEqual({ tentativas: [], presente: true })
    // Lead novo sem a ficha de atendimento (D1.05 antes do D1.06): o Atendimento preenche primeiro.
    expect(r.tarefas).toMatchObject([{ acao: 'Preencher ficha', setor: 'Atendimento' }])
    expect(await tarefasAbertas('gabi')).toEqual(['Preencher ficha · Atendimento'])

    const ENVIO = { nome: 'Joana Ribeiro', cpf: '52998224725', nascimento: '10/05/1958', telefone: '11987654321', beneficioInteresse: 'loas-idoso', origem: 'papel', modelo: 'GGV' }
    await json('ana', 'PUT', `/api/fichas/${joana}/ficha-de-atendimento`, ENVIO)
    expect(await tarefasAbertas('gabi')).toEqual(['Preparar entrevista · Jurídico'])

    // Com a ficha já preenchida, a advogada recebe direto o "Preparar entrevista".
    const outra = await json('ana', 'POST', `/api/fichas/${joana}/entrevistas/agora`, { tipo: 'presencial', com: 'paula', duracao: 45, gravar: true })
    expect(outra.tarefas).toMatchObject([{ acao: 'Preparar entrevista', setor: 'Jurídico', href: `/entrevista/${outra.agendamento.id}/preparar` }])
  })

  it('G15 na confirmação: a segunda sem resposta passa à advogada sênior, e só no dia da nova tentativa', async () => {
    const joana = await lead('Joana Ribeiro', '11987654321')
    const { agendamento } = await marcar(joana, { data: '2026-10-20' })
    const url = `/api/agendamentos/${agendamento.id}/confirmacao`
    expect(await json('ana', 'POST', url, { resultado: 'sem-resposta', canal: 'mensagem' })).toMatchObject({ tentativa: 1, proximaEm: '2026-10-11', naSenior: false })
    expect((await json('ana', 'POST', url, { resultado: 'sem-resposta', canal: 'mensagem' })).erro).toBe('A próxima tentativa é em 11/10.')

    relogio = new Date('2026-10-11T15:00:00Z')
    expect(await json('ana', 'POST', url, { resultado: 'sem-resposta', canal: 'ligacao' })).toMatchObject({
      tentativa: 2,
      naSenior: true,
      tarefa: { id: `confirmar-senior-${agendamento.id}`, setor: 'Jurídico' },
    })
    expect(await tarefasAbertas()).toEqual(['Confirmar agendamento · Jurídico'])
    // A sênior consegue falar com o lead: a tarefa dela sai.
    await json('helena', 'POST', url, { resultado: 'confirmou', canal: 'ligacao', jaPreencheuFicha: true })
    expect(await tarefasAbertas()).toEqual(['Preparar entrevista · Jurídico'])
  })

  it('GGVP-158 E3 e E4 (15/10) · a escalada da confirmação é tarefa da Sênior, na fila dela; depois de subir, o Atendimento não registra outra tentativa; confirmada, a linha some', async () => {
    const joana = await lead('Joana Ribeiro', '11987654321')
    const { agendamento } = await marcar(joana, { data: '2026-10-20' })
    const url = `/api/agendamentos/${agendamento.id}/confirmacao`
    const filaDaSenior = async () =>
      (await json('helena', 'GET', '/api/tarefas')).map((t: { titulo: string; tela: string | null; urgente: boolean; cliente: { id: string } | null }) => [t.titulo, t.tela, t.urgente, t.cliente?.id])
    await json('ana', 'POST', url, { resultado: 'sem-resposta', canal: 'mensagem' })
    expect(await filaDaSenior()).toEqual([])
    relogio = new Date('2026-10-11T15:00:00Z')
    expect(await json('ana', 'POST', url, { resultado: 'sem-resposta', canal: 'ligacao' })).toMatchObject({ tentativa: 2, naSenior: true })
    // E3: a Sênior vê a escalada na própria fila (G15), com a tela da agenda; a advogada, não.
    expect(await filaDaSenior()).toEqual([['Confirmar agendamento', '/agenda?ver=lista', true, joana]])
    expect((await json('gabi', 'GET', '/api/tarefas')).map((t: { titulo: string }) => t.titulo)).toEqual([])
    // E4: depois de subir, o Atendimento não registra outra tentativa (409), como na cobrança.
    const outra = await chamar('ana', 'POST', url, { resultado: 'sem-resposta', canal: 'mensagem' })
    expect([outra.statusCode, outra.json().erro]).toEqual([409, MSG_CONFIRMACAO_NA_SENIOR])
    // A Sênior confirma: a linha sai da fila dela.
    await json('helena', 'POST', url, { resultado: 'confirmou', canal: 'ligacao', jaPreencheuFicha: true })
    expect(await filaDaSenior()).toEqual([])
  })

  it('GGVP-158 P5.3 · a confirmação usa os limites da Configuração: com 3 tentativas a cada 2 dias, a segunda não sobe', async () => {
    await banco.insert(configuracao).values([
      { chave: 'confirmacao.limite', valor: 3 },
      { chave: 'confirmacao.intervalo_dias', valor: 2 },
    ])
    const joana = await lead('Joana Ribeiro', '11987654321')
    const { agendamento } = await marcar(joana, { data: '2026-10-20' })
    const url = `/api/agendamentos/${agendamento.id}/confirmacao`
    expect(await json('ana', 'POST', url, { resultado: 'sem-resposta', canal: 'mensagem' })).toMatchObject({ tentativa: 1, proximaEm: '2026-10-10', naSenior: false })
    relogio = new Date('2026-10-10T15:00:00Z')
    expect(await json('ana', 'POST', url, { resultado: 'sem-resposta', canal: 'ligacao' })).toMatchObject({ tentativa: 2, proximaEm: '2026-10-12', naSenior: false })
    expect(await tarefasAbertas()).not.toContain('Confirmar agendamento · Jurídico')
  })

  it('no dia: o balcão encaminha, "realizado" abre o "Cadastrar lead"; compromisso interno ocupa a agenda', async () => {
    const joana = await lead('Joana Ribeiro', '11987654321')
    const { agendamento } = await marcar(joana, { data: '2026-10-08', hora: '16:00' })
    const enc = await json('ana', 'POST', `/api/fichas/${joana}/encaminhamentos`, { motivo: 'entrevista', setor: 'Jurídico' })
    expect(enc.tarefa).toMatchObject({ codigo: 'D1.03', acao: 'Receber para a entrevista', setor: 'Jurídico' })
    expect(enc.tarefa.detalhe).toMatch(/ · chegou ao balcão às 12:00 · entrevista hoje 16:00$/)
    expect(enc.evento.oQue).toBe('Encaminhou ao Jurídico para a entrevista das 16:00, com a ficha e o agendamento')

    const feito = await json('ana', 'POST', `/api/agendamentos/${agendamento.id}/resultado`, { resultado: 'realizado' })
    expect(feito.tarefas.map((t: { acao: string; concluida?: boolean }) => [t.acao, t.concluida ?? false])).toEqual([
      ['Receber para a entrevista', true],
      ['Cadastrar lead', false],
    ])
    expect((await json('ana', 'POST', `/api/agendamentos/${agendamento.id}/resultado`, { resultado: 'faltou' })).erro).toBe('Este compromisso já foi registrado.')

    const interno = await json('ana', 'POST', '/api/agenda/internos', { titulo: 'Gravação do vídeo', data: '2026-10-09', hora: '10:00', duracao: 60, responsavel: 'atendimento' })
    expect(interno.evento).toMatchObject({ oQue: 'Compromisso interno', responsavel: 'Você (Atendimento)', estado: 'agendado' })
    expect(await marcar(joana, { hora: '10:30' })).toMatchObject({ resultado: 'ocupado', conflitos: [{ titulo: 'Gravação do vídeo' }] })
    expect((await json('ana', 'POST', `/api/agendamentos/${interno.interno.id}/resultado`, { resultado: 'realizado' })).evento.oQue).toBe('Realizado: Gravação do vídeo')
    expect((await json('gabi', 'GET', '/api/recepcao')).internos).toMatchObject([{ titulo: 'Gravação do vídeo', estado: 'realizado' }])

    const agora = await json('ana', 'POST', `/api/fichas/${joana}/entrevistas/agora`, { tipo: 'presencial', com: 'paula', duracao: 45, gravar: true })
    expect(agora.agendamento).toMatchObject({ data: '2026-10-08', hora: '12:00', com: 'Dra. Paula' })
  })

  it('perfil da sessão: o Financeiro não marca, e a cópia das telas pede a sessão', async () => {
    const joana = await lead('Joana Ribeiro', '11987654321')
    expect((await chamar('julia', 'POST', `/api/fichas/${joana}/agendamentos`, MARCACAO)).statusCode).toBe(403)
    expect((await app.inject({ method: 'GET', url: '/api/recepcao' })).statusCode).toBe(401)
  })
})

describe('GGVP-158 P3.6 · a agenda marca com as advogadas e as Sêniores reais', () => {
  const idDe = async (apelido: string) => (await banco.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, `${apelido}@exemplo.ggv`)))[0].id

  it('a equipe: só o id e o nome de quem tem o perfil pedido; quem não marca não vê; perfil fora da matriz, recusa', async () => {
    expect(await json('ana', 'GET', '/api/equipe?perfis=advogada,senior')).toEqual([
      { id: await idDe('gabi'), nome: 'gabi' },
      { id: await idDe('helena'), nome: 'helena' },
    ])
    expect((await chamar('julia', 'GET', '/api/equipe?perfis=advogada')).statusCode).toBe(403)
    for (const perfis of ['', 'root', 'advogada,root']) expect((await chamar('ana', 'GET', `/api/equipe?perfis=${perfis}`)).statusCode, perfis).toBe(400)
  })

  it('a marcação com alguém da equipe guarda o id e o nome; quem não é advogada nem Sênior é recusado', async () => {
    const gabi = await idDe('gabi')
    const r = await marcar(await lead('Joana Ribeiro', '11987654321'), { com: gabi })
    expect(r.agendamento).toMatchObject({ com: 'gabi', comId: gabi })
    const outro = await lead('Maria Souza', '11912345678')
    expect((await chamar('ana', 'POST', `/api/fichas/${outro}/agendamentos`, { ...MARCACAO, com: await idDe('julia'), hora: '16:00' })).statusCode).toBe(400)
    // O catálogo fixo segue aceito até a tela usar a equipe real, sem o id.
    const antigo = await marcar(outro, { hora: '16:00' })
    expect(antigo.agendamento).toMatchObject({ com: 'Dra. Paula' })
    expect(antigo.agendamento.comId).toBeUndefined()
  })
})

describe('GGVP-158 P3.7 · a desistência antes da entrevista fica no servidor (G16)', () => {
  const resultado = (id: string, corpo: object) => chamar('ana', 'POST', `/api/agendamentos/${id}/resultado`, corpo)

  it('desistiu e pediu recontato: o motivo vai ao histórico, a entrevista sai da agenda e o recontato entra na data', async () => {
    const fichaId = await lead('Joana Ribeiro', '11987654321')
    const { agendamento } = await marcar(fichaId)
    for (const errado of [{ resultado: 'desistiu', recontatar: null }, { resultado: 'desistiu', motivo: 'inventado', recontatar: null }])
      expect((await resultado(agendamento.id, errado)).statusCode, JSON.stringify(errado)).toBe(400)
    const r = (await resultado(agendamento.id, { resultado: 'desistiu', motivo: 'preco', detalhe: 'vai juntar o dinheiro', recontatar: { data: '09/11/2026' } })).json()
    expect(r.ficha.fechamento).toMatchObject({ situacao: 'recontatar', motivo: 'preco', detalhe: 'vai juntar o dinheiro', recontatarEm: '2026-11-09' })
    expect(r.ficha.agendamentos.find((a: { id: string }) => a.id === agendamento.id).estado).toBe('desistiu')
    expect(r.ficha.agendamentos).toContainEqual(expect.objectContaining({ oQue: 'Recontatar lead', data: '2026-11-09' }))
    expect(r.ficha.historico.at(-1).oQue).toMatch(/^Desistiu antes da entrevista de .+: Preço \(vai juntar o dinheiro\)\. Recontatar em .+$/)
    // O horário da entrevista fica livre: outra marcação no mesmo horário não avisa ocupado.
    expect((await marcar(await lead('Maria Souza', '11912345678'))).resultado).toBe('marcado')
  })

  it('desistiu sem recontato: o lead é arquivado com o motivo; compromisso interno não desiste', async () => {
    const fichaId = await lead('Joana Ribeiro', '11987654321')
    const { agendamento } = await marcar(fichaId)
    const r = (await resultado(agendamento.id, { resultado: 'desistiu', motivo: 'outro-escritorio', recontatar: null })).json()
    expect(r.ficha.fechamento).toMatchObject({ situacao: 'arquivado', motivo: 'outro-escritorio' })
    expect(r.ficha.historico.at(-1).oQue).toMatch(/^Desistiu antes da entrevista de .+: Foi a outro escritório\. Lead arquivado com o motivo$/)
    expect((await resultado(agendamento.id, { resultado: 'realizado' })).statusCode).toBe(400)
  })
})

describe('GGVP-158 P8.1 · quem abre conteúdo médico fica registrado', () => {
  it('a lista da Recepção com a gravação do Jurídico registra a leitura, uma por abertura; sem ela, nada', async () => {
    const joana = await lead('Joana Ribeiro', '11987654321')
    const leituras = async () => (await banco.select().from(acessoDadoSensivel)).map((a) => [a.perfil, a.casoId, a.recurso])
    await json('gabi', 'GET', '/api/recepcao')
    expect(await leituras()).toEqual([])
    // A entrevista gravada com a advogada tem dado de saúde: só do Jurídico.
    const dados = { id: 'gravacao-1', fichaId: joana, soJuridico: true, trechos: [{ aos: 0, quem: 'Joana', papel: 'cliente', texto: 'A dor na coluna piorou.' }] }
    await banco.insert(gravacaoRecepcao).values({ id: 'gravacao-1', pessoaId: joana, soJuridico: true, dados })
    expect((await json('ana', 'GET', '/api/recepcao')).gravacoes).toEqual([])
    expect(await leituras()).toEqual([])
    expect((await json('gabi', 'GET', '/api/recepcao')).gravacoes).toHaveLength(1)
    await json('gabi', 'GET', '/api/recepcao')
    expect(await leituras()).toEqual([
      ['advogada', null, 'recepcao:gravacoes'],
      ['advogada', null, 'recepcao:gravacoes'],
    ])
  })
})
