import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite/vector'
import { validarCnj } from '@ggv/campos'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { describe, expect, it } from 'vitest'
import { pastaMigracoes } from '../banco/migrar.ts'
import { CNJ_EXEMPLO, fonteDeExemplo, fontesAtivas } from './fontes.ts'

describe('fontes da vigília', () => {
  it('sem configuração, roda só a fonte de exemplo', () => {
    expect(fontesAtivas({}).map((f) => f.nome)).toEqual(['exemplo'])
  })

  it('AASP e DJEN sem integração falham com o motivo (nunca devolvem lista vazia)', async () => {
    const [aasp] = fontesAtivas({ FONTES_PUBLICACAO: 'aasp' })
    await expect(aasp.buscar(new Date(), new Date())).rejects.toThrow('credencial ausente')
  })

  it('a fonte de exemplo traz as publicações do dia, com CNJ válidos', async () => {
    const lista = await fonteDeExemplo.buscar(new Date('2026-10-05T00:00:00Z'), new Date('2026-10-05T16:00:00Z'))
    expect(lista.map((p) => p.disponibilizadaEm)).toEqual(Array(6).fill('2026-10-05'))
    for (const cnj of Object.values(CNJ_EXEMPLO)) expect(validarCnj(cnj)).toBe(true)
    expect(lista.filter((p) => p.numeroCnj === null)).toHaveLength(1)
  })
})

describe('GGVP-30 CA10 · credenciais das fontes fora do código e do banco', () => {
  it('quais fontes rodam vem só do ambiente (.env local e Coolify)', () => {
    expect(fontesAtivas({ FONTES_PUBLICACAO: 'aasp, djen' }).map((f) => f.nome)).toEqual(['aasp', 'djen'])
  })

  it('o banco não tem coluna onde caiba credencial de fonte (o segredo no código, o gitleaks do CI barra)', async () => {
    const db = drizzle(new PGlite({ extensions: { vector } }))
    await migrate(db, { migrationsFolder: pastaMigracoes })
    const { rows } = await db.execute<{ coluna: string }>(
      sql`select table_name || '.' || column_name as coluna from information_schema.columns where table_schema = 'public'`,
    )
    await db.$client.close()
    expect(rows.length).toBeGreaterThan(100)
    // `sessao.token_hash` é o hash do cookie de login (GGVP-117), não credencial de fonte.
    const suspeitas = rows.map((r) => r.coluna).filter((c) => /aasp|djen|token|api_?key|chave_api|segredo/.test(c) && c !== 'sessao.token_hash')
    expect(suspeitas).toEqual([])
  })
})
