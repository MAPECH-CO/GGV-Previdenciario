import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, mensagem, pessoa, tarefaRecepcao, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
const relogio = new Date('2026-10-08T15:00:00Z')
const SO_COM_VERIFICACAO = 'Telefone, e-mail e dados bancários só mudam com o cliente verificado por chamada de vídeo ou no escritório.'

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const json = async (apelido: string, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) => (await chamar(apelido, method, url, payload)).json()
const portoes = async () => (await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'portao_bloqueado'))).map((e) => e.detalhe as Record<string, unknown>)

const novaFicha = (telefone: string, email?: string) =>
  json('ana', 'POST', '/api/fichas', { nome: 'Lúcia Ribeiro', idade: 70, pretende: 'Pensão.', telefone, email, beneficioInteresse: 'pensao-morte', outraPessoa: false })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, agora: () => relogio })
  for (const [apelido, perfil] of [['ana', 'atendimento'], ['eva', 'atendimento_lider'], ['gabi', 'advogada'], ['marcos', 'financeiro'], ['dora', 'documentacao'], ['igor', 'juridico_adm']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
})
afterEach(async () => {
  await app.close()
  await fechar()
})

describe('GGVP-138 · terceiro não se passa pelo cliente, no servidor', () => {
  it('editar a ficha: telefone e e-mail só mudam com o cliente verificado e em contrato novo; completar o que estava em branco, não', async () => {
    const { id } = await novaFicha('11987654321')
    const url = `/api/fichas/${id}`
    const edicao = { nome: 'Lúcia Ribeiro', telefone: '(11) 90000-0077', email: 'lucia@exemplo.com' }
    expect((await json('ana', 'PATCH', url, edicao)).erro).toBe(SO_COM_VERIFICACAO)
    expect(await portoes()).toEqual([expect.objectContaining({ portao: 'verificacao', passo: 'ficha', campos: ['telefone'] })])
    expect((await json('ana', 'PATCH', url, { ...edicao, verificacao: { como: 'video' } })).erro).toBe('A alteração vai em contrato novo: marque que ela vai no contrato novo.')
    // O e-mail estava em branco: completar não pede a verificação.
    expect((await json('ana', 'PATCH', url, { ...edicao, telefone: '11987654321' })).ficha.email).toBe('lucia@exemplo.com')

    const r = await json('ana', 'PATCH', url, { ...edicao, verificacao: { como: 'video', contratoNovo: true } })
    expect(r.ficha.telefone).toBe('11900000077')
    expect(r.ficha.historico.map((e: { oQue: string }) => e.oQue)).toContain('Mudou o telefone (chamada de vídeo com o cliente; em contrato novo): «(11) 98765-4321» → «(11) 90000-0077»')
    const [p] = await banco.select().from(pessoa).where(eq(pessoa.id, id))
    expect(p.telefone).toBe('11900000077')
  })

  it('dados bancários: pedido só com a verificação; a segunda confirmação é de outra pessoa, não do Atendimento; o contato anterior recebe o aviso', async () => {
    const { id } = await novaFicha('11987654321')
    const url = `/api/fichas/${id}/dados-bancarios`
    const dados = { banco: 'Banco Exemplo', agencia: '0001', conta: '12345-6' }
    expect((await chamar('marcos', 'POST', url, { dados, verificacao: { como: 'presencial', contratoNovo: true } })).statusCode).toBe(403)
    expect((await json('ana', 'POST', url, { dados: { ...dados, agencia: '1' }, verificacao: { como: 'presencial', contratoNovo: true } })).erro).toMatch(/^Agência com 4 números/)
    expect((await json('ana', 'POST', url, { dados })).erro).toBe(SO_COM_VERIFICACAO)
    expect(await portoes()).toEqual([expect.objectContaining({ portao: 'verificacao', passo: 'D3b.02' })])

    const pedido = await json('ana', 'POST', url, { dados, verificacao: { como: 'presencial', contratoNovo: true } })
    expect(pedido).toMatchObject({ fichaId: id, dados, verificacao: { como: 'presencial', contratoNovo: true }, pediu: 'ana' })
    // GGVP-96 (LGPD, minimização): quem pede ou confirma e o Financeiro, que repassa; a Documentação e o Jurídico adm, não.
    expect(await json('marcos', 'GET', url)).toMatchObject({ atual: null, pedido: { pediu: 'ana' } })
    for (const apelido of ['dora', 'igor']) expect((await chamar(apelido, 'GET', url)).statusCode, apelido).toBe(403)
    expect(await json('ana', 'GET', url)).toMatchObject({ atual: null, pedido: { pediu: 'ana' } })

    const confirmacao = `${url}/confirmacao`
    expect((await chamar('ana', 'POST', confirmacao)).statusCode).toBe(403)
    const novo = await json('eva', 'POST', confirmacao)
    expect(novo).toMatchObject({ ...dados, fichaId: id, quem: 'ana' })
    expect(await json('ana', 'GET', url)).toMatchObject({ atual: dados, pedido: null })
    const ficha = await json('ana', 'GET', `/api/fichas/${id}`)
    expect(ficha.historico.map((e: { oQue: string }) => e.oQue)).toEqual(
      expect.arrayContaining([
        'Mudou os dados bancários (cliente no escritório; em contrato novo; pedido de ana, segunda confirmação de eva): «—» → «Banco Exemplo · agência 0001 · conta 12345-6»',
        'Enviou pelo Chatwoot a mensagem «Aviso de mudança dos dados» (entregue)',
      ]),
    )
    const [aviso] = await banco.select().from(mensagem)
    expect(aviso).toMatchObject({ modelo: 'aviso-de-mudanca', status: 'entregue' })
    // Sem caso perto da prestação de contas, nenhum alerta.
    expect(await banco.select().from(tarefaRecepcao).where(eq(tarefaRecepcao.setor, 'Financeiro'))).toHaveLength(0)
    expect((await chamar('eva', 'POST', confirmacao)).statusCode).toBe(404)
  })

  it('quem pediu não dá a segunda confirmação; perto da prestação de contas, a advogada e o Financeiro recebem o alerta', async () => {
    const { id } = await novaFicha('11987654321')
    await banco.insert(caso).values({ pessoaId: id, beneficio: 'pensao_morte', fase: 'judicial', desfecho: 'procedente_total' })
    const url = `/api/fichas/${id}/dados-bancarios`
    await json('gabi', 'POST', url, { dados: { banco: 'Banco Exemplo', agencia: '0001', conta: '12345-6' }, verificacao: { como: 'video', contratoNovo: true } })
    expect((await json('gabi', 'POST', `${url}/confirmacao`)).erro).toBe('A segunda confirmação é de outra pessoa, não de quem pediu.')
    await json('eva', 'POST', `${url}/confirmacao`)
    const alertas = await banco.select().from(tarefaRecepcao)
    expect(alertas.map((t) => t.setor).sort()).toEqual(['Financeiro', 'Jurídico'])
    expect(alertas[0].dados).toMatchObject({ acao: 'Dados bancários mudaram', urgente: true })
  })
})
