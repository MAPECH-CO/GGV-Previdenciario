// Tabelas mínimas do portal (GGVP-118). Mudou aqui: `pnpm --filter @ggv/api db:gerar` cria a migração versionada.
import { date, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

const criadoEm = () => timestamp('criado_em', { withTimezone: true }).notNull().defaultNow()

export const pessoa = pgTable('pessoa', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  cpf: text('cpf').unique(),
  criadoEm: criadoEm(),
})

export const caso = pgTable('caso', {
  id: uuid('id').primaryKey().defaultRandom(),
  pessoaId: uuid('pessoa_id')
    .notNull()
    .references(() => pessoa.id),
  beneficio: text('beneficio').notNull(),
  criadoEm: criadoEm(),
})

export const tarefa = pgTable('tarefa', {
  id: uuid('id').primaryKey().defaultRandom(),
  casoId: uuid('caso_id')
    .notNull()
    .references(() => caso.id),
  titulo: text('titulo').notNull(),
  prazo: date('prazo'),
  criadoEm: criadoEm(),
  concluidaEm: timestamp('concluida_em', { withTimezone: true }),
})

/** Quem fez o quê, incluindo a IA. `detalhe` leva ids e nomes de campo, nunca dado de saúde. */
export const eventoAuditoria = pgTable('evento_auditoria', {
  id: uuid('id').primaryKey().defaultRandom(),
  quem: text('quem').notNull(),
  acao: text('acao').notNull(),
  alvo: text('alvo').notNull(),
  quando: timestamp('quando', { withTimezone: true }).notNull().defaultNow(),
  detalhe: jsonb('detalhe').notNull().default({}),
})
