import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, chamadaIa, decisao, etapa, exigencia, parecerMedico, pericia, pessoa, publicacao, tarefa, usuario } from '../banco/esquema.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_JA_APROVADA, TITULO_CONFERIR } from './recomendacao-pericia.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
let doInss: string
let doJuiz: string
const RECOMENDACAO = {
  oQueLevar: ['Relatório do médico assistente com as limitações do dia a dia', 'Receitas dos últimos 6 meses'],
  pontosFortes: ['Parecer suficiente'],
  pontosFracos: ['Falta exame de imagem recente'],
  quesitos: ['O autor consegue ficar em pé por mais de uma hora?'],
  assistenteTecnico: { indicar: true, porque: 'A doença tem laudos conflitantes.' },
}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, metodo: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({ method: metodo, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const abertas = async () =>
  (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))).map((t) => `${t.perfilDono} · ${t.titulo}`).sort()

let pedidos: string[] = []
function comIa(resposta: object = RECOMENDACAO) {
  pedidos = []
  const fetch = async (_url: unknown, init?: RequestInit) => {
    pedidos.push(JSON.parse(String(init?.body)).messages[1].content)
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(resposta) } }] }))
  }
  app = criarServidor({ banco, ia: criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' }, fetch }) })
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  const ids: Record<string, string> = {}
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['igor', 'juridico_adm'], ['ana', 'atendimento']] as const) {
    const [u] = await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false }).returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Sebastião Cruz' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'judicial' }).returning()
  casoId = c.id
  await banco.insert(parecerMedico).values({ casoId, roteiroVersao: 1, resultado: 'suficiente', itens: [{ item: 'limitações do dia a dia', atendido: true }], confirmadoPor: ids.igor, confirmadoEm: new Date() })
  const [d2] = await banco.insert(etapa).values({ casoId, diagrama: 'D2', passo: 'D2.03', situacao: 'concluida', iniciadaEm: new Date() }).returning()
  const [d3a] = await banco.insert(etapa).values({ casoId, diagrama: 'D3a', passo: 'D3a.03', situacao: 'concluida', iniciadaEm: new Date() }).returning()
  ;[{ id: doInss }] = await banco.insert(pericia).values({ casoId, tipo: 'social', chamadaPorEtapaId: d2.id }).returning()
  ;[{ id: doJuiz }] = await banco.insert(pericia).values({ casoId, tipo: 'medica', chamadaPorEtapaId: d3a.id }).returning()
  await banco.insert(tarefa).values({ casoId, passo: 'DP.01', titulo: 'Marcar perícia médica e avaliação social', perfilDono: 'juridico_adm' })
  const [pub] = await banco
    .insert(publicacao)
    .values({ fonte: 'aasp', casoId, disponibilizadaEm: '2026-10-01', texto: 'Determino a realização de perícia médica com ortopedista. Int.', hash: 'h-ordem', classe: 'exigencia' })
    .returning()
  await banco.insert(exigencia).values({ casoId, origem: 'juizo', descricao: pub.texto, recebidaEm: '2026-10-01', publicacaoId: pub.id, pede: 'pericia' })
  comIa()
})
afterEach(() => fechar())

describe('GGVP-38 · recomendação sobre a perícia', () => {
  it('CA1, CA3 · a rodada prepara a recomendação de cada perícia; a advogada tem uma tarefa; a do juiz traz quesitos, a do INSS não', async () => {
    await app.prepararSugestoes()
    expect(pedidos).toHaveLength(2)
    const doJuizEnviado = pedidos.find((p) => p.includes('determinada pelo juiz'))!
    for (const trecho of ['(perícia judicial)', 'Ordem do juiz: Determino a realização de perícia médica com ortopedista', 'Perito: não identificado', 'Parecer médico: suficiente'])
      expect(doJuizEnviado).toContain(trecho)
    expect(pedidos.find((p) => p.includes('pedida no INSS'))).toContain('(não é judicial)')
    expect(await abertas()).toEqual([`advogada · ${TITULO_CONFERIR}`, 'juridico_adm · Marcar perícia médica e avaliação social'])
    const juiz = (await chamar('gabi', 'POST', `/api/pericias/${doJuiz}/recomendacao/sugestao`)).json()
    const inss = (await chamar('gabi', 'POST', `/api/pericias/${doInss}/recomendacao/sugestao`)).json()
    expect([juiz.recomendacao.quesitos, juiz.recomendacao.assistenteTecnico.indicar]).toEqual([RECOMENDACAO.quesitos, true])
    expect([inss.recomendacao.oQueLevar, inss.recomendacao.quesitos, inss.recomendacao.assistenteTecnico]).toEqual([RECOMENDACAO.oQueLevar, [], null])
    expect(pedidos).toHaveLength(2)
    await app.prepararSugestoes()
    expect((await abertas()).filter((t) => t.includes(TITULO_CONFERIR))).toHaveLength(1)
  })

  it('CA4 · só a advogada aprova, editando; a decisão guarda a chamada à parte; aprovadas as duas, a tarefa fecha; a do Jurídico administrativo fica', async () => {
    await app.prepararSugestoes()
    const s = (await chamar('gabi', 'POST', `/api/pericias/${doJuiz}/recomendacao/sugestao`)).json()
    const corpo = { oQueLevar: ['Relatório do médico assistente'], quesitos: ['O autor consegue ficar em pé por mais de uma hora?'], assistenteTecnico: false, chamadaIaId: s.sugestao.chamadaId }
    expect((await chamar('igor', 'POST', `/api/pericias/${doJuiz}/recomendacao`, corpo)).statusCode).toBe(403)
    expect((await chamar('gabi', 'POST', `/api/pericias/${doJuiz}/recomendacao`, { ...corpo, oQueLevar: [] })).json().erro).toBe('Deixe ao menos um item em "O que levar"')
    expect((await chamar('gabi', 'POST', `/api/pericias/${doJuiz}/recomendacao`, corpo)).statusCode).toBe(201)
    expect((await chamar('gabi', 'POST', `/api/pericias/${doJuiz}/recomendacao`, corpo)).json().erro).toBe(MSG_JA_APROVADA)
    const [d] = await banco.select().from(decisao).where(eq(decisao.tipo, 'recomendacao_pericia'))
    expect([d.passo, d.sugestaoIa]).toEqual(['DP.00', { chamadaId: s.sugestao.chamadaId }])
    expect((await abertas()).filter((t) => t.includes(TITULO_CONFERIR))).toHaveLength(1)
    // Na perícia do INSS, quesitos e assistente técnico não ficam, mesmo se vierem.
    expect((await chamar('gabi', 'POST', `/api/pericias/${doInss}/recomendacao`, { ...corpo, chamadaIaId: undefined })).statusCode).toBe(201)
    expect(await abertas()).toEqual(['juridico_adm · Marcar perícia médica e avaliação social'])
    const lista = (await chamar('igor', 'GET', `/api/casos/${casoId}/pericias`)).json()
    const [inss, juiz] = [lista.pericias.find((p: { id: string }) => p.id === doInss), lista.pericias.find((p: { id: string }) => p.id === doJuiz)]
    expect([juiz.judicial, juiz.aprovada.oQueLevar, juiz.aprovada.assistenteTecnico, juiz.aprovada.por, lista.podeAprovar]).toEqual([true, ['Relatório do médico assistente'], false, 'gabi', false])
    expect([inss.judicial, inss.aprovada.quesitos, inss.aprovada.assistenteTecnico]).toEqual([false, [], null])
    expect((await chamar('ana', 'GET', `/api/casos/${casoId}/pericias`)).statusCode).toBe(403)
  })

  it('perícia com resultado não ganha recomendação; resposta fora do formato não vira recomendação nem tarefa', async () => {
    await banco.update(pericia).set({ resultado: 'favoravel' }).where(eq(pericia.id, doJuiz))
    comIa({ oQueLevar: [] })
    await app.prepararSugestoes()
    expect(pedidos).toHaveLength(1)
    expect((await banco.select().from(chamadaIa)).map((c) => [c.situacao, c.erro])).toEqual([['falhou', 'saída fora do formato']])
    expect(await abertas()).toEqual(['juridico_adm · Marcar perícia médica e avaliação social'])
    expect((await chamar('gabi', 'POST', `/api/pericias/${doInss}/recomendacao/sugestao`)).json().motivo).toBe('A IA não respondeu agora: escreva a recomendação pela sua leitura.')
  })
})
