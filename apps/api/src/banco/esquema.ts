// Tabelas mínimas do portal (GGVP-118). Mudou aqui: `pnpm --filter @ggv/api db:gerar` cria a migração versionada.
import { boolean, date, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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

/** Quem entra no portal (GGVP-117). Só o hash da senha; `perfil` nulo até a gestão atribuir (GGVP-96). */
export const usuario = pgTable('usuario', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  nome: text('nome').notNull(),
  senhaHash: text('senha_hash').notNull(),
  perfil: text('perfil'),
  /** Senha provisória cadastrada pela gestão: troca obrigatória no primeiro acesso. */
  trocarSenha: boolean('trocar_senha').notNull().default(true),
  tentativasErradas: integer('tentativas_erradas').notNull().default(0),
  travadoAte: timestamp('travado_ate', { withTimezone: true }),
  criadoEm: criadoEm(),
})

/** Sessão aberta. O cookie leva o token; aqui fica só o hash dele. */
export const sessao = pgTable('sessao', {
  id: uuid('id').primaryKey().defaultRandom(),
  usuarioId: uuid('usuario_id')
    .notNull()
    .references(() => usuario.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
  criadoEm: criadoEm(),
})
