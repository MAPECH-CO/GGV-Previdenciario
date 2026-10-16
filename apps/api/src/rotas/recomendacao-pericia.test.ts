import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { acessoDadoSensivel, caso, chamadaIa, decisao, etapa, exigencia, parecerMedico, pericia, pessoa, processoAcervo, publicacao, tarefa, usuario } from '../banco/esquema.ts'
import { REGRA_DA_CHANCE } from '../fluxo/chance.ts'
import { MSG_CHAMADA_DE_OUTRO_CASO, criarIa } from '../ia/ia.ts'
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
    const corpo = JSON.parse(String(init?.body)) as { messages: { content: string }[] }
    // Só as chamadas da recomendação contam: a rodada também prepara a estratégia do caso (GGVP-158 P7.1).
    if (corpo.messages[0].content.includes('para uma perícia do cliente')) pedidos.push(corpo.messages[1].content)
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
    // GGVP-158: a chamada que não é deste caso é recusada, e nada é gravado.
    expect((await chamar('gabi', 'POST', `/api/pericias/${doJuiz}/recomendacao`, { ...corpo, chamadaIaId: crypto.randomUUID() })).json().erro).toBe(MSG_CHAMADA_DE_OUTRO_CASO)
    expect(await banco.select().from(decisao).where(eq(decisao.tipo, 'recomendacao_pericia'))).toHaveLength(0)
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
    const daRecomendacao = await banco.select().from(chamadaIa).where(eq(chamadaIa.finalidade, 'recomendacao_pericia'))
    expect(daRecomendacao.map((c) => [c.situacao, c.erro])).toEqual([['falhou', 'saída fora do formato']])
    expect(await abertas()).toEqual(['juridico_adm · Marcar perícia médica e avaliação social'])
    expect((await chamar('gabi', 'POST', `/api/pericias/${doInss}/recomendacao/sugestao`)).json().motivo).toBe('A IA não respondeu agora: escreva a recomendação pela sua leitura.')
  })
})

describe('GGVP-158 P8.1 · quem abre a recomendação fica registrado', () => {
  const leituras = async () => (await banco.select().from(acessoDadoSensivel)).map((a) => [a.perfil, a.casoId, a.recurso])

  it('a recomendação da IA e as perícias com a recomendação aprovada registram a leitura, com o caso', async () => {
    // Sem recomendação aprovada, as perícias do caso não levam conteúdo médico: nada a registrar.
    await chamar('gabi', 'GET', `/api/casos/${casoId}/pericias`)
    expect(await leituras()).toEqual([])
    await app.prepararSugestoes()
    const s = (await chamar('gabi', 'POST', `/api/pericias/${doJuiz}/recomendacao/sugestao`)).json()
    expect(await leituras()).toEqual([['advogada', casoId, `recomendacao:${doJuiz}`]])
    const corpo = { oQueLevar: ['Relatório do médico assistente'], quesitos: [], assistenteTecnico: false, chamadaIaId: s.sugestao.chamadaId }
    expect((await chamar('gabi', 'POST', `/api/pericias/${doJuiz}/recomendacao`, corpo)).statusCode).toBe(201)
    await chamar('igor', 'GET', `/api/casos/${casoId}/pericias`)
    expect((await leituras()).at(-1)).toEqual(['juridico_adm', casoId, `pericias:${casoId}`])
  })

  it('a sugestão sem recomendação (a IA fora do formato) não registra', async () => {
    comIa({ oQueLevar: [] })
    expect((await chamar('gabi', 'POST', `/api/pericias/${doInss}/recomendacao/sugestao`)).json().recomendacao).toBeNull()
    expect(await leituras()).toEqual([])
  })
})

describe('GGVP-151 e GGVP-38 · a chance do caso com a recomendação da perícia aberta', () => {
  const CHANCE_INVENTADA = 'A chance é de 99%: este perito sempre concede.'
  let doFator = ''
  /** A IA de mentira escreve a recomendação e, nos fatores da chance, um número que não é o do código. */
  function comIaQueInventa() {
    pedidos = []
    const fetch = async (_url: unknown, init?: RequestInit) => {
      const corpo = JSON.parse(String(init?.body)) as { messages: { content: string }[] }
      const daRecomendacao = corpo.messages[0].content.includes('para uma perícia do cliente')
      if (daRecomendacao) pedidos.push(corpo.messages[1].content)
      else doFator = corpo.messages[1].content
      return new Response(JSON.stringify({ choices: [{ message: { content: daRecomendacao ? JSON.stringify(RECOMENDACAO) : CHANCE_INVENTADA } }] }))
    }
    app = criarServidor({ banco, ia: criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' }, fetch }) })
  }
  /** O acervo conferido do mesmo benefício: dois favoráveis, um desfavorável e uma desistência (que não conta). */
  async function acervoDecidido() {
    const [gabi] = await banco.select().from(usuario).where(eq(usuario.email, 'gabi@exemplo.ggv'))
    const desfechos = ['deferido', 'procedente_total', 'improcedente', 'desistencia']
    await banco
      .insert(processoAcervo)
      .values(desfechos.map((desfecho, i) => ({ fonte: 'teste', beneficio: 'bpc_loas_deficiente', desfecho, desfechoConferidoPor: gabi.id, criadoEm: new Date(Date.UTC(2026, 8, 10 + i, 12)) })))
    // De outro benefício: não entra na conta.
    await banco.insert(processoAcervo).values({ fonte: 'teste', beneficio: 'bpc_loas_idoso', desfecho: 'improcedente', desfechoConferidoPor: gabi.id })
  }

  it('GGVP-151 CA2 · com a recomendação aberta (perícia sem resultado), a chance vem com os casos e a data da base', async () => {
    comIaQueInventa()
    await acervoDecidido()
    const abertas = (await chamar('gabi', 'GET', `/api/casos/${casoId}/pericias`)).json().pericias
    expect(abertas.map((p: { id: string; resultado: string | null; aprovada: unknown }) => [p.id, p.resultado, p.aprovada]).sort()).toEqual(
      [
        [doInss, null, null],
        [doJuiz, null, null],
      ].sort(),
    )
    expect((await chamar('gabi', 'POST', `/api/pericias/${doInss}/recomendacao/sugestao`)).json().recomendacao.oQueLevar).toEqual(RECOMENDACAO.oQueLevar)
    const r = await chamar('gabi', 'POST', `/api/casos/${casoId}/chance`)
    expect(r.statusCode).toBe(200)
    const chance = r.json()
    expect([chance.casos, chance.favoraveis, chance.porcentagem, chance.baseEm, chance.regra]).toEqual([3, 2, 67, '2026-09-13T12:00:00.000Z', REGRA_DA_CHANCE])
    // O Atendimento não vê a chance.
    expect((await chamar('ana', 'POST', `/api/casos/${casoId}/chance`)).statusCode).toBe(403)
  })

  it('GGVP-38 CA7 · o número vem do código, a partir do acervo: a IA que escreve outro número não muda a porcentagem, só explica com a regra como fonte; a recomendação não leva número do perito', async () => {
    comIaQueInventa()
    await acervoDecidido()
    await chamar('gabi', 'POST', `/api/pericias/${doJuiz}/recomendacao/sugestao`)
    expect(pedidos).toHaveLength(1)
    expect(pedidos[0]).toContain('Perito: não identificado')
    expect(pedidos[0]).not.toMatch(/\d+ ?%/)
    const chance = (await chamar('gabi', 'POST', `/api/casos/${casoId}/chance`)).json()
    expect(chance.porcentagem).toBe(67)
    expect(doFator).toContain('Chance calculada pelo sistema: 67% em 3 casos parecidos')
    expect(chance.fatores).toMatchObject({ texto: CHANCE_INVENTADA, fontes: [{ tipo: 'regra', referencia: REGRA_DA_CHANCE }] })
  })
})
