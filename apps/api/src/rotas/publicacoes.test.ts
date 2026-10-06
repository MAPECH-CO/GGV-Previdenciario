import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, identificadorCaso, pessoa, publicacao, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MOTIVO_SEM_CNJ, casarPublicacoes } from '../vigilia/casar.ts'
import { CNJ_EXEMPLO } from '../vigilia/fontes.ts'
import { MSG_CNJ_SEM_CASO } from './publicacoes.ts'

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
