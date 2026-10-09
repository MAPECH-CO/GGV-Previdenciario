import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, mensagem, pericia, pessoa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_CHATWOOT_DESLIGADO } from './mensagens.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
// Quinta, 08/10/2026, meio-dia em Brasília.
const relogio = new Date('2026-10-08T15:00:00Z')
const NUNCA_A_SENHA = 'O escritório nunca pede a sua senha do gov.br por mensagem.'

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const json = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) => (await chamar(apelido, method, url, payload)).json()

async function cliente() {
  const fichaId = (await json('ana', 'POST', '/api/fichas', { nome: 'Maria Ribeiro', idade: 66, pretende: 'Quer saber do BPC.', telefone: '11987654321', beneficioInteresse: 'loas-idoso', outraPessoa: false })).id as string
  const [c] = await banco.insert(caso).values({ pessoaId: fichaId, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  return { fichaId, processoId: c.id }
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => relogio })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['igor', 'juridico_adm'], ['marcos', 'financeiro']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-138 · mensagens ao cliente no servidor', () => {
  it('a mensagem pronta: o texto do modelo com o aviso da senha, a trava do resultado e a perícia em vigor no processo', async () => {
    const { fichaId, processoId } = await cliente()
    const boasVindas = await json('ana', 'GET', `/api/fichas/${fichaId}/mensagens/boas-vindas`)
    expect(boasVindas).toMatchObject({ editavel: true, trava: null, contato: { nome: 'Maria Ribeiro', telefone: '11987654321' } })
    expect(boasVindas.texto).toMatch(/^Olá, Maria! Boas-vindas ao escritório GGV\. Seu caso de .+\.$/)
    expect(boasVindas.texto.endsWith(NUNCA_A_SENHA)).toBe(true)
    expect(boasVindas.conversas).toHaveLength(1)
    // G8: o aviso do resultado só sai com o texto aprovado.
    expect((await json('ana', 'GET', `/api/fichas/${fichaId}/mensagens/resultado-favoravel`)).trava).toMatch(/OK da advogada/)
    expect((await json('igor', 'GET', `/api/fichas/${fichaId}/mensagens/pericia-orientacao`)).trava).toBe('Sem perícia marcada no processo.')
    await banco.insert(pericia).values({ casoId: processoId, tipo: 'medica', agendadaPara: new Date('2026-10-16T11:30:00Z') })
    expect((await json('igor', 'GET', `/api/fichas/${fichaId}/mensagens/pericia-orientacao?processo=${processoId}`)).texto).toMatch(/^Olá, Maria! Sua perícia no INSS é .*16/)
    expect((await chamar('marcos', 'GET', `/api/fichas/${fichaId}/mensagens/boas-vindas`)).statusCode).toBe(403)
  })

  it('por perfil e pelos portões: o Financeiro não envia; G9, G11 e G20 barram no servidor e a recusa fica no histórico, sem o texto', async () => {
    const { fichaId } = await cliente()
    const { conversas } = await json('ana', 'GET', `/api/fichas/${fichaId}/mensagens/cobranca`)
    const url = `/api/fichas/${fichaId}/mensagens`
    const envio = (texto: string) => ({ modelo: 'cobranca', texto, conversa: conversas[0].id })
    expect((await chamar('marcos', 'POST', url, envio('Olá!'))).statusCode).toBe(403)
    expect((await json('ana', 'POST', url, envio('Olá, Maria! Mande a sua senha do gov.br por aqui.'))).erro).toBe('O escritório nunca pede a senha do gov.br por mensagem (G9).')
    expect((await json('ana', 'POST', url, envio('Na perícia, não conte que você trabalha.'))).erro).toBe('Nunca oriente a esconder ou mudar a situação real (G11).')
    expect((await json('ana', 'POST', url, envio('Peça ao médico o CID da doença.'))).erro).toMatch(/\(G20\)\.$/)
    const recusas = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'portao_bloqueado'))
    expect(recusas.map((r) => (r.detalhe as { portao: string }).portao)).toEqual(['G9', 'G11', 'G20'])
    expect(JSON.stringify(recusas)).not.toMatch(/CID da doença|trabalha/)
    expect(await banco.select().from(mensagem)).toHaveLength(0)
  })

  it('o envio fica registrado com o status, vai para "Últimos contatos" e não se repete na mesma conversa', async () => {
    const { fichaId } = await cliente()
    const pronta = await json('ana', 'GET', `/api/fichas/${fichaId}/mensagens/boas-vindas`)
    const url = `/api/fichas/${fichaId}/mensagens`
    expect((await json('ana', 'POST', url, { modelo: 'boas-vindas', texto: pronta.texto, conversa: 999 })).erro).toBe('Escolha a conversa do cliente no Chatwoot.')
    // O processo tem de ser deste cliente.
    const [outra] = await banco.insert(pessoa).values({ nome: 'Outra Pessoa' }).returning()
    const [doOutro] = await banco.insert(caso).values({ pessoaId: outra.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
    expect((await json('ana', 'POST', url, { modelo: 'boas-vindas', texto: pronta.texto, conversa: pronta.conversas[0].id, processoId: doOutro.id })).erro).toBe('Processo não encontrado.')
    const enviada = await json('ana', 'POST', url, { modelo: 'boas-vindas', texto: pronta.texto, conversa: pronta.conversas[0].id })
    expect(enviada).toMatchObject({ modelo: 'boas-vindas', canal: 'Chatwoot', status: 'entregue', quem: 'ana', fichaId })
    expect((await json('ana', 'POST', url, { modelo: 'boas-vindas', texto: pronta.texto, conversa: pronta.conversas[0].id })).id).toBe(enviada.id)
    expect(await json('ana', 'GET', url)).toEqual([enviada])
    const ficha = await json('ana', 'GET', `/api/fichas/${fichaId}`)
    expect(ficha.contatos.at(-1)).toMatchObject({ canal: 'Chatwoot · 12:00 · entregue', texto: pronta.texto })
    expect(ficha.historico.at(-1).oQue).toBe('Enviou pelo Chatwoot a mensagem «Boas-vindas» (entregue)')
    const [evento] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'mensagem_enviada'))
    expect(evento.detalhe).toMatchObject({ modelo: 'boas-vindas', status: 'entregue' })
  })

  it('com o Chatwoot desligado, a mensagem não sai, a falha fica na tela e no histórico, e nada é reenviado sozinho', async () => {
    await app.close()
    vi.stubEnv('RELACIONAMENTO_SIMULADO', 'nao')
    app = criarServidor({ banco, agora: () => relogio })
    vi.unstubAllEnvs()
    const { fichaId } = await cliente()
    const pronta = await json('ana', 'GET', `/api/fichas/${fichaId}/mensagens/boas-vindas`)
    expect(pronta).toMatchObject({ contato: null, conversas: [] })
    const falha = await json('ana', 'POST', `/api/fichas/${fichaId}/mensagens`, { modelo: 'boas-vindas', texto: pronta.texto, conversa: 0 })
    expect(falha).toMatchObject({ status: 'falhou', erro: MSG_CHATWOOT_DESLIGADO, conversa: 0 })
    expect((await json('ana', 'GET', `/api/fichas/${fichaId}`)).historico.at(-1).oQue).toBe(`A mensagem «Boas-vindas» não saiu pelo Chatwoot: ${MSG_CHATWOOT_DESLIGADO}. Nada foi reenviado sozinho.`)
  })
})

describe('GGVP-146 · mensagens pelo Chatwoot de verdade, no servidor', () => {
  // Endereço, conta e caixa inventados; o token é de teste. Nada aqui chama o Chatwoot de verdade.
  const CHATWOOT = { CHATWOOT_URL: 'https://chatwoot.teste', CHATWOOT_CONTA: '7', CHATWOOT_CAIXA: '9', CHATWOOT_TOKEN: 'token-de-teste' }
  const API = `${CHATWOOT.CHATWOOT_URL}/api/v1/accounts/${CHATWOOT.CHATWOOT_CONTA}`
  type Chamada = { metodo: string; caminho: string; corpo?: unknown; token?: string }

  /** O `fetch` falso: cada "MÉTODO /caminho" responde o JSON da tabela, ou a função (que pode lançar ou dar um Response). */
  async function comChatwoot(rotas: Record<string, unknown>) {
    const chamadas: Chamada[] = []
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      const chamada = {
        metodo: init.method ?? 'GET',
        caminho: url.replace(API, ''),
        corpo: init.body ? JSON.parse(String(init.body)) : undefined,
        token: (init.headers as Record<string, string>).api_access_token,
      }
      chamadas.push(chamada)
      const r = rotas[`${chamada.metodo} ${chamada.caminho}`]
      const resposta = typeof r === 'function' ? r() : r
      return resposta instanceof Response ? resposta : resposta === undefined ? new Response(null, { status: 404 }) : Response.json(resposta)
    })
    await app.close()
    for (const [nome, valor] of Object.entries(CHATWOOT)) vi.stubEnv(nome, valor)
    app = criarServidor({ banco, agora: () => relogio })
    vi.unstubAllEnvs()
    return chamadas
  }
  const posts = (chamadas: Chamada[]) => chamadas.filter((c) => c.metodo === 'POST')
  const saida = (texto: string) => ({ content: texto, message_type: 'outgoing', private: false })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sem as variáveis, segue simulado e não chama o Chatwoot', async () => {
    const espiao = vi.fn()
    vi.stubGlobal('fetch', espiao)
    const { fichaId } = await cliente()
    const pronta = await json('ana', 'GET', `/api/fichas/${fichaId}/mensagens/boas-vindas`)
    expect(pronta.simulado).toBe(true)
    expect(await json('ana', 'POST', `/api/fichas/${fichaId}/mensagens`, { modelo: 'boas-vindas', texto: pronta.texto, conversa: pronta.conversas[0].id })).toMatchObject({ status: 'entregue' })
    expect(espiao).not.toHaveBeenCalled()
  })

  it('com as variáveis, acha o contato e as conversas na caixa, e a mensagem sai pela conversa escolhida, com o token só no cabeçalho', async () => {
    const chamadas = await comChatwoot({
      'GET /contacts/search?q=87654321': {
        payload: [
          { id: 31, name: 'Maria Ribeiro', phone_number: '+5511987654321', contact_inboxes: [{ source_id: '5511987654321', inbox: { id: 9, name: 'GGV PREV' } }] },
          { id: 32, name: 'Maria Ribeiro', phone_number: '+5521987654321' },
        ],
      },
      'GET /contacts/31/conversations': {
        payload: [
          { id: 501, inbox_id: 9, status: 'resolved', last_activity_at: 1759900000 },
          { id: 502, inbox_id: 9, status: 'open', last_activity_at: 1759910000 },
          { id: 503, inbox_id: 3, status: 'open', last_activity_at: 1759920000 },
        ],
      },
      'GET /conversations/501/messages': { payload: [{}, {}] },
      'GET /conversations/502/messages': { payload: [{}, {}, {}, {}, {}] },
      'POST /conversations/502/messages': { id: 9001, status: 'sent' },
    })
    const { fichaId } = await cliente()
    const pronta = await json('ana', 'GET', `/api/fichas/${fichaId}/mensagens/boas-vindas`)
    expect(pronta).toMatchObject({ simulado: false, contato: { id: 31, nome: 'Maria Ribeiro', telefone: '11987654321' } })
    // Só as conversas da caixa do escritório, a de mais mensagens primeiro (CA6), com o endereço na central.
    expect(pronta.conversas).toEqual([
      { id: 502, caixa: 'GGV PREV', situacao: 'aberta', mensagens: 5, ultimaEm: new Date(1759910000 * 1000).toISOString(), link: 'https://chatwoot.teste/app/accounts/7/conversations/502' },
      { id: 501, caixa: 'GGV PREV', situacao: 'resolvida', mensagens: 2, ultimaEm: new Date(1759900000 * 1000).toISOString(), link: 'https://chatwoot.teste/app/accounts/7/conversations/501' },
    ])
    const url = `/api/fichas/${fichaId}/mensagens`
    // A conversa de outra caixa não serve.
    expect((await json('ana', 'POST', url, { modelo: 'boas-vindas', texto: pronta.texto, conversa: 503 })).erro).toBe('Escolha a conversa do cliente no Chatwoot.')
    expect(posts(chamadas)).toEqual([])
    const enviada = await json('ana', 'POST', url, { modelo: 'boas-vindas', texto: pronta.texto, conversa: 502 })
    expect(enviada).toMatchObject({ status: 'enviada', conversa: 502, quem: 'ana' })
    expect(posts(chamadas)).toEqual([{ metodo: 'POST', caminho: '/conversations/502/messages', corpo: saida(pronta.texto), token: 'token-de-teste' }])
    expect(chamadas.every((c) => c.token === 'token-de-teste' && !c.caminho.includes('token'))).toBe(true)
    expect(JSON.stringify([pronta, enviada])).not.toContain('token-de-teste')
    const ficha = await json('ana', 'GET', `/api/fichas/${fichaId}`)
    expect(ficha.historico.at(-1)).toMatchObject({ oQue: 'Enviou pelo Chatwoot a mensagem «Boas-vindas» (enviada)', quem: 'ana' })
    expect(ficha.contatos.at(-1)).toMatchObject({ canal: 'Chatwoot · 12:00 · enviada' })
  })

  it('sem o contato no Chatwoot, cria o contato na caixa, abre a conversa e envia', async () => {
    const chamadas = await comChatwoot({
      'GET /contacts/search?q=87654321': { payload: [] },
      'POST /contacts': { payload: { contact: { id: 77, name: 'Maria Ribeiro' }, contact_inbox: { source_id: 'fonte-77' } } },
      'POST /conversations': { id: 600 },
      'POST /conversations/600/messages': { id: 9002, status: 'sent' },
    })
    const { fichaId } = await cliente()
    const pronta = await json('ana', 'GET', `/api/fichas/${fichaId}/mensagens/boas-vindas`)
    expect(pronta).toMatchObject({ simulado: false, contato: null, conversas: [] })
    expect(await json('ana', 'POST', `/api/fichas/${fichaId}/mensagens`, { modelo: 'boas-vindas', texto: pronta.texto, conversa: 0 })).toMatchObject({ status: 'enviada', conversa: 600 })
    expect(posts(chamadas).map(({ caminho, corpo }) => ({ caminho, corpo }))).toEqual([
      { caminho: '/contacts', corpo: { inbox_id: 9, name: 'Maria Ribeiro', phone_number: '+5511987654321' } },
      { caminho: '/conversations', corpo: { source_id: 'fonte-77', inbox_id: 9, contact_id: 77 } },
      { caminho: '/conversations/600/messages', corpo: saida(pronta.texto) },
    ])
  })

  it('o contato gravado sem o nono dígito e sem conversa na caixa: liga o contato à caixa e abre a conversa', async () => {
    const chamadas = await comChatwoot({
      'GET /contacts/search?q=87654321': { payload: [{ id: 40, name: 'Maria', phone_number: '+551187654321', contact_inboxes: [{ source_id: 'outra', inbox: { id: 3, name: 'Outra caixa' } }] }] },
      'GET /contacts/40/conversations': { payload: [{ id: 801, inbox_id: 3, status: 'open' }] },
      'POST /contacts/40/contact_inboxes': { source_id: 'fonte-40', inbox: { id: 9 } },
      'POST /conversations': { id: 700 },
      'POST /conversations/700/messages': { id: 9003, status: 'sent' },
    })
    const { fichaId } = await cliente()
    const pronta = await json('ana', 'GET', `/api/fichas/${fichaId}/mensagens/cobranca`)
    expect(pronta).toMatchObject({ contato: { id: 40 }, conversas: [] })
    expect(await json('ana', 'POST', `/api/fichas/${fichaId}/mensagens`, { modelo: 'cobranca', texto: pronta.texto, conversa: 0 })).toMatchObject({ status: 'enviada', conversa: 700 })
    expect(posts(chamadas).map(({ caminho, corpo }) => ({ caminho, corpo }))).toEqual([
      { caminho: '/contacts/40/contact_inboxes', corpo: { inbox_id: 9 } },
      { caminho: '/conversations', corpo: { source_id: 'fonte-40', inbox_id: 9, contact_id: 40 } },
      { caminho: '/conversations/700/messages', corpo: saida(pronta.texto) },
    ])
  })

  it('o erro do Chatwoot vira aviso claro, o envio fica registrado como "não saiu" e nada é reenviado sozinho', async () => {
    let fora = true
    const chamadas = await comChatwoot({
      'GET /contacts/search?q=87654321': () => {
        if (fora) throw new TypeError('fetch failed')
        return { payload: [{ id: 31, name: 'Maria Ribeiro', phone_number: '+5511987654321', contact_inboxes: [{ source_id: 's', inbox: { id: 9, name: 'GGV PREV' } }] }] }
      },
      'GET /contacts/31/conversations': { payload: [{ id: 502, inbox_id: 9, status: 'open', last_activity_at: 1759910000 }] },
      'GET /conversations/502/messages': { payload: [{}] },
      'POST /conversations/502/messages': () => new Response(JSON.stringify({ error: 'falhou' }), { status: 500 }),
    })
    const { fichaId } = await cliente()
    const url = `/api/fichas/${fichaId}/mensagens`
    // Fora do ar: a mensagem pronta abre mesmo assim, e o envio falha com o motivo.
    const pronta = await json('ana', 'GET', `${url}/boas-vindas`)
    expect(pronta).toMatchObject({ simulado: false, contato: null, conversas: [] })
    expect(pronta.texto).toMatch(/^Olá, Maria!/)
    const semResposta = await json('ana', 'POST', url, { modelo: 'boas-vindas', texto: pronta.texto, conversa: 0 })
    expect(semResposta).toMatchObject({ status: 'falhou', conversa: 0, erro: 'o Chatwoot não respondeu; tente de novo em alguns minutos' })
    // De volta, mas recusando o envio: o motivo vem com o código, sem o token.
    fora = false
    const recusada = await json('ana', 'POST', url, { modelo: 'boas-vindas', texto: pronta.texto, conversa: 502 })
    expect(recusada).toMatchObject({ status: 'falhou', conversa: 502, erro: 'o Chatwoot recusou o pedido (código 500)' })
    expect(JSON.stringify(recusada)).not.toContain('token-de-teste')
    expect(posts(chamadas)).toHaveLength(1)
    expect((await json('ana', 'GET', `/api/fichas/${fichaId}`)).historico.at(-1).oQue).toBe(
      'A mensagem «Boas-vindas» não saiu pelo Chatwoot: o Chatwoot recusou o pedido (código 500). Nada foi reenviado sozinho.',
    )
    expect((await json('ana', 'GET', url)).map((m: { status: string }) => m.status)).toEqual(['falhou', 'falhou'])
    const eventos = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'mensagem_enviada'))
    expect(eventos.map((e) => (e.detalhe as { status: string }).status)).toEqual(['falhou', 'falhou'])
  })
})
