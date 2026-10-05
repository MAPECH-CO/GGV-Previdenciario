// Peças repetidas em toda tabela do portal (modelo de dados, design da change ggvp-2-fundacao-tecnica).
import { sql, type SQL } from 'drizzle-orm'
import { check, timestamp, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core'

export const id = () => uuid('id').primaryKey().defaultRandom()
export const criadoEm = () => timestamp('criado_em', { withTimezone: true }).notNull().defaultNow()
export const atualizadoEm = () => timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow()
export const momento = (nome: string) => timestamp(nome, { withTimezone: true })

/** `check` de lista fechada: o banco recusa valor fora da lista mesmo se a API errar. Valores são constantes do código. */
export function emLista(nome: string, coluna: AnyPgColumn, valores: readonly string[]) {
  const lista = valores.map((v) => `'${v.replaceAll("'", "''")}'`).join(', ')
  return check(nome, sql`${coluna} in (${sql.raw(lista)})` as SQL)
}
