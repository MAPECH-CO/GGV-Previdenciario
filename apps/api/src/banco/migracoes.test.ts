import { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { describe, expect, it } from 'vitest'
import { pastaMigracoes } from './migrar.ts'

// Postgres em memória: roda na máquina e no CI sem Docker.
describe('migrações', () => {
  it('criam as tabelas de pessoa, caso, tarefa, evento de auditoria, usuário e sessão', async () => {
    const db = drizzle(new PGlite())
    await migrate(db, { migrationsFolder: pastaMigracoes })

    const { rows } = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    )
    expect(rows.map((r) => r.table_name)).toEqual(['caso', 'evento_auditoria', 'pessoa', 'sessao', 'tarefa', 'usuario'])
    await db.$client.close()
  })
})
