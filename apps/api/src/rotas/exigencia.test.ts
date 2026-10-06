import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armazenamentoLocal } from '../armazenamento.ts'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, configuracao, etapa, eventoAuditoria, exigencia, exigenciaItem, pericia, pessoa, tarefa, usuario } from '../banco/esquema.ts'
import { avancarExigencia } from '../fluxo/exigencia.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_G21, MSG_JA_DECIDIDA, MSG_SEM_ENTREGA } from './exigencia.ts'

const SENHA = 'senha-do-portal-1'
const AGORA = new Date('2026-10-05T15:00:00Z') // segunda-feira
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
let casoId: string
let agora = AGORA

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const PDF = { nome: 'doc.pdf', mime: 'application/pdf', conteudo: '%PDF-1.4' }
function formulario(campos: Record<string, string>, arquivo: typeof PDF | null) {
  const f = '----ggv'
  const partes = Object.entries(campos).map(([k, v]) => `--${f}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`)
  if (arquivo) partes.push(`--${f}\r\nContent-Disposition: form-data; name="arquivo"; filename="${arquivo.nome}"\r\nContent-Type: ${arquivo.mime}\r\n\r\n${arquivo.conteudo}\r\n`)
  return { payload: partes.join('') + `--${f}--\r\n`, headers: { 'content-type': `multipart/form-data; boundary=${f}` } }
}
const url = (resto = '') => `/api/casos/${casoId}/exigencia${resto}`
const ver = async (apelido = 'gabi', q = '') => app.inject({ method: 'GET', url: url(q), cookies: await cookieDe(apelido) })
const decidir = async (corpo: object, apelido = 'gabi') => app.inject({ method: 'POST', url: url(), cookies: await cookieDe(apelido), payload: corpo })
const cobrar = async (resultado: string) =>
  app.inject({ method: 'POST', url: url('/cobrancas'), cookies: await cookieDe('dora'), payload: { canal: 'whatsapp', resultado } })
const cumprir = async (item: string, campos: Record<string, string> = { acao: 'cumprido' }, arquivo: typeof PDF | null = PDF) =>
  app.inject({ method: 'POST', url: url(`/itens/${item}`), cookies: await cookieDe('dora'), ...formulario(campos, arquivo) })
const entregar = async () => app.inject({ method: 'POST', url: url('/entrega'), cookies: await cookieDe('dora') })
const responder = async (arquivo: typeof PDF | null = PDF, apelido = 'gabi') =>
  app.inject({ method: 'POST', url: url('/resposta'), cookies: await cookieDe(apelido), ...formulario({ dataResposta: '05/10/2026' }, arquivo) })
const abertas = async () =>
  (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))).map((t) => `${t.perfilDono} · ${t.titulo}`).sort()
const DOCS = { pede: 'documentos', itens: ['CadÚnico atualizado', 'Comprovante de renda'], diasInss: '30', prazoEntrega: '20/10/2026' }

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  agora = AGORA
  app = criarServidor({ banco, agora: () => agora, armazenamento: armazenamentoLocal(mkdtempSync(join(tmpdir(), 'arq-'))) })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['dora', 'documentacao'], ['helena', 'senior'], ['igor', 'juridico_adm'], ['ana', 'atendimento']] as const)
    await banco.insert(usuario).values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
  await banco.insert(configuracao).values([
    { chave: 'cobranca.limite', valor: 2 },
    { chave: 'cobranca.intervalo_dias', valor: 2 },
  ])
  const [p] = await banco.insert(pessoa).values({ nome: 'Teresa Dias', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'administrativa' }).returning()
  casoId = c.id
  await banco.insert(etapa).values({ casoId, diagrama: 'D2', passo: 'D2.04', situacao: 'aguardando_externo', aguardando: 'INSS decidir', iniciadaEm: AGORA })
  await banco.insert(tarefa).values([
    { casoId, passo: 'D2.04', titulo: 'Trazer a resposta do INSS', perfilDono: 'advogada' },
    { casoId, passo: 'D2.05', titulo: 'Tratar exigência do INSS', perfilDono: 'advogada' },
  ])
  // 02/10/2026 é sexta: 30 dias corridos caem no domingo 01/11, e o prazo vai para segunda 02/11.
  await banco.insert(exigencia).values({ casoId, origem: 'inss', descricao: 'Apresentar CadÚnico e renda.', recebidaEm: '2026-10-02' })
})
afterEach(() => fechar())

describe('GGVP-39 · a advogada decide a exigência', () => {
  it('CA7 · mostra o texto, a data e o prazo contado em código, com a regra; antes de decidir, pela prévia dos dias', async () => {
    const r = (await ver('gabi', '?dias=30')).json()
    expect([r.texto, r.data, r.prazo, r.podeDecidir, r.feriadosCadastrados]).toEqual(['Apresentar CadÚnico e renda.', '2026-10-02', '2026-11-02', true, false])
    expect(r.regraPrazo).toContain('Lei 9.784')
    expect((await ver('ana')).json().podeDecidir).toBe(false)
  })

  it('CA1, CA9 · documentos: card da Documentação com os itens, o prazo de entrega, o lembrete e o limite; espera o cliente', async () => {
    expect((await decidir(DOCS)).json()).toEqual({ ok: true, prazo: '2026-11-02' })
    expect(await abertas()).toEqual(['advogada · Trazer a resposta do INSS', 'documentacao · Cumprir exigência do INSS'])
    const [card] = await banco.select().from(tarefa).where(eq(tarefa.passo, 'D2.05d'))
    expect([card.prazo, card.limiteTentativas]).toEqual(['2026-10-07', 2])
    const r = (await ver('dora')).json()
    expect(r.itens.map((i: { descricao: string; situacao: string }) => [i.descricao, i.situacao])).toEqual([
      ['CadÚnico atualizado', 'pendente'],
      ['Comprovante de renda', 'pendente'],
    ])
    expect([r.card.prazoEntrega, r.podeCumprir]).toEqual(['2026-10-20', true])
    const [espera] = await banco.select().from(etapa).where(eq(etapa.passo, 'D2.E3'))
    expect(espera.aguardando).toBe('cliente entregar o documento')
  })

  it('CA1 · o prazo de entrega não passa do prazo do INSS; decidir de novo é recusado', async () => {
    expect((await decidir({ ...DOCS, prazoEntrega: '03/11/2026' })).json().erro).toBe('O prazo de entrega não pode passar do prazo do INSS (02/11/2026).')
    await decidir(DOCS)
    expect((await decidir(DOCS)).json().erro).toBe(MSG_JA_DECIDIDA)
  })

  it('CA2 · perícia: abre sozinho a tarefa do Jurídico administrativo; com o resultado, volta à vigília', async () => {
    await decidir({ pede: 'pericia', tiposPericia: ['social'], diasInss: 30 })
    expect(await abertas()).toEqual(['advogada · Trazer a resposta do INSS', 'juridico_adm · Marcar avaliação social (exigência do INSS)'])
    expect(await avancarExigencia(banco, casoId, AGORA)).toBe(false)
    await banco.update(pericia).set({ resultado: 'favoravel' }).where(eq(pericia.casoId, casoId))
    expect(await avancarExigencia(banco, casoId, AGORA)).toBe(true)
    const [x] = await banco.select().from(exigencia)
    const [espera] = await banco.select().from(etapa).where(eq(etapa.passo, 'D2.E4'))
    expect([x.situacao, espera.aguardando]).toEqual(['cumprida', 'INSS analisar a resposta'])
  })

  it('CA10 e G5 · só a advogada decide; a Documentação recebe 403', async () => {
    expect((await decidir(DOCS, 'dora')).statusCode).toBe(403)
  })
})

describe('GGVP-39 · a Documentação cumpre', () => {
  const itens = async () => (await banco.select().from(exigenciaItem)).sort((a, b) => a.descricao.localeCompare(b.descricao))

  it('CA12 e CA5 · cada cobrança conta; no limite, sem entrega, sobe para a Sênior uma vez só', async () => {
    await decidir(DOCS)
    expect((await cobrar('sem_resposta')).json()).toEqual({ ok: true, tentativas: 1, escalada: false })
    expect((await cobrar('sem_resposta')).json()).toEqual({ ok: true, tentativas: 2, escalada: true })
    expect((await cobrar('sem_resposta')).json().escalada).toBe(false)
    expect(await abertas()).toContain('senior · Cobrança sem retorno: exigência do INSS')
    const r = (await ver('dora')).json()
    expect([r.card.tentativas, r.card.escalada, r.card.cobrancas[0].canal, r.card.cobrancas[0].quem]).toEqual([3, true, 'whatsapp', 'dora'])
  })

  it('CA11 · item cumprido com prova; não cumprido com motivo', async () => {
    await decidir(DOCS)
    const [a, b] = await itens()
    expect((await cumprir(a.id, { acao: 'cumprido' }, null)).statusCode).toBe(400)
    expect((await cumprir(a.id)).statusCode).toBe(201)
    expect((await cumprir(b.id, { acao: 'nao_cumprido', motivo: 'Cliente não tem' }, null)).statusCode).toBe(201)
    const r = (await ver('dora')).json()
    expect(r.itens.map((i: { situacao: string; prova: string | null; motivo: string | null }) => [i.situacao, i.prova, i.motivo])).toEqual([
      ['cumprido', 'doc.pdf', null],
      ['nao_cumprido', null, 'Cliente não tem'],
    ])
  })

  it('CA13 · a Documentação só entrega ao Jurídico com prova em todos os itens; antes disso, a advogada não responde', async () => {
    await decidir(DOCS)
    const [a, b] = await itens()
    await cumprir(a.id)
    expect((await entregar()).json().erro).toBe(MSG_G21)
    const [bloqueio] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'portao_bloqueado'))
    expect(bloqueio.detalhe).toMatchObject({ portao: 'G21', passo: 'D2.05', faltam: 1 })
    expect((await responder()).json().erro).toBe(MSG_SEM_ENTREGA)
    await cumprir(b.id)
    expect((await entregar()).statusCode).toBe(201)
    expect(await abertas()).toEqual(['advogada · Responder exigência no portal do INSS', 'advogada · Trazer a resposta do INSS'])
    expect((await ver('gabi')).json().podeResponder).toBe(true)
  })

  it('CA4 · quem responde no portal é a advogada; com comprovante, o caso volta para a vigília', async () => {
    await decidir(DOCS)
    for (const i of await itens()) await cumprir(i.id)
    await entregar()
    expect((await responder(PDF, 'dora')).statusCode).toBe(403)
    expect((await responder(null)).statusCode).toBe(400)
    expect((await responder()).json()).toEqual({ ok: true, aberto: 'vigilia' })
    expect(await abertas()).toEqual(['advogada · Trazer a resposta do INSS'])
    const [x] = await banco.select().from(exigencia)
    const esperas = await banco.select().from(etapa).where(and(eq(etapa.casoId, casoId), isNull(etapa.concluidaEm)))
    expect([x.situacao, esperas.map((e) => e.passo).sort()]).toEqual(['cumprida', ['D2.04', 'D2.E4']])
  })

  it('CA6 e CA3 · perícia e documentos: primeiro o card; a perícia abre só quando os documentos chegam', async () => {
    await decidir({ ...DOCS, pede: 'pericia_e_documentos', itens: ['Laudo atualizado'], tiposPericia: ['medica'] })
    expect(await abertas()).toEqual(['advogada · Trazer a resposta do INSS', 'documentacao · Cumprir exigência do INSS'])
    const [a] = await itens()
    await cumprir(a.id)
    await entregar()
    expect((await responder()).json().aberto).toBe('pericia')
    expect(await abertas()).toEqual(['advogada · Trazer a resposta do INSS', 'juridico_adm · Marcar perícia médica (exigência do INSS)'])
    await banco.update(pericia).set({ resultado: 'desfavoravel' }).where(eq(pericia.casoId, casoId))
    expect(await avancarExigencia(banco, casoId, AGORA)).toBe(true)
  })
})

describe('GGVP-39 CA14 · perto do vencimento, a Sênior', () => {
  const fila = async () =>
    (await app.inject({ method: 'GET', url: '/api/tarefas', cookies: await cookieDe('helena') })).json().map((t: { titulo: string; urgente: boolean }) => t.titulo)
  const prazo = (iso: string) => banco.update(exigencia).set({ prazo: iso }).where(eq(exigencia.casoId, casoId))

  it('a 6 dias úteis, nada; a 5, alerta no fim da fila; a 2, no topo', async () => {
    await decidir(DOCS)
    await banco.insert(tarefa).values({ casoId, passo: 'D2.01', titulo: 'Outra tarefa da Sênior', perfilDono: 'senior' })
    await prazo('2026-10-13')
    expect(await fila()).toEqual(['Outra tarefa da Sênior'])
    await prazo('2026-10-12')
    expect(await fila()).toEqual(['Outra tarefa da Sênior', 'Exigência do INSS perto do prazo: 5 dias úteis'])
    await prazo('2026-10-07')
    expect(await fila()).toEqual(['Exigência do INSS perto do prazo: 2 dias úteis', 'Outra tarefa da Sênior'])
  })

  it('com todos os itens cumpridos, não alerta', async () => {
    await decidir(DOCS)
    await banco.update(exigenciaItem).set({ situacao: 'cumprido' })
    await prazo('2026-10-07')
    expect(await fila()).toEqual([])
  })

  it('vencida: a Sênior pede dilação (novo prazo) ou registra a perda (tarefas canceladas); outro perfil não', async () => {
    await decidir(DOCS)
    await prazo('2026-10-02')
    expect(await fila()).toEqual(['Exigência do INSS vencida: pedir dilação ou registrar a perda'])
    expect((await ver('helena')).json().podeDecidirVencida).toBe(true)
    const vencida = async (apelido: string, corpo: object) => app.inject({ method: 'POST', url: url('/vencida'), cookies: await cookieDe(apelido), payload: corpo })
    expect((await vencida('gabi', { decisao: 'perda', motivo: 'x' })).statusCode).toBe(403)
    expect((await vencida('helena', { decisao: 'dilacao', novoPrazo: '20/10/2026' })).statusCode).toBe(201)
    let [x] = await banco.select().from(exigencia)
    expect([x.situacao, x.prazo]).toEqual(['dilacao_pedida', '2026-10-20'])
    await prazo('2026-10-02')
    expect((await vencida('helena', { decisao: 'perda', motivo: 'Cliente não trouxe' })).statusCode).toBe(201)
    ;[x] = await banco.select().from(exigencia)
    expect([x.situacao, await abertas()]).toEqual(['vencida', ['advogada · Trazer a resposta do INSS']])
  })
})
