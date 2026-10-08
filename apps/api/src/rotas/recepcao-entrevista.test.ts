import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_SEM_AVISO } from './recepcao-entrevista.ts'

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
const chamar = async (apelido: string, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const json = async (apelido: string, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) => (await chamar(apelido, method, url, payload)).json()
type Tarefa = { acao: string; concluida?: boolean }
const situacao = (tarefas: Tarefa[]) => tarefas.map((t) => [t.acao, t.concluida ?? false])

/** Um lead do balcão com a entrevista amanhã às 14:00, confirmada com a ficha preenchida ("Preparar entrevista" aberta). */
async function entrevistaConfirmada() {
  const fichaId = (await json('ana', 'POST', '/api/fichas', { nome: 'Joana Ribeiro', idade: 66, pretende: 'Quer saber do BPC.', telefone: '11987654321', beneficioInteresse: 'loas-idoso', outraPessoa: false })).id as string
  const MARCACAO = { tipo: 'presencial', data: '2026-10-09', hora: '14:00', duracao: 45, com: 'paula', gravar: true, levar: true, pedirFicha: true, confirmarHorarioOcupado: false }
  const agendamentoId = (await json('ana', 'POST', `/api/fichas/${fichaId}/agendamentos`, MARCACAO)).agendamento.id as string
  await json('ana', 'POST', `/api/agendamentos/${agendamentoId}/confirmacao`, { resultado: 'confirmou', canal: 'ligacao', jaPreencheuFicha: true })
  return { fichaId, agendamentoId }
}

/** Grava, encerra aos 5 minutos e transcreve. */
async function entrevistaTranscrita(agendamentoId: string) {
  const { gravacao } = await json('gabi', 'POST', `/api/entrevistas/${agendamentoId}/gravacoes`, { avisei: true })
  const encerrada = await json('gabi', 'POST', `/api/gravacoes/${gravacao.id}/encerrar`, { aos: 300, online: true })
  const { gravacao: transcrita } = await json('gabi', 'POST', `/api/gravacoes/${gravacao.id}/transcricao`, {})
  return { encerrada, transcrita }
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => relogio })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['gabi', 'advogada'], ['helena', 'senior']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-125 · bloco 3a: entrevista gravada e transcrição no servidor', () => {
  it('G10: sem o aviso não grava; só o Jurídico grava; a gravação aberta continua a mesma', async () => {
    const { agendamentoId } = await entrevistaConfirmada()
    const url = `/api/entrevistas/${agendamentoId}/gravacoes`
    expect((await json('gabi', 'POST', url, {})).erro).toBe(MSG_SEM_AVISO)
    expect((await chamar('ana', 'POST', url, { avisei: true })).statusCode).toBe(403)

    const r = await json('gabi', 'POST', url, { avisei: true })
    expect(r.gravacao).toMatchObject({ estado: 'gravando', soJuridico: true, acoes: [{ acao: 'avisou' }, { acao: 'gravou' }] })
    expect(r.ficha.historico.at(-1)).toMatchObject({ quem: 'gabi', oQue: 'Avisou o cliente às 12:00 que a conversa seria gravada (G10) e começou a gravar a entrevista' })
    expect((await json('gabi', 'POST', url, { avisei: true })).gravacao.id).toBe(r.gravacao.id)
    expect((await json('gabi', 'POST', `/api/gravacoes/${r.gravacao.id}/acoes`, { acao: 'pausou', aos: 30 })).gravacao.estado).toBe('pausada')
    expect((await json('gabi', 'POST', `/api/gravacoes/${r.gravacao.id}/acoes`, { acao: 'retomou', aos: 40 })).gravacao.estado).toBe('gravando')
  })

  it('o fim da entrevista conclui o "Preparar entrevista" e abre "Definir benefício" e "Cadastrar lead"; a transcrição vem sem senha', async () => {
    const { fichaId, agendamentoId } = await entrevistaConfirmada()
    const { encerrada, transcrita } = await entrevistaTranscrita(agendamentoId)
    expect(encerrada.gravacao).toMatchObject({ estado: 'encerrada', transcricao: 'transcrevendo', audio: { formato: 'webm' } })
    expect(encerrada.tarefa).toMatchObject({ acao: 'Cadastrar lead', setor: 'Jurídico', href: `/clientes/${fichaId}/cadastro` })
    expect(situacao(encerrada.tarefas)).toEqual([
      ['Preparar entrevista', true],
      ['Definir benefício', false],
      ['Cadastrar lead', false],
    ])
    expect(encerrada.ficha.agendamentos[0].estado).toBe('realizado')
    expect(encerrada.ficha.transcricoes).toBe(1)

    expect(transcrita.transcricao).toBe('pronta')
    expect(transcrita.trechos.length).toBeGreaterThan(5)
    expect(transcrita.resumo).toMatch(/^Joana Ribeiro: /)
    // A senha do gov.br não fica no texto (G9).
    expect(JSON.stringify(transcrita.trechos)).not.toMatch(/senha (é|e) \d/i)
  })

  it('a gravação com dado de saúde só vai à cópia de quem vê dado de saúde', async () => {
    const { agendamentoId } = await entrevistaConfirmada()
    await entrevistaTranscrita(agendamentoId)
    expect((await json('helena', 'GET', '/api/recepcao')).gravacoes).toHaveLength(1)
    expect((await json('ana', 'GET', '/api/recepcao')).gravacoes).toEqual([])
  })

  it('conferir: a ficha muda com o valor antigo no histórico, o documento citado vira tarefa da Documentação; checklist e prova', async () => {
    const { agendamentoId } = await entrevistaConfirmada()
    const { transcrita } = await entrevistaTranscrita(agendamentoId)
    const ids = transcrita.extraidas.map((e: { id: string }) => e.id)
    const r = await json('gabi', 'POST', `/api/gravacoes/${transcrita.id}/conferencias`, { ids })
    expect(r.ficha.estadoCivil).toBe('União estável')
    expect(r.ficha.historico.map((e: { oQue: string }) => e.oQue)).toContain('Levou à ficha, da entrevista de 08/10, estado civil: «—» → «União estável»')
    expect(r.tarefas.filter((t: Tarefa) => t.acao === 'Pedir documento').map((t: { detalhe: string }) => t.detalhe).sort()).toEqual([
      '2 laudos do ortopedista · citado da entrevista de 08/10',
      'carta de indeferimento do INSS · citado da entrevista de 08/10',
    ])
    expect(r.gravacao.extraidas.every((e: { conferidaEm?: string }) => e.conferidaEm)).toBe(true)
    expect((await chamar('gabi', 'POST', `/api/gravacoes/${transcrita.id}/conferencias`, { ids: [] })).statusCode).toBe(400)

    const docs = await json('gabi', 'POST', `/api/gravacoes/${transcrita.id}/documentos`, { documentos: ['RG e CPF', 'Laudos do ortopedista'] })
    expect(docs.ficha.checklist).toEqual(['RG e CPF', 'Laudos do ortopedista'])
    const aos = transcrita.trechos[1].aos
    const prova = await json('gabi', 'PATCH', `/api/gravacoes/${transcrita.id}/trechos/${aos}`, { prova: true })
    expect(prova.gravacao.trechos[1].prova).toBe(true)
    expect(prova.ficha.historico.at(-1).oQue).toMatch(/^Marcou como prova o trecho de /)
  })

  it('sem áudio, áudio de fora e a conversa sem áudio: a do Jurídico fica só com o Jurídico', async () => {
    const { fichaId, agendamentoId } = await entrevistaConfirmada()
    const { gravacao } = await json('gabi', 'POST', `/api/entrevistas/${agendamentoId}/gravacoes`, { avisei: true })
    const semAudio = await json('gabi', 'POST', `/api/gravacoes/${gravacao.id}/sem-audio`, { notas: 'O microfone falhou; conversamos sobre o BPC.' })
    expect(semAudio.gravacao).toMatchObject({ estado: 'encerrada', transcricao: 'sem-audio', registro: 'O microfone falhou; conversamos sobre o BPC.' })

    expect((await chamar('gabi', 'POST', `/api/entrevistas/${agendamentoId}/audio`, { nome: 'laudo.pdf', tipo: 'application/pdf', tamanho: 10 })).statusCode).toBe(400)
    const fora = await json('gabi', 'POST', `/api/entrevistas/${agendamentoId}/audio`, { nome: 'ligacao.mp3', tipo: 'audio/mpeg', tamanho: 1_000_000 })
    expect(fora.gravacao).toMatchObject({ origem: 'arquivo', estado: 'encerrada', audio: { nome: 'ligacao.mp3', formato: 'mp3' } })

    const conversa = { data: '07/10/2026', canal: 'Telefone', titulo: 'Ligou para saber do caso', participantes: 'Ana, Joana', texto: 'Perguntou quando é a entrevista.' }
    expect((await json('ana', 'POST', `/api/fichas/${fichaId}/conversas`, { ...conversa, perfil: 'atendimento' })).gravacao.soJuridico).toBe(false)
    // Quem não vê dado de saúde não cria conversa só do Jurídico.
    expect((await json('ana', 'POST', `/api/fichas/${fichaId}/conversas`, { ...conversa, perfil: 'juridico' })).gravacao.soJuridico).toBe(false)
    expect((await json('gabi', 'POST', `/api/fichas/${fichaId}/conversas`, { ...conversa, perfil: 'juridico' })).gravacao.soJuridico).toBe(true)
    expect((await chamar('ana', 'POST', `/api/fichas/${fichaId}/conversas`, { ...conversa, data: '09/10/2026', perfil: 'atendimento' })).statusCode).toBe(400)

    expect((await json('ana', 'GET', '/api/recepcao')).gravacoes.map((g: { titulo: string }) => g.titulo)).toEqual(['Telefone: Ligou para saber do caso', 'Telefone: Ligou para saber do caso'])
    expect((await json('gabi', 'GET', '/api/recepcao')).gravacoes).toHaveLength(5)
  })
})
