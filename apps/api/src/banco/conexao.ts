// Abre o banco. Com DATABASE_URL: o Postgres de verdade (dev na VPS ou homologação).
// Sem: um Postgres embutido (PGlite) gravado em apps/api/.banco-local, migrado e com usuários de exemplo,
// para o portal rodar na máquina sem Docker e sem Supabase.
import { fileURLToPath } from 'node:url'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as esquema from './esquema.ts'
import { pastaMigracoes } from './migrar.ts'
import { semearExemplos } from './exemplo.ts'

export type Banco = PgDatabase<PgQueryResultHKT, typeof esquema>

export const pastaBancoLocal = fileURLToPath(new URL('../../.banco-local', import.meta.url))

export async function abrirBanco(url = process.env.DATABASE_URL): Promise<{ banco: Banco; fechar: () => Promise<void> }> {
  if (url) {
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const banco = drizzle(url, { schema: esquema })
    return { banco, fechar: () => banco.$client.end() }
  }
  // Padrão: na memória, com os usuários de exemplo, limpo a cada start. No Windows o `--watch` mata a API no meio
  // da gravação e corrompe a pasta; na memória isso não acontece. BANCO_LOCAL=pasta guarda em apps/api/.banco-local.
  return abrirBancoEmbutido(process.env.BANCO_LOCAL === 'pasta' ? pastaBancoLocal : undefined, true)
}

/** Postgres embutido. `pasta` indefinida: só na memória. `semear`: usuários de exemplo, se o banco estiver vazio. */
export async function abrirBancoEmbutido(pasta?: string, semear = false): Promise<{ banco: Banco; fechar: () => Promise<void> }> {
  const { PGlite } = await import('@electric-sql/pglite')
  // A base de conhecimento do acervo usa pgvector (GGVP-141, ADR-013); o PGlite traz a extensão.
  const { vector } = await import('@electric-sql/pglite/vector')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  const banco = drizzle(new PGlite({ dataDir: pasta, extensions: { vector } }), { schema: esquema })
  await migrate(banco, { migrationsFolder: pastaMigracoes })
  if (semear) await semearExemplos(banco)
  return { banco, fechar: () => banco.$client.close() }
}
