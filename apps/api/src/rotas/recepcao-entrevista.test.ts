import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { usuario } from '../banco/esquema.ts'
import { MSG_SEM_AUDIO } from '../fluxo/transcricao.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_MANDE_O_ARQUIVO, MSG_SEM_AVISO } from './recepcao-entrevista.ts'

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

// GGVP-133: a transcrição e a leitura são de verdade, pelo motor de IA, com a OpenAI de mentira (nenhuma chamada de verdade).
const DIARIZADO = {
  usage: { seconds: 300 },
  segments: [
    { speaker: 'A', start: 1, end: 5, text: 'Joana, a conversa está sendo gravada. Qual é o seu estado civil?' },
    { speaker: 'B', start: 6, end: 12, text: 'União estável. Tenho dois laudos do ortopedista e a carta do INSS.' },
    { speaker: 'B', start: 13, end: 16, text: 'Minha senha do gov.br é 123456.' },
  ],
}
const LEITURA = {
  resumo: 'Joana quer o BPC; vive em união estável e tem laudos e a carta do INSS.',
  itens: [
    { tipo: 'estadoCivil', valor: 'União estável', i: 1 },
    { tipo: 'documento', valor: '2 laudos do ortopedista', i: 1 },
    { tipo: 'documento', valor: 'carta de indeferimento do INSS', i: 1 },
  ],
}
const openAiFalsa = (async (url: string | URL | Request, init?: RequestInit) => {
  const resposta = (corpo: object) => new Response(JSON.stringify(corpo), { status: 200 })
  if (String(url).endsWith('/audio/transcriptions')) return resposta(DIARIZADO)
  const corpo = JSON.parse(String(init?.body)) as { messages: { content: string }[] }
  if (corpo.messages[0].content.includes('entrevista inicial')) return resposta({ choices: [{ message: { content: JSON.stringify(LEITURA) } }] })
  // Arrumar: o texto fica como está; o primeiro a falar é o escritório.
  const falas = JSON.parse(corpo.messages[1].content.split('Falas:\n')[1].replace('\n</conteudo>', '')) as { i: number; falante: string; texto: string }[]
  const arrumada = { falantes: Object.fromEntries(falas.map((f) => [f.falante, f.falante.endsWith('A') ? 'escritorio' : 'cliente'])), falas: falas.map(({ i, texto }) => ({ i, texto })) }
  return resposta({ choices: [{ message: { content: JSON.stringify(arrumada) } }] })
}) as typeof globalThis.fetch

/** Uma parte do áudio do microfone, em multipart, como o navegador manda. */
function parteDoAudio(inicio = 0) {
  const f = '----ggv'
  const payload = [
    `--${f}\r\nContent-Disposition: form-data; name="inicio"\r\n\r\n${inicio}\r\n`,
    `--${f}\r\nContent-Disposition: form-data; name="arquivo"; filename="parte-${inicio}.webm"\r\nContent-Type: audio/webm\r\n\r\náudio da parte\r\n`,
    `--${f}--\r\n`,
  ].join('')
  return { payload, headers: { 'content-type': `multipart/form-data; boundary=${f}` } }
}
const situacao = (tarefas: Tarefa[]) => tarefas.map((t) => [t.acao, t.concluida ?? false])

/** Um lead do balcão com a entrevista amanhã às 14:00, confirmada com a ficha preenchida ("Preparar entrevista" aberta). */
async function entrevistaConfirmada() {
  const fichaId = (await json('ana', 'POST', '/api/fichas', { nome: 'Joana Ribeiro', idade: 66, pretende: 'Quer saber do BPC.', telefone: '11987654321', beneficioInteresse: 'loas-idoso', outraPessoa: false })).id as string
  const MARCACAO = { tipo: 'presencial', data: '2026-10-09', hora: '14:00', duracao: 45, com: 'paula', gravar: true, levar: true, pedirFicha: true, confirmarHorarioOcupado: false }
  const agendamentoId = (await json('ana', 'POST', `/api/fichas/${fichaId}/agendamentos`, MARCACAO)).agendamento.id as string
  await json('ana', 'POST', `/api/agendamentos/${agendamentoId}/confirmacao`, { resultado: 'confirmou', canal: 'ligacao', jaPreencheuFicha: true })
  return { fichaId, agendamentoId }
}

/** Grava (o áudio sobe em uma parte), encerra aos 5 minutos e transcreve. */
async function entrevistaTranscrita(agendamentoId: string) {
  const { gravacao } = await json('gabi', 'POST', `/api/entrevistas/${agendamentoId}/gravacoes`, { avisei: true })
  await app.inject({ method: 'POST', url: `/api/gravacoes/${gravacao.id}/audio`, cookies: await cookieDe('gabi'), ...parteDoAudio() })
  const encerrada = await json('gabi', 'POST', `/api/gravacoes/${gravacao.id}/encerrar`, { aos: 300, online: true })
  const { gravacao: transcrita } = await json('gabi', 'POST', `/api/gravacoes/${gravacao.id}/transcricao`, {})
  return { encerrada, transcrita }
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  const ambiente = { OPENAI_API_KEY: 'chave-de-teste-openai', IA_PERMITE_DADO_DE_SAUDE: 'sim' }
  const ia = criarIa({ banco, ambiente, fetch: openAiFalsa, agora: () => relogio })
  app = criarServidor({ banco, agora: () => relogio, ia, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'entrevista-'))) })
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
    expect(transcrita.trechos).toHaveLength(3)
    expect(transcrita.resumo).toBe(LEITURA.resumo)
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

  it('sem áudio guardado, nada é inventado: a transcrição diz o motivo e o registro sem áudio não cria áudio', async () => {
    const { agendamentoId } = await entrevistaConfirmada()
    const { gravacao } = await json('gabi', 'POST', `/api/entrevistas/${agendamentoId}/gravacoes`, { avisei: true })
    const encerrada = await json('gabi', 'POST', `/api/gravacoes/${gravacao.id}/encerrar`, { aos: 120, online: true })
    expect(encerrada.gravacao.audio).toBeUndefined()
    const t = (await json('gabi', 'POST', `/api/gravacoes/${gravacao.id}/transcricao`, {})).gravacao
    expect([t.transcricao, t.motivoDaFalha, t.trechos, t.resumo]).toEqual(['falhou', MSG_SEM_AUDIO, [], undefined])

    const outra = (await json('gabi', 'POST', `/api/entrevistas/${agendamentoId}/gravacoes`, { avisei: true })).gravacao
    await json('gabi', 'POST', `/api/gravacoes/${outra.id}/acoes`, { acao: 'falhou', aos: 40 })
    const semAudio = (await json('gabi', 'POST', `/api/gravacoes/${outra.id}/sem-audio`, { notas: 'Sem microfone; conversamos sobre o BPC.' })).gravacao
    expect(semAudio).toMatchObject({ estado: 'encerrada', transcricao: 'sem-audio', registro: 'Sem microfone; conversamos sobre o BPC.' })
    expect(semAudio.audio).toBeUndefined()
  })

  it('sem áudio, áudio de fora e a conversa sem áudio: a do Jurídico fica só com o Jurídico', async () => {
    const { fichaId, agendamentoId } = await entrevistaConfirmada()
    const { gravacao } = await json('gabi', 'POST', `/api/entrevistas/${agendamentoId}/gravacoes`, { avisei: true })
    const semAudio = await json('gabi', 'POST', `/api/gravacoes/${gravacao.id}/sem-audio`, { notas: 'O microfone falhou; conversamos sobre o BPC.' })
    expect(semAudio.gravacao).toMatchObject({ estado: 'encerrada', transcricao: 'sem-audio', registro: 'O microfone falhou; conversamos sobre o BPC.' })

    // Só o nome do arquivo não vira áudio no caso: o áudio de fora vai com o arquivo (o teste dele está em transcricao.test.ts).
    const soONome = await chamar('gabi', 'POST', `/api/entrevistas/${agendamentoId}/audio`, { nome: 'ligacao.mp3', tipo: 'audio/mpeg', tamanho: 1_000_000 })
    expect([soONome.statusCode, soONome.json().erro]).toEqual([400, MSG_MANDE_O_ARQUIVO])

    const conversa = { data: '07/10/2026', canal: 'Telefone', titulo: 'Ligou para saber do caso', participantes: 'Ana, Joana', texto: 'Perguntou quando é a entrevista.' }
    expect((await json('ana', 'POST', `/api/fichas/${fichaId}/conversas`, { ...conversa, perfil: 'atendimento' })).gravacao.soJuridico).toBe(false)
    // Quem não vê dado de saúde não cria conversa só do Jurídico.
    expect((await json('ana', 'POST', `/api/fichas/${fichaId}/conversas`, { ...conversa, perfil: 'juridico' })).gravacao.soJuridico).toBe(false)
    expect((await json('gabi', 'POST', `/api/fichas/${fichaId}/conversas`, { ...conversa, perfil: 'juridico' })).gravacao.soJuridico).toBe(true)
    expect((await chamar('ana', 'POST', `/api/fichas/${fichaId}/conversas`, { ...conversa, data: '09/10/2026', perfil: 'atendimento' })).statusCode).toBe(400)

    expect((await json('ana', 'GET', '/api/recepcao')).gravacoes.map((g: { titulo: string }) => g.titulo)).toEqual(['Telefone: Ligou para saber do caso', 'Telefone: Ligou para saber do caso'])
    expect((await json('gabi', 'GET', '/api/recepcao')).gravacoes).toHaveLength(4)
  })
})
