import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, documentacaoMedica, eventoAuditoria, mensagem, pericia, pessoa, prestacaoContas, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import type { Complemento } from '../../../web/src/regras/complemento.ts'
import { MSG_CHATWOOT_DESLIGADO, MSG_FORA_DA_LISTA, MSG_SEM_COMPLEMENTO_ABERTO, MSG_SEM_OK_DA_ADVOGADA, MSG_SEM_TEXTO_APROVADO } from './mensagens.ts'
import { abrirExplicacaoDoResultado } from './resultado.ts'

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
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['igor', 'juridico_adm'], ['marcos', 'financeiro'], ['paula', 'advogada']] as const)
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

describe('GGVP-102 · os modelos do complemento e do resultado destravam pela regra', () => {
  /** O pedido de complemento ao médico aberto pelo parecer Insuficiente (GGVP-20), como a documentação médica guarda. */
  const pedido = (fichaId: string, processoId: string, mais: Partial<Complemento> = {}): Complemento => ({
    processoId,
    fichaId,
    abertaEm: '2026-10-07T13:00:00.000Z',
    parecer: 'insuficiente',
    abordar: 'Desde quando e por quanto tempo',
    perguntas: ['Desde quando a paciente apresenta o quadro?', 'Qual a previsão de duração?'],
    quem: 'paula',
    tentativas: [],
    decisoes: [],
    ...mais,
  })

  it('o complemento: só com o pedido aberto no caso, com a orientação da tela; o G20 segue valendo no envio', async () => {
    const { fichaId, processoId } = await cliente()
    const url = `/api/fichas/${fichaId}/mensagens/complemento?processo=${processoId}`
    expect((await json('ana', 'GET', url)).trava).toBe(MSG_SEM_COMPLEMENTO_ABERTO)
    await banco.insert(documentacaoMedica).values({ casoId: processoId, parte: 'complemento', documento: [pedido(fichaId, processoId)] })
    const pronta = await json('ana', 'GET', url)
    expect(pronta).toMatchObject({ trava: null, editavel: true })
    expect(pronta.texto).toMatch(/^Olá, Maria! Aqui é do escritório GGV\. .*\n1\. Desde quando a paciente apresenta o quadro\?\n2\. Qual a previsão de duração\?\n/s)
    expect(pronta.texto.endsWith(NUNCA_A_SENHA)).toBe(true)
    const envio = (texto: string) => ({ modelo: 'complemento', texto, conversa: pronta.conversas[0].id, processoId })
    expect((await json('ana', 'POST', `/api/fichas/${fichaId}/mensagens`, envio('Peça ao médico o CID da doença.'))).erro).toMatch(/\(G20\)\.$/)
    expect(await json('ana', 'POST', `/api/fichas/${fichaId}/mensagens`, envio(pronta.texto))).toMatchObject({ modelo: 'complemento', status: 'entregue', processoId })
    // Encerrado pelo parecer Suficiente, volta a travar.
    await banco.update(documentacaoMedica).set({ documento: [pedido(fichaId, processoId, { encerrado: { quando: '2026-10-08T12:00:00.000Z', porque: 'parecer-suficiente' } })] })
    expect((await json('ana', 'GET', url)).trava).toBe(MSG_SEM_COMPLEMENTO_ABERTO)
  })

  it('o complemento que passou do limite de tentativas sobe para a sênior e não sai (G15)', async () => {
    const { fichaId, processoId } = await cliente()
    const tentativas = ['2026-09-30', '2026-10-03'].map((dia) => ({ dia, canal: 'chatwoot' as const, resultado: 'sem-resposta' as const, quem: 'ana' }))
    await banco.insert(documentacaoMedica).values({ casoId: processoId, parte: 'complemento', documento: [pedido(fichaId, processoId, { abertaEm: '2026-09-29T13:00:00.000Z', tentativas })] })
    expect((await json('ana', 'GET', `/api/fichas/${fichaId}/mensagens/complemento?processo=${processoId}`)).trava).toMatch(/a sênior decide \(G15\)\.$/)
  })

  it('o resultado desfavorável: só com o resumo aprovado pelo Jurídico, e o texto aprovado não muda', async () => {
    const { fichaId, processoId } = await cliente()
    const url = `/api/fichas/${fichaId}/mensagens`
    expect((await json('ana', 'GET', `${url}/resultado-desfavoravel`)).trava).toBe(MSG_SEM_TEXTO_APROVADO)
    const resumo = 'Olá, Maria. O INSS negou o benefício porque a renda da casa passou do limite. Podemos conversar sobre o que fazer.'
    await abrirExplicacaoDoResultado(banco, processoId)
    expect((await chamar('paula', 'POST', `/api/casos/${processoId}/resultado/resumo`, { texto: resumo, quemFala: 'atendimento' })).statusCode).toBe(201)
    const pronta = await json('ana', 'GET', `${url}/resultado-desfavoravel`)
    expect(pronta).toMatchObject({ trava: null, editavel: false, texto: `${resumo} ${NUNCA_A_SENHA}` })
    const envio = (texto: string) => ({ modelo: 'resultado-desfavoravel', texto, conversa: pronta.conversas[0].id })
    expect((await json('ana', 'POST', url, envio(`${resumo} Ligue para nós.`))).erro).toBe('O texto aprovado não muda: o aviso sai como foi revisado.')
    expect(await json('ana', 'POST', url, envio(pronta.texto))).toMatchObject({ modelo: 'resultado-desfavoravel', status: 'entregue' })
  })

  it('o resultado favorável: o G8 antes de tudo (o OK da advogada na prestação de contas), e depois o texto aprovado', async () => {
    const { fichaId, processoId } = await cliente()
    const url = `/api/fichas/${fichaId}/mensagens/resultado-favoravel`
    const resumo = 'Olá, Maria! Boa notícia: o INSS aprovou o seu benefício. Vamos combinar com você a ida ao banco.'
    await abrirExplicacaoDoResultado(banco, processoId)
    await chamar('paula', 'POST', `/api/casos/${processoId}/resultado/resumo`, { texto: resumo, quemFala: 'atendimento' })
    // Com o texto aprovado, mas sem o OK da advogada, não sai (G8), nem pelo envio direto.
    expect((await json('ana', 'GET', url)).trava).toBe(MSG_SEM_OK_DA_ADVOGADA)
    const envio = { modelo: 'resultado-favoravel', texto: `${resumo} ${NUNCA_A_SENHA}`, conversa: 0 }
    expect((await json('ana', 'POST', `/api/fichas/${fichaId}/mensagens`, envio)).erro).toBe(MSG_SEM_OK_DA_ADVOGADA)
    const [paula] = await banco.select().from(usuario).where(eq(usuario.email, 'paula@exemplo.ggv'))
    await banco.insert(prestacaoContas).values({ casoId: processoId, valorRecebido: '10000.00', honorarios: '3000.00', valorCliente: '7000.00', okAdvogadaPor: paula.id, okAdvogadaEm: relogio })
    expect(await json('ana', 'GET', url)).toMatchObject({ trava: null, editavel: false, texto: envio.texto })
  })
})

describe('GGVP-146 · mensagens pelo Chatwoot de verdade, no servidor', () => {
  // Endereço, conta e caixa inventados; o token é de teste. Nada aqui chama o Chatwoot de verdade. É a homologação, com a
  // lista de teste: outro telefone e o da Maria, escrito de outro jeito.
  const CHATWOOT = {
    CHATWOOT_URL: 'https://chatwoot.teste',
    CHATWOOT_CONTA: '7',
    CHATWOOT_CAIXA: '9',
    CHATWOOT_TOKEN: 'token-de-teste',
    AMBIENTE: 'homologacao',
    CHATWOOT_PERMITIDOS: '(21) 99876-0000, +55 11 98765-4321',
  }
  const API = `${CHATWOOT.CHATWOOT_URL}/api/v1/accounts/${CHATWOOT.CHATWOOT_CONTA}`
  type Chamada = { metodo: string; caminho: string; corpo?: unknown; token?: string }

  /** O `fetch` falso: cada "MÉTODO /caminho" responde o JSON da tabela, ou a função (que pode lançar ou dar um Response). */
  async function comChatwoot(rotas: Record<string, unknown>, ambiente: Record<string, string> = {}) {
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
    for (const [nome, valor] of Object.entries({ ...CHATWOOT, ...ambiente })) vi.stubEnv(nome, valor)
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
    expect(pronta).toMatchObject({ simulado: false, contato: null, conversas: [], consulta: 'falhou' })
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

  it('a consulta que cai no envio não troca a conversa escolhida, não abre outra e não repete o que já saiu', async () => {
    let fora = false
    const chamadas = await comChatwoot({
      'GET /contacts/search?q=87654321': () => {
        if (fora) throw new TypeError('fetch failed')
        return { payload: [{ id: 31, name: 'Maria Ribeiro', phone_number: '+5511987654321', contact_inboxes: [{ source_id: 's', inbox: { id: 9, name: 'GGV PREV' } }] }] }
      },
      'GET /contacts/31/conversations': {
        payload: [
          { id: 501, inbox_id: 9, status: 'resolved', last_activity_at: 1759900000 },
          { id: 502, inbox_id: 9, status: 'open', last_activity_at: 1759910000 },
        ],
      },
      // A leitura de uma conversa que falha não apaga a lista: conta 0.
      'GET /conversations/501/messages': () => new Response(null, { status: 500 }),
      'GET /conversations/502/messages': { payload: [{}] },
      'POST /conversations/502/messages': { id: 9001, status: 'sent' },
    })
    const { fichaId } = await cliente()
    const url = `/api/fichas/${fichaId}/mensagens`
    const pronta = await json('ana', 'GET', `${url}/boas-vindas`)
    expect(pronta.consulta).toBeUndefined()
    expect(pronta.conversas.map((c: { id: number; mensagens: number }) => [c.id, c.mensagens])).toEqual([
      [502, 1],
      [501, 0],
    ])
    const envio = { modelo: 'boas-vindas', texto: pronta.texto, conversa: 502 }
    // A pessoa escolheu a 502; no envio, a consulta cai: nada sai, e fica registrado como "não saiu".
    fora = true
    expect(await json('ana', 'POST', url, envio)).toMatchObject({ status: 'falhou', conversa: 502, erro: 'o Chatwoot não respondeu; tente de novo em alguns minutos' })
    expect(posts(chamadas)).toEqual([])
    fora = false
    const enviada = await json('ana', 'POST', url, envio)
    expect(enviada).toMatchObject({ status: 'enviada', conversa: 502 })
    // O reenvio com a consulta caída acha o que já saiu na 502 e não manda de novo.
    fora = true
    expect((await json('ana', 'POST', url, envio)).id).toBe(enviada.id)
    expect(posts(chamadas).map((c) => c.caminho)).toEqual(['/conversations/502/messages'])
  })

  it('a trava da homologação: fora da lista de teste (ou sem lista), nem a consulta nem o envio chamam o Chatwoot, e fica como não enviado', async () => {
    const { fichaId } = await cliente()
    const url = `/api/fichas/${fichaId}/mensagens`
    for (const lista of ['(21) 99876-0000', '']) {
      const chamadas = await comChatwoot({ 'POST /conversations/502/messages': { id: 9001, status: 'sent' } }, { CHATWOOT_PERMITIDOS: lista })
      const pronta = await json('ana', 'GET', `${url}/boas-vindas`)
      expect(pronta).toMatchObject({ simulado: false, contato: null, conversas: [], foraDaLista: true })
      expect(await json('ana', 'POST', url, { modelo: 'boas-vindas', texto: pronta.texto, conversa: 502 })).toMatchObject({ status: 'falhou', conversa: 0, erro: MSG_FORA_DA_LISTA })
      expect(chamadas).toEqual([])
      expect((await json('ana', 'GET', `/api/fichas/${fichaId}`)).historico.at(-1).oQue).toBe(`A mensagem «Boas-vindas» não saiu pelo Chatwoot: ${MSG_FORA_DA_LISTA}. Nada foi reenviado sozinho.`)
    }
    const registros = await banco.select().from(mensagem).where(eq(mensagem.pessoaId, fichaId))
    expect(registros.map((r) => [r.status, r.erro])).toEqual([
      ['falhou', MSG_FORA_DA_LISTA],
      ['falhou', MSG_FORA_DA_LISTA],
    ])
  })

  it('em produção, sem lista: a mensagem sai para o telefone da ficha', async () => {
    const chamadas = await comChatwoot(
      {
        'GET /contacts/search?q=87654321': { payload: [{ id: 31, name: 'Maria Ribeiro', phone_number: '+5511987654321', contact_inboxes: [{ source_id: 's', inbox: { id: 9, name: 'GGV PREV' } }] }] },
        'GET /contacts/31/conversations': { payload: [{ id: 502, inbox_id: 9, status: 'open', last_activity_at: 1759910000 }] },
        'GET /conversations/502/messages': { payload: [{}] },
        'POST /conversations/502/messages': { id: 9001, status: 'sent' },
      },
      { AMBIENTE: 'producao', CHATWOOT_PERMITIDOS: '' },
    )
    const { fichaId } = await cliente()
    const pronta = await json('ana', 'GET', `/api/fichas/${fichaId}/mensagens/boas-vindas`)
    expect(pronta.foraDaLista).toBeUndefined()
    expect(await json('ana', 'POST', `/api/fichas/${fichaId}/mensagens`, { modelo: 'boas-vindas', texto: pronta.texto, conversa: 502 })).toMatchObject({ status: 'enviada', conversa: 502 })
    expect(posts(chamadas).map((c) => c.caminho)).toEqual(['/conversations/502/messages'])
  })
})
