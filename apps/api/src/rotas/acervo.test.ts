import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, pessoa, processoAcervo, usuario } from '../banco/esquema.ts'
import { ID_CONFERIR_DESFECHOS } from '../fluxo/acervo.ts'
import { criarServidor } from '../servidor.ts'
import { COOKIE } from '../sessao/rotas.ts'

const SENHA = 'senha-do-portal-1'
let banco: Banco
let fechar: () => Promise<void>
let app: ReturnType<typeof criarServidor>
const ids: Record<string, string> = {}
let lidos: string[]

async function cookieDe(apelido: string) {
  const r = await app.inject({ method: 'POST', url: '/api/sessao', payload: { email: `${apelido}@exemplo.ggv`, senha: SENHA } })
  return { [COOKIE]: r.cookies.find((c) => c.name === COOKIE)!.value }
}
const conferencia = async (apelido: string) => app.inject({ method: 'GET', url: '/api/acervo/conferencia', cookies: await cookieDe(apelido) })
const conferir = async (apelido: string, id: string, desfecho: string, tese?: string) =>
  app.inject({ method: 'POST', url: `/api/acervo/processos/${id}/conferencia`, cookies: await cookieDe(apelido), payload: { desfecho, ...(tese !== undefined && { tese }) } })
const itemDaCentral = async (apelido: string) =>
  ((await app.inject({ method: 'GET', url: '/api/tarefas', cookies: await cookieDe(apelido) })).json() as { id: string; titulo: string; detalhe: string; tela: string | null }[]).find(
    (t) => t.titulo === 'Conferir desfechos do lote',
  )

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
  app = criarServidor({ banco })
  for (const [apelido, perfil] of [['helena', 'senior'], ['gabi', 'advogada']] as const) {
    const [u] = await banco
      .insert(usuario)
      .values({ email: `${apelido}@exemplo.ggv`, nome: apelido, senhaHash: await bcrypt.hash(SENHA, 4), perfis: [perfil], trocarSenha: false })
      .returning()
    ids[apelido] = u.id
  }
  const linhas = await banco
    .insert(processoAcervo)
    .values([
      { numeroCnj: '00000011220204036301', desfecho: 'improcedente', fonte: 'lote', criadoEm: new Date('2026-10-02T15:00:00Z') },
      { numeroCnj: '00000021220204036301', desfecho: 'procedente_parcial', fonte: 'lote', criadoEm: new Date('2026-10-02T15:01:00Z') },
      { numeroCnj: '00000031220204036301', desfecho: 'procedente_total', desfechoConferidoPor: ids.helena, fonte: 'importacao' },
      { numeroCnj: '00000041220204036301', fonte: 'lote' },
    ])
    .returning()
  lidos = linhas.slice(0, 2).map((l) => l.id)
})

afterEach(async () => {
  await app.close()
  await fechar()
})

describe('conferir desfechos do lote (GGVP-55)', () => {
  it('CA7 · a Sênior vê os desfechos lidos e ainda sem conferência, e quantos já foram conferidos', async () => {
    const r = (await conferencia('helena')).json()
    expect(r.conferidos).toBe(1)
    expect(r.pendentes.map((p: { numeroCnj: string; desfechoLido: string }) => [p.numeroCnj, p.desfechoLido])).toEqual([
      ['00000011220204036301', 'improcedente'],
      ['00000021220204036301', 'procedente_parcial'],
    ])
  })

  it('CA7 · conferir o mesmo desfecho ou corrigir: sai da lista, entra nas contas, e o histórico guarda o antes e o depois', async () => {
    expect((await conferir('helena', lidos[0], 'improcedente')).statusCode).toBe(200)
    const depois = (await conferir('helena', lidos[1], 'acordo')).json()
    expect([depois.pendentes, depois.conferidos]).toEqual([[], 3])
    const [corrigido] = await banco.select().from(processoAcervo).where(eq(processoAcervo.id, lidos[1]))
    expect([corrigido.desfecho, corrigido.desfechoConferidoPor]).toEqual(['acordo', ids.helena])
    const eventos = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'acervo_desfecho_conferido'))
    expect(eventos.map((e) => [e.alvo, (e.detalhe as { antes: string }).antes, (e.detalhe as { depois: string }).depois])).toEqual([
      [`acervo:${lidos[0]}`, 'improcedente', 'improcedente'],
      [`acervo:${lidos[1]}`, 'procedente_parcial', 'acordo'],
    ])
  })

  it('já conferido volta 409; desfecho fora da lista, 400 com a mensagem; outro perfil, 403', async () => {
    await conferir('helena', lidos[0], 'improcedente')
    const deNovo = await conferir('helena', lidos[0], 'procedente_total')
    expect([deNovo.statusCode, deNovo.json().erro]).toEqual([409, 'Esse desfecho já foi conferido.'])
    const fora = await conferir('helena', lidos[1], 'ganhou')
    expect([fora.statusCode, fora.json().erro]).toEqual([400, 'Escolha o desfecho'])
    expect((await conferir('gabi', lidos[1], 'acordo')).statusCode).toBe(403)
    expect((await conferencia('gabi')).statusCode).toBe(403)
  })

  it('CA7 · na Central da Sênior, "Conferir desfechos do lote" aparece só enquanto houver processo esperando', async () => {
    expect(await itemDaCentral('helena')).toMatchObject({ id: ID_CONFERIR_DESFECHOS, detalhe: '2 processos', tela: '/acervo/conferencia' })
    await conferir('helena', lidos[0], 'improcedente')
    expect(await itemDaCentral('helena')).toMatchObject({ id: ID_CONFERIR_DESFECHOS, detalhe: '1 processo' })
    expect(await itemDaCentral('gabi')).toBeUndefined()
    await conferir('helena', lidos[1], 'improcedente')
    expect(await itemDaCentral('helena')).toBeUndefined()
  })
})

describe('GGVP-41 · a ficha e a tese na conferência', () => {
  const FICHA = { materia: 'BPC/LOAS da pessoa com deficiência', vara: null, tese: 'Renda per capita acima de 1/4 com gastos', resumo: 'O juiz concedeu.', licao: 'O laudo social decidiu.' }
  let doPortal: string
  let semFicha: string

  beforeEach(async () => {
    const [p] = await banco.insert(pessoa).values({ nome: 'Joana' }).returning()
    const [c1] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'encerrado', desfecho: 'procedente_total' }).returning()
    const [c2] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'aposentadoria_pcd', fase: 'encerrado' }).returning()
    ;[{ id: doPortal }] = await banco
      .insert(processoAcervo)
      .values({ casoId: c1.id, beneficio: 'bpc_loas_deficiente', desfecho: 'procedente_total', fonte: 'portal', ...FICHA, criadoEm: new Date('2026-10-03T15:00:00Z') })
      .returning()
    // O ganho no INSS entra como "deferido" (GGVP-98); a IA ainda não leu.
    ;[{ id: semFicha }] = await banco
      .insert(processoAcervo)
      .values({ casoId: c2.id, beneficio: 'aposentadoria_pcd', desfecho: 'deferido', fonte: 'portal', criadoEm: new Date('2026-10-03T15:01:00Z') })
      .returning()
  })

  it('CA7, CA11 · o desfecho do portal vem com a ficha; sem ela, a tela sabe que a IA ainda não leu; o do lote vem sem ficha', async () => {
    const r = (await conferencia('helena')).json() as { pendentes: { id: string; ficha: unknown }[] }
    const ficha = new Map(r.pendentes.map((p) => [p.id, p.ficha]))
    expect([ficha.get(doPortal), ficha.get(semFicha), ficha.get(lidos[0])]).toEqual([FICHA, null, null])
  })

  it('CA7 · a Sênior confere com a tese corrigida, e o histórico guarda a de antes e a de depois; "Deferido no INSS" também se confere', async () => {
    expect((await conferir('helena', doPortal, 'procedente_total', ' Renda per capita com gastos de saúde ')).statusCode).toBe(200)
    const [a] = await banco.select().from(processoAcervo).where(eq(processoAcervo.id, doPortal))
    expect([a.tese, a.desfechoConferidoPor, a.licao]).toEqual(['Renda per capita com gastos de saúde', ids.helena, FICHA.licao])
    const [e] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.alvo, `acervo:${doPortal}`))
    const detalhe = e.detalhe as { teseAntes: string; tese: string }
    expect([detalhe.teseAntes, detalhe.tese]).toEqual([FICHA.tese, 'Renda per capita com gastos de saúde'])
    expect((await conferir('helena', semFicha, 'deferido')).statusCode).toBe(200)
    expect((await conferir('gabi', lidos[0], 'improcedente', 'Tese')).statusCode).toBe(403)
  })

  it('CA5 · tese apagada na conferência: o desfecho conta, mas o caso fica fora do recorte por tese', async () => {
    await conferir('helena', doPortal, 'procedente_total', '')
    const [a] = await banco.select().from(processoAcervo).where(eq(processoAcervo.id, doPortal))
    expect([a.tese, a.desfechoConferidoPor]).toEqual([null, ids.helena])
  })
})

describe('pergunta de um clique para juiz, vara e tese (GGVP-153)', () => {
  const completar = async (apelido: string, id: string, corpo: object) =>
    app.inject({ method: 'POST', url: `/api/acervo/processos/${id}/completar`, cookies: await cookieDe(apelido), payload: corpo })

  async function casoNoAcervo(extra: Partial<typeof caso.$inferInsert> = {}, tese: string | null = null) {
    const [p] = await banco.insert(pessoa).values({ nome: 'Pessoa (exemplo)' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_idoso', ...extra }).returning()
    const [a] = await banco
      .insert(processoAcervo)
      .values({ casoId: c.id, beneficio: 'bpc_loas_idoso', desfecho: 'improcedente', desfechoConferidoPor: ids.helena, fonte: 'portal', tese })
      .returning()
    return { casoId: c.id, acervoId: a.id }
  }

  it('CA1 · o conferido sem vara, juiz ou tese aparece com o que falta e as opções que o portal já conhece', async () => {
    await casoNoAcervo({ vara: '2ª Vara do JEF (exemplo)', juiz: 'Dra. Exemplo' }, 'Renda per capita (exemplo)')
    const { acervoId } = await casoNoAcervo()
    const r = (await conferencia('helena')).json()
    expect(r.incompletos).toEqual([{ id: acervoId, numeroCnj: null, beneficio: 'bpc_loas_idoso', desfecho: 'improcedente', falta: ['vara', 'juiz', 'tese'] }])
    expect(r.conhecidos).toEqual({ vara: ['2ª Vara do JEF (exemplo)'], juiz: ['Dra. Exemplo'], tese: ['Renda per capita (exemplo)'] })
  })

  it('CA2 · a resposta vai ao caso e ao acervo, só no que faltava, com quem e o antes e o depois no histórico', async () => {
    const { casoId, acervoId } = await casoNoAcervo({ juiz: 'Dr. Já Tinha (exemplo)' })
    const r = await completar('helena', acervoId, { vara: '2ª Vara do JEF (exemplo)', juiz: 'Outro (exemplo)', tese: 'Miserabilidade (exemplo)' })
    expect(r.statusCode).toBe(200)
    expect(r.json().incompletos).toEqual([])
    const [c] = await banco.select({ vara: caso.vara, juiz: caso.juiz }).from(caso).where(eq(caso.id, casoId))
    const [a] = await banco.select({ vara: processoAcervo.vara, tese: processoAcervo.tese }).from(processoAcervo).where(eq(processoAcervo.id, acervoId))
    // O juiz que já existia não muda.
    expect([c, a]).toEqual([
      { vara: '2ª Vara do JEF (exemplo)', juiz: 'Dr. Já Tinha (exemplo)' },
      { vara: '2ª Vara do JEF (exemplo)', tese: 'Miserabilidade (exemplo)' },
    ])
    const [h] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'acervo_completado'))
    expect([h.quem, h.alvo]).toEqual([ids.helena, `acervo:${acervoId}`])
    expect(h.detalhe).toMatchObject({ antes: { vara: null, juiz: 'Dr. Já Tinha (exemplo)', tese: null }, depois: { vara: '2ª Vara do JEF (exemplo)', tese: 'Miserabilidade (exemplo)' } })
    expect((await completar('helena', acervoId, { vara: 'Outra (exemplo)' })).statusCode).toBe(409)
  })

  it('só a Sênior completa; processo sem caso ou não conferido não tem a pergunta', async () => {
    const { acervoId } = await casoNoAcervo()
    expect((await completar('gabi', acervoId, { vara: 'X' })).statusCode).toBe(403)
    expect((await completar('helena', lidos[0], { vara: 'X' })).statusCode).toBe(404)
    expect((await completar('helena', acervoId, {})).json().erro).toBe('Escolha ou escreva o que falta.')
  })
})
