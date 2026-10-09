import bcrypt from 'bcryptjs'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, decisao, etapa, pessoa, publicacao, tarefa, usuario } from '../banco/esquema.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'
import { MSG_SEM_DESFECHO_ESPERANDO, PASSO_PAGAMENTO, TITULO_PAGAMENTO } from './desfecho.ts'
import { TITULO_DECIDIR } from './recurso.ts'

const SENHA = 'senha-do-portal-1'
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
  app.inject({ method: metodo, url: `/api/casos/${casoId}/desfecho`, cookies: await cookieDe(apelido), ...(payload ? { payload } : {}) })
const abertas = async () =>
  (await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), isNull(tarefa.concluidaEm)))).map((t) => ({ titulo: t.titulo, passo: t.passo, responsavel: t.responsavelId, prazo: t.prazo }))

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco })
  for (const [apelido, perfil] of [['gabi', 'advogada'], ['helena', 'senior'], ['ana', 'atendimento']] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const [p] = await banco.insert(pessoa).values({ nome: 'Rosa Lima', situacao: 'cliente' }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', fase: 'judicial', advogadaResponsavelId: ids.gabi }).returning()
  casoId = c.id
  // A vigília encaminhou a decisão de mérito (GGVP-37 CA5): a etapa e a tarefa com o prazo do recurso.
  await banco.insert(publicacao).values({
    fonte: 'djen', numeroCnj: '50001014520234036301', casoId, disponibilizadaEm: '2026-10-05', classe: 'merito', classeSugeridaIa: 'merito', confiancaIa: '0.910',
    texto: 'JULGO PROCEDENTE EM PARTE o pedido para condenar o INSS a conceder o benefício assistencial.', hash: 'h-merito',
  })
  await banco.insert(etapa).values({ casoId, diagrama: 'D4', passo: 'D4.02', situacao: 'aberta' })
  await banco.insert(tarefa).values({ casoId, passo: 'D4.02', titulo: 'Confirmar desfecho', perfilDono: 'advogada', prazo: '2026-10-21' })
})
afterEach(() => fechar())

describe('GGVP-90 · confirmar o desfecho de mérito', () => {
  it('CA3 · a tela traz o trecho da decisão, a leitura da IA com a confiança e o prazo do recurso pelo lado seguro (o mesmo da Sênior)', async () => {
    const r = await chamar('gabi', 'GET')
    expect(r.statusCode).toBe(200)
    const d = r.json()
    expect(d.decisao).toMatchObject({ disponibilizadaEm: '2026-10-05', fonte: 'djen', classeSugeridaIa: 'merito', confiancaIa: 0.91 })
    expect(d.decisao.texto).toContain('JULGO PROCEDENTE EM PARTE')
    expect([d.prazoRecurso, d.confirmado, d.podeConfirmar]).toEqual(['2026-10-20', null, true])
  })

  it('CA3 · outro perfil vê a situação e não confirma; sem causa, a extinção é recusada', async () => {
    expect((await chamar('ana', 'GET')).json().podeConfirmar).toBe(false)
    expect((await chamar('ana', 'POST', { desfecho: 'procedente_total' })).statusCode).toBe(403)
    const semCausa = await chamar('gabi', 'POST', { desfecho: 'extinto_sem_merito' })
    expect([semCausa.statusCode, semCausa.json().erro]).toEqual([400, 'Escreva a causa da extinção sem mérito'])
  })

  it('CA4 · procedente em parte, por RPV: o caso guarda o desfecho, a decisão guarda quem e quando, e nasce "Acompanhar pagamento"', async () => {
    expect((await chamar('gabi', 'POST', { desfecho: 'procedente_parcial', forma: 'rpv' })).statusCode).toBe(201)
    const [c] = await banco.select().from(caso).where(eq(caso.id, casoId))
    expect(c.desfecho).toBe('procedente_parcial')
    const [d] = await banco.select().from(decisao).where(eq(decisao.casoId, casoId))
    expect([d.tipo, d.resultado, d.justificativa, d.decididoPor, d.perfil]).toEqual(['desfecho_merito', 'procedente_parcial', 'rpv', ids.gabi, 'advogada'])
    expect(await abertas()).toEqual([{ titulo: TITULO_PAGAMENTO, passo: PASSO_PAGAMENTO, responsavel: ids.gabi, prazo: null }])
    const tela = (await chamar('gabi', 'GET')).json()
    expect(tela.confirmado).toMatchObject({ desfecho: 'procedente_parcial', forma: 'rpv', causa: null, por: 'gabi' })
    expect(tela.podeConfirmar).toBe(false)
  })

  it('CA4 · improcedente: nasce "Decidir recurso" para a Sênior, com o prazo pelo lado seguro, e a etapa D4.02 fecha', async () => {
    expect((await chamar('helena', 'POST', { desfecho: 'improcedente' })).statusCode).toBe(201)
    // A sentença saiu em 05/10: 10 dias úteis vão a 20/10, antes do prazo da tarefa (21/10).
    expect(await abertas()).toEqual([{ titulo: TITULO_DECIDIR, passo: 'D3b.04', responsavel: null, prazo: '2026-10-20' }])
    const [t] = await banco.select().from(tarefa).where(and(eq(tarefa.casoId, casoId), eq(tarefa.passo, 'D3b.04')))
    expect(t.perfilDono).toBe('senior')
    const [e] = await banco.select().from(etapa).where(and(eq(etapa.casoId, casoId), eq(etapa.passo, 'D4.02')))
    expect(e.situacao).toBe('concluida')
  })

  it('CA4 · extinto sem mérito guarda a causa; confirmar de novo é recusado', async () => {
    expect((await chamar('gabi', 'POST', { desfecho: 'extinto_sem_merito', causa: 'Não cumpriu determinação do juízo' })).statusCode).toBe(201)
    const [c] = await banco.select().from(caso).where(eq(caso.id, casoId))
    expect([c.desfecho, c.causaDesfecho]).toEqual(['extinto_sem_merito', 'Não cumpriu determinação do juízo'])
    expect((await abertas()).map((t) => t.passo)).toEqual(['D3b.04'])
    const deNovo = await chamar('gabi', 'POST', { desfecho: 'procedente_total' })
    expect([deNovo.statusCode, deNovo.json().erro]).toEqual([409, MSG_SEM_DESFECHO_ESPERANDO])
  })

  it('CA4 · duas confirmações ao mesmo tempo: só a primeira vale', async () => {
    const [a, b] = await Promise.all([chamar('gabi', 'POST', { desfecho: 'improcedente' }), chamar('helena', 'POST', { desfecho: 'procedente_total' })])
    expect([a.statusCode, b.statusCode].sort()).toEqual([201, 409])
    expect(await banco.select().from(decisao).where(eq(decisao.casoId, casoId))).toHaveLength(1)
    expect(await abertas()).toHaveLength(1)
  })

  it('CA4 · já há "Decidir recurso" aberta: não nasce outra', async () => {
    await banco.insert(tarefa).values({ casoId, passo: 'D3b.04', titulo: TITULO_DECIDIR, perfilDono: 'senior', prazo: '2026-10-19' })
    expect((await chamar('gabi', 'POST', { desfecho: 'improcedente' })).statusCode).toBe(201)
    expect(await abertas()).toEqual([{ titulo: TITULO_DECIDIR, passo: 'D3b.04', responsavel: null, prazo: '2026-10-19' }])
  })
})
