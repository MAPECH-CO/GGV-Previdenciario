import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, chamadaIa, decisao, eventoAuditoria, pessoa, publicacao, tarefa, usuario } from '../banco/esquema.ts'
import { criarIa } from '../ia/ia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_SEM_DECISAO, TITULO_DECIDIR, TITULO_RECORRER, abrirDecisaoDoRecurso } from './recurso.ts'
import { TITULO_RESUMO } from './resultado.ts'

const SENHA = 'senha-do-portal-1'
const JUSTIFICATIVA = 'O laudo do perito ignorou o relatório do médico assistente; há chance real na turma recursal.'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
const ids: Record<string, string> = {}

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, metodo: 'GET' | 'POST', payload?: object) =>
  app.inject({ method: metodo, url: `/api/casos/${casoId}/recurso`, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const abertas = async () =>
  (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))).map((t) => `${t.perfilDono} · ${t.titulo}`).sort()
const estudosFeitos = async () => (await banco.select().from(chamadaIa).where(and(eq(chamadaIa.finalidade, 'estudo_de_caso'), eq(chamadaIa.situacao, 'ok')))).length

/** A IA falsa (como no estudo de caso): devolve o estudo quando o pedido é de estudo de caso, e um texto simples nos outros. */
const ESTUDO = { materia: 'Auxílio-acidente', resumo: 'O perito não viu redução.', motivo: 'Laudo desfavorável.', aprendizado: 'Juntar o relatório do assistente.', chance: 'menor', novoProcesso: false }
const fetchDaIa = async (_url: unknown, init?: RequestInit) => {
  const corpo = JSON.parse(String(init?.body)) as { messages: { content: string }[] }
  const doEstudo = corpo.messages[0].content.includes('estudo de caso')
  return new Response(JSON.stringify({ choices: [{ message: { content: doEstudo ? JSON.stringify(ESTUDO) : 'Rascunho.' } }] }))
}

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco, ia: criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' }, fetch: fetchDaIa }) })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['helena', 'senior'], ['lauro', 'socio'], ['julia', 'financeiro'], ['ana', 'atendimento'], ['igor', 'juridico_adm']] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Sérgio Nunes', situacao: 'cliente' }).returning()
  const [c] = await banco
    .insert(caso)
    .values({ pessoaId: p.id, beneficio: 'auxilio_acidente', fase: 'judicial', desfecho: 'improcedente', advogadaResponsavelId: ids.gabi })
    .returning()
  casoId = c.id
  // Segunda 05/10/2026, sem feriado cadastrado: o recurso vence em 20/10 (10 dias úteis), não em 27/10 (15).
  await banco.insert(publicacao).values({ fonte: 'aasp', casoId, disponibilizadaEm: '2026-10-05', texto: 'Sentença: julgo improcedente o pedido.', hash: 'h-sentenca', classe: 'merito' })
  await abrirDecisaoDoRecurso(banco, casoId)
})
afterEach(() => fechar())

describe('GGVP-100 · improcedente: decidir se recorre', () => {
  it('CA4, CA7 · a tarefa é da Sênior, com o prazo recursal contado pelo lado seguro; na Central, o cliente e "Decidir recurso"', async () => {
    await abrirDecisaoDoRecurso(banco, casoId)
    expect(await abertas()).toEqual([`senior · ${TITULO_DECIDIR}`])
    const [t] = await banco.select().from(tarefa).where(eq(tarefa.casoId, casoId))
    expect([t.passo, t.prazo]).toEqual(['D3b.04', '2026-10-20'])
    const central = (await app.inject({ method: 'GET', url: '/api/tarefas', cookies: await cookieDe('helena') })).json() as { cliente: { nome: string }; titulo: string; tela: string }[]
    expect(central.map((x) => [x.cliente.nome, x.titulo, x.tela])).toEqual([['Sérgio Nunes', TITULO_DECIDIR, `/casos/${casoId}/recurso`]])
    const r = (await chamar('helena', 'GET')).json()
    expect([r.cliente, r.beneficio, r.sentenca.texto, r.prazo.fim, r.chance, r.decisao, r.podeDecidir]).toEqual([
      'Sérgio Nunes',
      'Auxílio-Acidente',
      'Sentença: julgo improcedente o pedido.',
      '2026-10-20',
      null,
      null,
      true,
    ])
    expect(r.prazo.regra).toContain('lado seguro')
  })

  it('perfis · a Sênior decide; a advogada responsável só lê; fora delas, ninguém vê (o Sócio também não: GGVP-96)', async () => {
    expect((await chamar('gabi', 'GET')).json().podeDecidir).toBe(false)
    for (const apelido of ['lauro', 'julia', 'ana', 'igor']) expect((await chamar(apelido, 'GET')).statusCode, apelido).toBe(403)
    for (const apelido of ['gabi', 'lauro']) expect((await chamar(apelido, 'POST', { decisao: 'recorrer', justificativa: JUSTIFICATIVA })).statusCode, apelido).toBe(403)
    expect(await abertas()).toEqual([`senior · ${TITULO_DECIDIR}`])
  })

  it('CA3 · sem justificativa ou sem escolha, não registra', async () => {
    expect((await chamar('helena', 'POST', { decisao: 'recorrer', justificativa: '   ' })).json().erro).toBe('Escreva a justificativa')
    expect((await chamar('helena', 'POST', { justificativa: JUSTIFICATIVA })).json().erro).toBe('Escolha se vale recorrer')
    expect(await banco.select().from(decisao)).toEqual([])
    expect(await abertas()).toEqual([`senior · ${TITULO_DECIDIR}`])
  })

  it('CA1, CA3, CA5 · "Recorrer": fica quem decidiu e quando, nasce a tarefa do recurso e não nasce o estudo; repetir é recusado', async () => {
    const r = await chamar('helena', 'POST', { decisao: 'recorrer', justificativa: JUSTIFICATIVA })
    expect(r.statusCode).toBe(201)
    const [d] = await banco.select().from(decisao)
    expect([d.passo, d.tipo, d.resultado, d.justificativa, d.decididoPor, d.perfil]).toEqual(['D3b.04', 'recurso', 'recorrer', JUSTIFICATIVA, ids.helena, 'senior'])
    // Q26 (Lucas, 09/10): o recurso é das Sêniores, com o mesmo prazo.
    expect(await abertas()).toEqual([`senior · ${TITULO_RECORRER}`])
    const [t] = await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))
    expect([t.responsavelId, t.prazo]).toEqual([null, '2026-10-20'])
    const g = (await chamar('gabi', 'GET')).json()
    expect([g.decisao.decisao, g.decisao.justificativa, g.decisao.por, g.podeDecidir]).toEqual(['recorrer', JUSTIFICATIVA, 'helena', false])
    expect((await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'recurso_decidido'))).length).toBe(1)
    const repetida = await chamar('helena', 'POST', { decisao: 'nao_recorrer', justificativa: JUSTIFICATIVA })
    expect([repetida.statusCode, repetida.json().erro]).toEqual([409, MSG_SEM_DECISAO])
    await app.prepararSugestoes()
    expect(await estudosFeitos()).toBe(0)
  })

  it('CA2 · enquanto a decisão espera, o estudo não nasce; "Não recorrer" abre o resumo ao cliente e o estudo nasce na rodada da IA', async () => {
    await app.prepararSugestoes()
    expect(await estudosFeitos()).toBe(0)
    expect((await chamar('helena', 'POST', { decisao: 'nao_recorrer', justificativa: 'O laudo é firme e não há prova nova.' })).statusCode).toBe(201)
    expect(await abertas()).toEqual([`advogada · ${TITULO_RESUMO}`])
    await app.prepararSugestoes()
    expect(await estudosFeitos()).toBe(1)
  })
})
