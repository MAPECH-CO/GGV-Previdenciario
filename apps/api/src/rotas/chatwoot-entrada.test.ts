import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { and, asc, eq } from 'drizzle-orm'
import Fastify from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { atendimento, caso, mensagem, pessoa, tarefa, usuario } from '../banco/esquema.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { SENHA_RETIRADA } from '../../../web/src/regras/entrevista.ts'
import { registrarRotasChatwootEntrada } from './chatwoot-entrada.ts'
import { QUEM_NO_WHATSAPP, TITULO_CONFERIR_IA, TITULO_CONFERIR_WHATSAPP } from './conversa.ts'

// GGVP-158 P6.5, P6.6 (ADR-019): a entrada do Chatwoot. Endereço, conta, caixa, token e segredo inventados; nada aqui
// chama o Chatwoot nem a OpenAI de verdade. É a homologação, com a lista dos telefones de teste.
const SENHA = 'senha-do-portal-1'
const SEGREDO = 'segredo-de-teste-do-webhook'
const AMBIENTE = {
  CHATWOOT_URL: 'https://chatwoot.teste',
  CHATWOOT_CONTA: '7',
  CHATWOOT_CAIXA: '9',
  CHATWOOT_TOKEN: 'token-de-teste',
  AMBIENTE: 'homologacao',
  CHATWOOT_PERMITIDOS: '(11) 98888-7777, (11) 96666-5555',
  CHATWOOT_WEBHOOK_SEGREDO: SEGREDO,
}
const CHAVES = { OPENAI_API_KEY: 'chave-de-teste-openai', IA_PERMITE_DADO_DE_SAUDE: 'sim' }
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let relogio: Date

/** O que a IA de mentira lê da conversa do WhatsApp: o endereço da primeira mensagem. */
const LEITURA = { resumo: 'A cliente mudou de endereço.', ditos: [{ campo: 'endereco', valor: 'Rua das Acácias, 45', i: 0 }], combinado: null }
const fetchDaIa = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(LEITURA) } }] }))) as unknown as typeof fetch

/** O servidor com as variáveis do Chatwoot; com `comIa`, a IA de mentira e o armazenamento, para a leitura da conversa. */
function montar(ambiente: Record<string, string> = AMBIENTE, comIa = false) {
  for (const [nome, valor] of Object.entries(ambiente)) vi.stubEnv(nome, valor)
  app = criarServidor({
    banco,
    agora: () => relogio,
    ...(comIa && {
      ia: criarIa({ banco, ambiente: CHAVES, fetch: fetchDaIa, agora: () => relogio }),
      armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'whatsapp-'))),
    }),
  })
  vi.unstubAllEnvs()
}

type Aviso = { event?: string; id?: number; content?: string; tipo?: string; telefone?: string; nome?: string; conta?: number; caixa?: number; privada?: boolean }
/** O aviso como o Chatwoot manda (`message_created`): o telefone do contato vem na conversa. */
const aviso = (a: Aviso = {}) => ({
  event: a.event ?? 'message_created',
  id: a.id ?? 1,
  content: a.content ?? 'Oi, tudo bem?',
  message_type: a.tipo ?? 'incoming',
  private: a.privada ?? false,
  account: { id: a.conta ?? 7, name: 'GGV' },
  inbox: { id: a.caixa ?? 9, name: 'GGV PREV' },
  conversation: { id: 502, inbox_id: a.caixa ?? 9, meta: { sender: { name: a.nome ?? 'Maria Ribeiro', phone_number: a.telefone ?? '+5511988887777', type: 'contact' } } },
  sender: { name: a.nome ?? 'Maria Ribeiro' },
})
const entrar = (corpo: object, segredo = SEGREDO) => app.inject({ method: 'POST', url: `/api/chatwoot/entrada/${segredo}`, payload: corpo })
const conversas = async () => (await banco.select().from(atendimento).orderBy(asc(atendimento.inicio))).map((l) => ({ ...l, c: l.dados as Record<string, any> }))
const gravacaoDa = async (c: { gravacaoId: string }) => (await json('ana', 'GET', `/api/conversas/${(await conversas()).find((x) => x.c.gravacaoId === c.gravacaoId)!.id}`)).gravacao

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const json = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) =>
  (await app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })).json()

/** A cliente do telefone (11) 98888-7777, com o caso. */
async function cliente(nome = 'Maria Ribeiro', situacao = 'cliente') {
  const [p] = await banco.insert(pessoa).values({ nome, telefone: '11988887777', situacao }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  return { pessoaId: p.id, casoId: c.id }
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  relogio = new Date('2026-10-08T15:00:00Z')
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['helena', 'senior']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  vi.unstubAllGlobals()
  await app?.close()
  await fechar()
})

describe('GGVP-158 P6.5 · a rota de entrada do Chatwoot', () => {
  it('sem a variável, ou com outro segredo, responde 404, e nada é gravado', async () => {
    montar({ ...AMBIENTE, CHATWOOT_WEBHOOK_SEGREDO: '' })
    expect((await entrar(aviso())).statusCode).toBe(404)
    await app.close()
    montar()
    for (const outro of ['outro-segredo', SEGREDO.slice(0, -1), `${SEGREDO}x`]) expect((await entrar(aviso(), outro)).statusCode).toBe(404)
    expect(await banco.select().from(atendimento)).toEqual([])
    expect(await banco.select().from(pessoa)).toEqual([])
  })

  it('o endereço, com o segredo, não vai ao log', async () => {
    const linhas: string[] = []
    const isolado = Fastify({ logger: { level: 'info', stream: { write: (linha: string) => void linhas.push(linha) } } })
    const recebidas: unknown[] = []
    registrarRotasChatwootEntrada(isolado, { banco, ambiente: AMBIENTE, receber: async (m) => void recebidas.push(m) })
    isolado.get('/outra', async () => ({ ok: true }))
    expect((await isolado.inject({ method: 'POST', url: `/api/chatwoot/entrada/${SEGREDO}`, payload: aviso() })).json()).toEqual({ ok: true })
    await isolado.inject({ method: 'GET', url: '/outra' })
    expect(recebidas).toHaveLength(1)
    // O log está ligado (a outra rota aparece), e o segredo não aparece em linha nenhuma.
    expect(linhas.some((l) => l.includes('/outra'))).toBe(true)
    expect(linhas.join('\n')).not.toContain(SEGREDO)
    await isolado.close()
  })

  it('GGVP-158 I6 · o erro ao receber vai ao log do servidor, com o código e o tipo, sem o segredo e sem o texto', async () => {
    const linhas: string[] = []
    const isolado = Fastify({ logger: { level: 'info', stream: { write: (linha: string) => void linhas.push(linha) } } })
    const falha = Object.assign(new Error('Failed query: insert into atendimento params: Oi, tudo bem?'), { code: '57P01' })
    registrarRotasChatwootEntrada(isolado, { banco, ambiente: AMBIENTE, receber: async () => Promise.reject(falha) })
    expect((await isolado.inject({ method: 'POST', url: `/api/chatwoot/entrada/${SEGREDO}`, payload: aviso() })).statusCode).toBe(500)
    const log = linhas.join('\n')
    expect(log).toContain('a entrada do Chatwoot falhou')
    expect(log).toContain('57P01')
    expect(log).not.toContain(SEGREDO)
    expect(log).not.toContain('tudo bem')
    await isolado.close()
  })

  it('outra conta, outra caixa, a nota privada, a atividade e o telefone fora da lista de teste: 200, e nada é gravado', async () => {
    montar()
    for (const a of [{ conta: 8 }, { caixa: 10 }, { privada: true }, { tipo: 'activity' }, { telefone: '+5521999990000' }, { content: '   ' }]) {
      const r = await entrar(aviso(a))
      expect([r.statusCode, r.json()], JSON.stringify(a)).toEqual([200, { ok: true }])
    }
    expect((await entrar({ evento: 'fora do formato' })).json()).toEqual({ ok: true })
    expect(await banco.select().from(atendimento)).toEqual([])
    expect(await banco.select().from(pessoa)).toEqual([])
  })
})

describe('GGVP-158 P6.5 · a mensagem vira conversa do WhatsApp', () => {
  it('a cliente conhecida: a mensagem entra na conversa do WhatsApp dela, ligada ao caso; a resposta do escritório entra junto; o aviso repetido não entra de novo', async () => {
    montar()
    const { pessoaId, casoId } = await cliente()
    // O WhatsApp às vezes grava o celular sem o nono dígito: acha a mesma cliente.
    await entrar(aviso({ id: 11, content: 'Mudei de endereço.', telefone: '+551188887777' }))
    relogio = new Date(relogio.getTime() + 60_000)
    await entrar(aviso({ id: 12, content: 'Pode mandar o novo, por favor.', tipo: 'outgoing', nome: 'Maria Ribeiro' }))
    await entrar(aviso({ id: 12, content: 'Pode mandar o novo, por favor.', tipo: 'outgoing', nome: 'Maria Ribeiro' }))
    const [linha] = await conversas()
    expect([linha.pessoaId, linha.casoId, linha.canal, linha.responsavelId, linha.fim]).toEqual([pessoaId, casoId, 'whatsapp', null, null])
    expect(linha.c).toMatchObject({ canal: 'whatsapp', comQuem: 'cliente', modo: 'escrito', quem: QUEM_NO_WHATSAPP, quemId: null, processoId: casoId })
    const g = await gravacaoDa(linha.c as { gravacaoId: string })
    expect(g.trechos.map((t: { aos: number; quem: string; papel: string; texto: string }) => [t.aos, t.quem, t.papel, t.texto])).toEqual([
      [0, 'Maria Ribeiro', 'cliente', 'Mudei de endereço.'],
      [60, 'Escritório (WhatsApp)', 'atendimento', 'Pode mandar o novo, por favor.'],
    ])
    // A tela recebe a conversa sem os ids do Chatwoot.
    expect((await json('ana', 'GET', `/api/conversas/${linha.id}`)).conversa.chatwoot).toBeUndefined()
  })

  it('a senha mandada por mensagem sai do texto (G9)', async () => {
    montar()
    await cliente()
    await entrar(aviso({ id: 13, content: 'A minha senha do gov.br é Exemplo@2026, pode anotar.' }))
    const g = await gravacaoDa((await conversas())[0].c as { gravacaoId: string })
    expect(g.trechos[0].texto).toContain(SENHA_RETIRADA)
    expect(JSON.stringify(await banco.select().from(atendimento))).not.toContain('Exemplo@2026')
  })

  it('o telefone novo vira lead, com o nome do contato; a resposta do escritório a um número sem ficha não cria lead', async () => {
    montar()
    await entrar(aviso({ id: 41, tipo: 'outgoing', telefone: '+5511966665555', content: 'Olá!' }))
    expect(await banco.select().from(pessoa)).toEqual([])
    await entrar(aviso({ id: 42, telefone: '+5511966665555', nome: 'Rosa Lima', content: 'Quero saber do BPC.' }))
    const [p] = await banco.select().from(pessoa)
    expect([p.nome, p.telefone, p.situacao]).toEqual(['Rosa Lima', '11966665555', 'lead'])
    const ficha = await json('ana', 'GET', `/api/fichas/${p.id}`)
    expect(ficha.historico.map((e: { oQue: string }) => e.oQue)).toEqual([
      'Criou a ficha pelo WhatsApp (lead), com a mensagem que chegou',
      'Chegou mensagem pelo WhatsApp: a conversa do WhatsApp abriu',
    ])
    const [linha] = await conversas()
    expect([linha.pessoaId, linha.casoId]).toEqual([p.id, null])
  })

  it('o nome que não é nome (com emoji) vira "Contato do WhatsApp"', async () => {
    montar()
    await entrar(aviso({ id: 43, telefone: '+5511966665555', nome: 'Rosa 🌻', content: 'Oi' }))
    expect((await banco.select().from(pessoa))[0].nome).toBe('Contato do WhatsApp')
  })

  it('mãe e filha no mesmo número: vai para a do nome do contato; sem nome que bata, para a cliente', async () => {
    montar()
    const mae = await cliente('Maria Ribeiro', 'cliente')
    const [filha] = await banco.insert(pessoa).values({ nome: 'Ana Ribeiro', telefone: '11988887777', situacao: 'lead' }).returning()
    await entrar(aviso({ id: 31, nome: 'ana ribeiro', content: 'Sou a Ana.' }))
    await entrar(aviso({ id: 32, nome: 'Celular da família', content: 'Sou a Maria.' }))
    expect((await conversas()).map((l) => l.pessoaId).sort()).toEqual([filha.id, mae.pessoaId].sort())
    expect((await conversas()).find((l) => l.pessoaId === filha.id)!.casoId).toBeNull()
  })

  it('sem a IA, a mensagem 30 minutos depois fecha a anterior, com o motivo, e abre outra; nasce a conferência do Atendimento', async () => {
    montar()
    await cliente()
    await entrar(aviso({ id: 21, content: 'Bom dia.' }))
    relogio = new Date(relogio.getTime() + 31 * 60_000)
    await entrar(aviso({ id: 22, content: 'Ainda está aí?' }))
    const [antiga, nova] = await conversas()
    expect([antiga.c.finalizadaEm, antiga.fim?.toISOString()]).toEqual(['2026-10-08T15:00:00.000Z', '2026-10-08T15:00:00.000Z'])
    expect(antiga.c.analise.observacao).toMatch(/^A IA não/)
    expect([nova.c.finalizadaEm, nova.fim]).toEqual([undefined, null])
    const linhas = await banco.select().from(tarefa)
    expect(linhas.map((t) => [t.atendimentoId, t.passo, t.titulo, t.perfilDono])).toEqual([[antiga.id, 'D5.04', TITULO_CONFERIR_WHATSAPP, 'atendimento']])
    expect(await json('ana', 'GET', '/api/conversas/tarefas')).toEqual([expect.objectContaining({ codigo: 'D5.04', acao: TITULO_CONFERIR_WHATSAPP, href: `/conversas/${antiga.id}/conferir` })])
  })
})

describe('GGVP-158 P6.5, P6.6 · a conversa do WhatsApp fecha, a IA lê, o Atendimento responde e a Sênior confere', () => {
  it('a rodada do preparo fecha a conversa parada há 30 minutos; a IA aponta o que foi dito; o Atendimento responde a pendência, e a Sênior decide', async () => {
    montar(AMBIENTE, true)
    const { pessoaId } = await cliente()
    await entrar(aviso({ id: 51, content: 'Mudei para a Rua das Acácias, 45.' }))
    await app.prepararSugestoes()
    expect((await conversas())[0].c.finalizadaEm).toBeUndefined()
    relogio = new Date(relogio.getTime() + 31 * 60_000)
    await app.prepararSugestoes()
    const [linha] = await conversas()
    expect(linha.c.analise.mudancas.map((m: { campo: string; depois: string }) => [m.campo, m.depois])).toEqual([['endereco', 'Rua das Acácias, 45']])
    expect(linha.c.analise.daIa.resumo).toBe('A cliente mudou de endereço.')

    // A conversa do WhatsApp é conferida pelo Atendimento: responde a pendência, sem decidir os itens.
    const url = `/api/conversas/${linha.id}/conferencia`
    expect((await json('helena', 'GET', '/api/conversas/tarefas')).map((t: { acao: string }) => t.acao)).toEqual([])
    await json('ana', 'POST', url, { decisoes: [], pendencia: { surgiu: false } })
    const abertas = async () => (await banco.select().from(tarefa).where(and(eq(tarefa.atendimentoId, linha.id)))).filter((t) => !t.concluidaEm).map((t) => [t.titulo, t.perfilDono])
    expect(await abertas()).toEqual([[TITULO_CONFERIR_IA, 'senior']])
    const id = linha.c.analise.mudancas[0].id
    const conferida = await json('helena', 'POST', url, { decisoes: [{ id, decisao: 'confirmada' }] })
    expect(conferida.ficha.endereco).toBe('Rua das Acácias, 45')
    expect(await abertas()).toEqual([])
    expect((await banco.select().from(pessoa).where(eq(pessoa.id, pessoaId)))[0].logradouro).toBe('Rua das Acácias, 45')
  })
})

describe('GGVP-158 P6.5 · a entrega e a leitura', () => {
  it('a mudança de uma mensagem do portal: o portal pergunta o status ao Chatwoot, e ele só anda para a frente', async () => {
    let status = 'delivered'
    const perguntas: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      perguntas.push(url.replace('https://chatwoot.teste/api/v1/accounts/7', ''))
      return Response.json({ payload: [{ id: 76, status: 'read' }, { id: 77, status }] })
    })
    montar()
    const { pessoaId } = await cliente()
    const [m] = await banco.insert(mensagem).values({ pessoaId, canal: 'whatsapp', conteudo: 'Boas-vindas', modelo: 'boas-vindas', status: 'enviada', chatwootMensagemId: 77, conversaChatwoot: 502 }).returning()
    const mudou = async () => {
      await entrar({ ...aviso({ id: 77, tipo: 'outgoing' }), event: 'message_updated' })
      return (await banco.select({ status: mensagem.status }).from(mensagem).where(eq(mensagem.id, m.id)))[0].status
    }
    expect(await mudou()).toBe('entregue')
    status = 'read'
    expect(await mudou()).toBe('lida')
    status = 'delivered'
    expect(await mudou()).toBe('lida')
    expect(perguntas).toEqual(Array(3).fill('/conversations/502/messages'))
    // A mensagem que o portal não mandou não muda nada e nem pergunta.
    await entrar({ ...aviso({ id: 999, tipo: 'outgoing' }), event: 'message_updated' })
    expect(perguntas).toHaveLength(3)
  })
})
