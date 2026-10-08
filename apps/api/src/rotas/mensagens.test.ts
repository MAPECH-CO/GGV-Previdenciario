import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, mensagem, pericia, usuario } from '../banco/esquema.ts'
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
