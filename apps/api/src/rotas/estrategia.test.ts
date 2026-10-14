import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, chamadaIa, decisao, eventoAuditoria, parecerMedico, pessoa, resultadoInss, usuario } from '../banco/esquema.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_CHAMADA_DE_OUTRO, MSG_SEM_PROPOSTA } from './estrategia.ts'

// GGVP-158 P7.1: a estratégia do caso. A IA é de mentira: devolve a proposta quando o pedido é de estratégia.
const SENHA = 'senha-do-portal-1'
const PROPOSTA = 'Provar a incapacidade com o laudo do assistente e o parecer suficiente; o risco é a perícia do INSS; o próximo passo é a inicial.'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
let outroCasoId: string
let saida: object = { estrategia: PROPOSTA }
let enviado = ''

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, method: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({ method, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const chamadas = async () => (await banco.select().from(chamadaIa).where(eq(chamadaIa.finalidade, 'estrategia_do_caso'))).length

function montar(comChave = true) {
  const fetch = async (_url: unknown, init?: RequestInit) => {
    const corpo = JSON.parse(String(init?.body)) as { messages: { content: string }[] }
    const daEstrategia = corpo.messages[0].content.includes('estratégia de um processo')
    if (daEstrategia) enviado = corpo.messages[1].content
    return new Response(JSON.stringify({ choices: [{ message: { content: daEstrategia ? JSON.stringify(saida) : 'Texto.' } }] }))
  }
  const ambiente: Record<string, string> = comChave ? { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' } : {}
  app = criarServidor({ banco, ia: criarIa({ banco, ambiente, fetch }) })
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  saida = { estrategia: PROPOSTA }
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['helena', 'senior'], ['ana', 'atendimento'], ['lauro', 'socio']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  const [p] = await banco.insert(pessoa).values({ nome: 'Marta Alves' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'auxilio_incapacidade_temporaria', fase: 'administrativa' }).returning()
  casoId = c.id
  const [outro] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  outroCasoId = outro.id
  await banco.insert(parecerMedico).values({ casoId, roteiroVersao: 1, resultado: 'suficiente' })
  await banco.insert(resultadoInss).values({ casoId, resultado: 'indeferido', dataDecisao: '2026-10-01', motivoIndeferimento: 'Não constatada incapacidade.' })
  montar()
})
afterEach(() => fechar())

describe('GGVP-158 P7.1 · a estratégia do caso: a IA propõe, e o Jurídico confere', () => {
  it('a proposta fica pronta na rodada, com o que o caso tem e as fontes; abrir não chama a IA de novo', async () => {
    await app.prepararSugestoes()
    expect(await chamadas()).toBe(1)
    for (const trecho of ['Benefício: Auxílio por Incapacidade Temporária', 'Não constatada incapacidade', 'Parecer médico: suficiente']) expect(enviado).toContain(trecho)
    const r = (await chamar('gabi', 'GET', `/api/casos/${casoId}/estrategia`)).json()
    expect([r.atual, r.versoes, r.aviso, r.podeSalvar]).toEqual([null, [], null, true])
    expect(JSON.parse(r.sugestao.texto)).toEqual({ estrategia: PROPOSTA })
    expect(r.sugestao.fontes[0]).toMatchObject({ tipo: 'caso', referencia: `caso:${casoId}` })
    expect(await chamadas()).toBe(1)
    // O Sócio lê, sem salvar.
    expect((await chamar('lauro', 'GET', `/api/casos/${casoId}/estrategia`)).json().podeSalvar).toBe(false)
  })

  it('a advogada ajusta e salva: a versão fica com quem e quando, e o histórico diz que veio da IA e foi ajustada; a Sênior salva outra', async () => {
    const r = (await chamar('gabi', 'GET', `/api/casos/${casoId}/estrategia`)).json()
    const ajustada = `${PROPOSTA} Juntar o relatório do ortopedista.`
    const salva = await chamar('gabi', 'POST', `/api/casos/${casoId}/estrategia`, { texto: ajustada, chamadaIaId: r.sugestao.chamadaId })
    expect(salva.statusCode).toBe(201)
    expect(salva.json().atual).toMatchObject({ texto: ajustada, por: 'gabi', daIa: true })
    const [ev] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'estrategia_registrada'))
    expect(ev.detalhe).toMatchObject({ daIa: true, ajustada: true })
    expect(JSON.stringify(ev.detalhe)).not.toContain('ortopedista')
    await chamar('helena', 'POST', `/api/casos/${casoId}/estrategia`, { texto: 'Esperar a perícia judicial e só então decidir a inicial.' })
    const depois = (await chamar('gabi', 'GET', `/api/casos/${casoId}/estrategia`)).json()
    expect([depois.atual.texto, depois.atual.daIa, depois.versoes.map((v: { por: string }) => v.por)]).toEqual(['Esperar a perícia judicial e só então decidir a inicial.', false, ['helena', 'gabi']])
    // O resumo do processo traz o texto que vale.
    expect((await chamar('gabi', 'GET', `/api/casos/${casoId}/processo`)).json().estrategia).toBe('Esperar a perícia judicial e só então decidir a inicial.')
  })

  it('fora do Jurídico: o Atendimento não lê, nem no resumo do processo; nem salva', async () => {
    await chamar('gabi', 'POST', `/api/casos/${casoId}/estrategia`, { texto: 'Um caminho qualquer para o caso, só do Jurídico.' })
    expect((await chamar('ana', 'GET', `/api/casos/${casoId}/estrategia`)).statusCode).toBe(403)
    expect((await chamar('ana', 'POST', `/api/casos/${casoId}/estrategia`, { texto: 'O Atendimento tenta escrever a estratégia.' })).statusCode).toBe(403)
    const resumo = (await chamar('ana', 'GET', `/api/casos/${casoId}/processo`)).json()
    expect(resumo.estrategia).toBeUndefined()
    expect(JSON.stringify(resumo)).not.toContain('Um caminho qualquer')
  })

  it('a proposta de outro caso, o texto curto e a saída fora do formato não valem; sem a IA, o aviso', async () => {
    const r = (await chamar('gabi', 'GET', `/api/casos/${casoId}/estrategia`)).json()
    const deOutro = await chamar('gabi', 'POST', `/api/casos/${outroCasoId}/estrategia`, { texto: PROPOSTA, chamadaIaId: r.sugestao.chamadaId })
    expect([deOutro.statusCode, deOutro.json().erro]).toEqual([400, MSG_CHAMADA_DE_OUTRO])
    expect((await chamar('gabi', 'POST', `/api/casos/${casoId}/estrategia`, { texto: 'curta' })).json().erro).toBe('Escreva a estratégia (pelo menos 20 letras)')
    expect(await banco.select().from(decisao)).toEqual([])
    saida = { outra: 'coisa' }
    expect((await chamar('gabi', 'GET', `/api/casos/${outroCasoId}/estrategia`)).json()).toMatchObject({ sugestao: null, aviso: MSG_SEM_PROPOSTA })
    // Sem a IA: o caso sem proposta guardada fica com o aviso; a proposta já pronta de outro caso continua lá.
    await app.close()
    montar(false)
    expect((await chamar('gabi', 'GET', `/api/casos/${outroCasoId}/estrategia`)).json()).toMatchObject({ sugestao: null, aviso: MSG_SEM_PROPOSTA })
    expect((await chamar('gabi', 'GET', `/api/casos/${casoId}/estrategia`)).json().sugestao.chamadaId).toBe(r.sugestao.chamadaId)
  })

  it('pedir outra proposta chama a IA de novo, mesmo com o caso igual', async () => {
    await chamar('gabi', 'GET', `/api/casos/${casoId}/estrategia`)
    saida = { estrategia: `${PROPOSTA} Outra versão.` }
    const outra = (await chamar('gabi', 'POST', `/api/casos/${casoId}/estrategia/sugestao`)).json()
    expect(JSON.parse(outra.sugestao.texto).estrategia).toContain('Outra versão.')
    expect(await chamadas()).toBe(2)
    expect((await chamar('ana', 'POST', `/api/casos/${casoId}/estrategia/sugestao`)).statusCode).toBe(403)
  })
})
