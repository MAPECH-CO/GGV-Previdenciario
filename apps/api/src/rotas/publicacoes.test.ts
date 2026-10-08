import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, identificadorCaso, pessoa, publicacao, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MOTIVO_SEM_CNJ, casarPublicacoes } from '../vigilia/casar.ts'
import { CNJ_EXEMPLO } from '../vigilia/fontes.ts'
import { criarIa } from '../ia/ia.ts'
import { MSG_CNJ_SEM_CASO, MSG_IA_SEM_LEITURA } from './publicacoes.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
let agora = new Date('2026-10-05T15:00:00Z') // segunda-feira

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const chamar = async (apelido: string, metodo: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({ method: metodo, url, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const semCnj = (data = '2026-10-05') => ({ fonte: 'aasp', numeroCnj: null, disponibilizadaEm: data, texto: `Intimação sem número ${data}.`, partes: 'Joana x INSS' })

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  agora = new Date('2026-10-05T15:00:00Z')
  app = criarServidor({ banco, agora: () => agora })
  for (const [apelido, perfil] of [['helena', 'senior'], ['gabi', 'advogada']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  const [p] = await banco.insert(pessoa).values({ nome: 'Sebastião Cruz' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'judicial' }).returning()
  casoId = c.id
  await banco.insert(identificadorCaso).values({ casoId, tipo: 'cnj', valor: CNJ_EXEMPLO.exigencia })
})
afterEach(() => fechar())

describe('GGVP-26 · fila de revisão da Sênior', () => {
  it('CA7, CA12 · cada item mostra data, fonte, texto, partes, motivo e o prazo mínimo correndo', async () => {
    await casarPublicacoes(banco, [semCnj()], agora)
    const [item] = (await chamar('helena', 'GET', '/api/publicacoes/fila')).json()
    expect([item.fonte, item.partes, item.motivo, item.idadeEmDias]).toEqual(['aasp', 'Joana x INSS', MOTIVO_SEM_CNJ, 0])
    // Disponibilizada na segunda 05/10: publicação na terça, início na quarta, 5 dias úteis até a terça 13/10.
    expect([item.prazoMinimo.inicio, item.prazoMinimo.fim, item.diasUteisAtePrazo]).toEqual(['2026-10-07', '2026-10-13', 6])
    expect((await chamar('gabi', 'GET', '/api/publicacoes/fila')).statusCode).toBe(403)
  })

  it('CA3, CA10, CA12 · na Central da Sênior, "Casar publicação" com o contexto; idade e prazo perto sobem', async () => {
    await casarPublicacoes(banco, [semCnj()], agora)
    const fila = async () => (await chamar('helena', 'GET', '/api/tarefas')).json()
    const [l] = await fila()
    expect([l.titulo, l.contexto, l.cliente, l.casoId, l.tela, l.urgente]).toEqual(['Casar publicação', 'Fila de revisão', null, null, '/vigilia', false])
    agora = new Date('2026-10-12T15:00:00Z')
    const [depois] = await fila()
    expect([depois.urgente, depois.detalhe]).toEqual([true, `${MOTIVO_SEM_CNJ} · aasp · há 7 dias na fila`])
  })

  it('CA8, CA9, CA11 · vincular exige CNJ de um processo existente; vinculada, vai para a leitura da advogada', async () => {
    await casarPublicacoes(banco, [semCnj()], agora)
    const [p] = await banco.select().from(publicacao)
    expect((await chamar('helena', 'POST', `/api/publicacoes/${p.id}/vinculo`, { decisao: 'vincular', numeroCnj: '0009999-56.2026.4.03.6301' })).json().erro).toBe(MSG_CNJ_SEM_CASO)
    expect((await chamar('helena', 'POST', `/api/publicacoes/${p.id}/vinculo`, { decisao: 'vincular', numeroCnj: '0001234-96.2026.4.03.6301' })).statusCode).toBe(201)
    const [v] = await banco.select().from(publicacao)
    expect([v.casoId, v.fila, v.vinculadaPor !== null]).toEqual([casoId, null, true])
    expect((await banco.select().from(tarefa)).map((t) => t.titulo)).toEqual(['Ler publicação'])
    expect((await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'publicacao_vinculada'))).length).toBe(1)
    expect((await chamar('helena', 'GET', '/api/publicacoes/fila')).json()).toEqual([])
  })

  it('CA8 · "não é do escritório" tira da fila e fica registrado', async () => {
    await casarPublicacoes(banco, [semCnj()], agora)
    const [p] = await banco.select().from(publicacao)
    expect((await chamar('helena', 'POST', `/api/publicacoes/${p.id}/vinculo`, { decisao: 'fora_do_escritorio' })).statusCode).toBe(201)
    const [v] = await banco.select().from(publicacao)
    expect([v.fila, v.foraDoEscritorio]).toEqual([null, true])
    expect((await chamar('helena', 'GET', '/api/tarefas')).json()).toEqual([])
  })
})

describe('GGVP-74 e GGVP-34 · ler e classificar', () => {
  const casar = async () => {
    await casarPublicacoes(
      banco,
      [
        { fonte: 'aasp', numeroCnj: CNJ_EXEMPLO.exigencia, disponibilizadaEm: '2026-10-05', texto: 'Intime-se para juntar laudo em 15 dias.', partes: null },
        { fonte: 'aasp', numeroCnj: CNJ_EXEMPLO.exigencia, disponibilizadaEm: '2026-10-05', texto: 'Autos conclusos.', partes: null },
      ],
      agora,
    )
    const pubs = await banco.select().from(publicacao)
    return { exigencia: pubs.find((p) => p.texto.startsWith('Intime'))!, andamento: pubs.find((p) => p.texto.startsWith('Autos'))! }
  }
  const classificar = async (id: string, corpo: object, apelido = 'gabi') => chamar(apelido, 'POST', `/api/publicacoes/${id}/classificacao`, corpo)
  const filaDa = async (apelido: string) => (await chamar(apelido, 'GET', '/api/tarefas')).json().map((t: { titulo: string; prazo: string | null }) => [t.titulo, t.prazo])

  it('CA6 · as publicações casadas viram uma linha "Ler publicação" na fila da advogada, com a tela do processo', async () => {
    await casar()
    const [l] = (await chamar('gabi', 'GET', '/api/tarefas')).json()
    expect([l.titulo, l.cliente.nome, l.tela]).toEqual(['Ler publicação', 'Sebastião Cruz', `/casos/${casoId}/publicacoes`])
  })

  it('GGVP-37 CA6 · nada vira só andamento sem uma pessoa: casada, a publicação chega sem classe; só a leitura da advogada a registra', async () => {
    const { andamento } = await casar()
    expect((await banco.select().from(publicacao)).map((p) => [p.classe, p.revisadaPor])).toEqual([
      [null, null],
      [null, null],
    ])
    expect(await filaDa('gabi')).toEqual([['Ler publicação', null]])
    await classificar(andamento.id, { classe: 'andamento' })
    const [gabi] = await banco.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, 'gabi@exemplo.ggv'))
    const [lida] = await banco.select().from(publicacao).where(eq(publicacao.id, andamento.id))
    expect([lida.classe, lida.revisadaPor, lida.revisadaEm instanceof Date]).toEqual(['andamento', gabi.id, true])
  })

  /** A API com uma IA falsa que responde `texto`, como a OpenAI. */
  const comIa = (texto: string) => {
    const fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: texto } }] }))
    app = criarServidor({ banco, agora: () => agora, ia: criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste' }, fetch }) })
  }

  it('GGVP-34 e GGVP-74 (IA) · a IA sugere o tipo, os dias e o resumo; a publicação continua sem classe até a advogada classificar', async () => {
    const { exigencia } = await casar()
    comIa(JSON.stringify({ classe: 'exigencia', dias: 15, resumo: 'O juiz pede o laudo em 15 dias.' }))
    const r = (await chamar('gabi', 'POST', `/api/publicacoes/${exigencia.id}/sugestao`)).json()
    expect([r.sugestao.classe, r.sugestao.dias, r.sugestao.resumo, r.sugestao.alerta, r.motivo]).toEqual(['exigencia', 15, 'O juiz pede o laudo em 15 dias.', null, null])
    const [p] = await banco.select().from(publicacao).where(eq(publicacao.id, exigencia.id))
    expect([p.classe, p.classeSugeridaIa, p.revisadaPor]).toEqual([null, 'exigencia', null])
    expect(await filaDa('gabi')).toEqual([['Ler publicação', null]])
    expect((await classificar(exigencia.id, { classe: 'exigencia', dias: '15' })).statusCode).toBe(201)
  })

  it('Sugestão pronta (07/10) · a rodada lê a publicação casada antes de alguém abrir; ao abrir, nenhuma chamada nova', async () => {
    const { exigencia } = await casar()
    let chamadas = 0
    const fetch = async () => {
      chamadas++
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ classe: 'exigencia', dias: 15, resumo: 'O juiz pede o laudo.' }) } }] }))
    }
    app = criarServidor({ banco, agora: () => agora, ia: criarIa({ banco, ambiente: { OPENAI_API_KEY: 'chave-de-teste' }, fetch }) })
    await app.prepararSugestoes()
    const [p] = await banco.select().from(publicacao).where(eq(publicacao.id, exigencia.id))
    const semClasse = (await banco.select().from(publicacao)).filter((x) => x.casoId && !x.classe).length
    expect([p.classe, p.classeSugeridaIa, chamadas]).toEqual([null, 'exigencia', semClasse])
    const r = (await chamar('gabi', 'POST', `/api/publicacoes/${exigencia.id}/sugestao`)).json()
    expect([r.sugestao.classe, r.sugestao.dias, chamadas]).toEqual(['exigencia', 15, semClasse])
  })

  it('GGVP-34 (IA) · resposta fora do formato ou sem chave: sem sugestão, com o motivo', async () => {
    const { exigencia } = await casar()
    comIa('Acho que é uma exigência.')
    expect((await chamar('gabi', 'POST', `/api/publicacoes/${exigencia.id}/sugestao`)).json()).toEqual({ sugestao: null, motivo: MSG_IA_SEM_LEITURA })
    comIa(JSON.stringify({ classe: 'outra', dias: 15, resumo: 'x' }))
    expect((await chamar('gabi', 'POST', `/api/publicacoes/${exigencia.id}/sugestao`)).json().sugestao).toBeNull()
    app = criarServidor({ banco, agora: () => agora, ia: criarIa({ banco, ambiente: {} }) })
    expect((await chamar('gabi', 'POST', `/api/publicacoes/${exigencia.id}/sugestao`)).json().motivo).toBe('A IA não respondeu agora: classifique pela leitura.')
  })

  it('CA2, CA4 e GGVP-34 CA3 · exigência: a advogada classifica, vê o prazo com a regra e a tarefa nasce com o prazo', async () => {
    const { exigencia } = await casar()
    expect((await classificar(exigencia.id, { classe: 'exigencia' })).json().erro).toBe(
      'Informe o prazo da publicação, em dias (1 a 120), ou marque "sem prazo na decisão"',
    )
    const r = (await classificar(exigencia.id, { classe: 'exigencia', dias: '15' })).json()
    expect([r.prazo.inicio, r.prazo.fim, r.prazo.versao]).toEqual(['2026-10-07', '2026-10-27', 1])
    const lida = (await chamar('gabi', 'GET', `/api/publicacoes/${exigencia.id}`)).json()
    expect([lida.classe, lida.classificadaPor, lida.prazo.inicio, lida.prazo.fim, lida.prazo.regra, lida.feriadosCadastrados]).toEqual([
      'exigencia', 'gabi', '2026-10-07', '2026-10-27', r.prazo.regra, false,
    ])
    expect(await filaDa('gabi')).toEqual([
      ['Analisar exigência do juiz', '2026-10-27'],
      ['Ler publicação', null],
    ])
  })

  it('CA1 · lidas todas as publicações do caso, "Ler publicação" sai da fila; o andamento não cria tarefa', async () => {
    const { exigencia, andamento } = await casar()
    await classificar(andamento.id, { classe: 'andamento' })
    expect(await filaDa('gabi')).toEqual([['Ler publicação', null]])
    await classificar(exigencia.id, { classe: 'merito', semPrazoNaDecisao: true })
    expect(await filaDa('gabi')).toEqual([['Confirmar desfecho', '2026-10-13']])
  })

  it('CA5, CA7 e GGVP-34 CA10 · o processo lista as publicações com classe e prazo; reclassificar fica registrado', async () => {
    const { exigencia, andamento } = await casar()
    await classificar(andamento.id, { classe: 'andamento' })
    await classificar(exigencia.id, { classe: 'exigencia', dias: 15 })
    await classificar(andamento.id, { classe: 'exigencia', dias: 5 }, 'helena')
    const lista = (await chamar('gabi', 'GET', `/api/casos/${casoId}/publicacoes`)).json().publicacoes
    expect(lista.map((p: { classe: string; prazo: { fim: string } | null }) => [p.classe, p.prazo?.fim ?? null])).toEqual([
      ['exigencia', '2026-10-27'],
      ['exigencia', '2026-10-13'],
    ])
    const eventos = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'publicacao_reclassificada'))
    expect(eventos).toHaveLength(1)
    await classificar(exigencia.id, { classe: 'andamento' })
    const depois = (await chamar('gabi', 'GET', `/api/publicacoes/${exigencia.id}`)).json()
    expect([depois.classe, depois.prazo]).toEqual(['andamento', null])
  })

  it('só quem pode classifica; o Financeiro nem abre', async () => {
    await banco.insert(usuario).values({ email: 'ana@exemplo.ggv', nome: 'ana', senhaHash: await bcrypt.hash(SENHA, 4), perfis: ['financeiro'], trocarSenha: false })
    const { exigencia } = await casar()
    expect((await classificar(exigencia.id, { classe: 'andamento' }, 'ana')).statusCode).toBe(403)
    expect((await chamar('ana', 'GET', `/api/publicacoes/${exigencia.id}`)).statusCode).toBe(403)
  })
})
