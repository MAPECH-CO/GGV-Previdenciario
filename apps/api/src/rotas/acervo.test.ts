import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { eventoAuditoria, processoAcervo, usuario } from '../banco/esquema.ts'
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
const conferir = async (apelido: string, id: string, desfecho: string) =>
  app.inject({ method: 'POST', url: `/api/acervo/processos/${id}/conferencia`, cookies: await cookieDe(apelido), payload: { desfecho } })
const itemDaCentral = async (apelido: string) =>
  ((await app.inject({ method: 'GET', url: '/api/tarefas', cookies: await cookieDe(apelido) })).json() as { titulo: string; detalhe: string; tela: string | null }[]).find(
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
    expect(await itemDaCentral('helena')).toMatchObject({ detalhe: '2 processos', tela: '/acervo/conferencia' })
    expect(await itemDaCentral('gabi')).toBeUndefined()
    for (const id of lidos) await conferir('helena', id, 'improcedente')
    expect(await itemDaCentral('helena')).toBeUndefined()
  })
})
