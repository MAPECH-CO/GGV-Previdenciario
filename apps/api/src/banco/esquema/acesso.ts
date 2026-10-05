// Acesso: quem entra, sessão e histórico (GGVP-117, GGVP-96, GGVP-99).
import { sql } from 'drizzle-orm'
import { boolean, check, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { PERFIS } from '@ggv/contratos'
import { criadoEm, id, momento } from './comum.ts'

/** Quem entra no portal. Só o hash da senha; `perfis` vazio até o Sócio atribuir (GGVP-96). */
export const usuario = pgTable('usuario', {
  id: id(),
  email: text('email').notNull().unique(),
  nome: text('nome').notNull(),
  senhaHash: text('senha_hash').notNull(),
  /** Perfis da matriz (`@ggv/contratos`); a pessoa escolhe um por vez no "Entrar como…". */
  perfis: text('perfis').array().notNull().default([]),
  /** Senha provisória cadastrada pela gestão: troca obrigatória no primeiro acesso. */
  trocarSenha: boolean('trocar_senha').notNull().default(true),
  tentativasErradas: integer('tentativas_erradas').notNull().default(0),
  travadoAte: momento('travado_ate'),
  criadoEm: criadoEm(),
}, (t) => [
  // O banco recusa perfil fora da matriz (`PERFIS` de @ggv/contratos).
  check('usuario_perfis_validos', sql`${t.perfis} <@ ARRAY[${sql.raw(PERFIS.map((p) => `'${p}'`).join(', '))}]::text[]`),
]).enableRLS()

/** Sessão aberta. O cookie leva o token; aqui fica só o hash dele. */
export const sessao = pgTable('sessao', {
  id: id(),
  usuarioId: uuid('usuario_id')
    .notNull()
    .references(() => usuario.id),
  tokenHash: text('token_hash').notNull().unique(),
  /** Perfil escolhido no "Entrar como…"; o servidor confere as ações por ele (GGVP-96 CA8). */
  perfilAtivo: text('perfil_ativo'),
  expiraEm: momento('expira_em').notNull(),
  criadoEm: criadoEm(),
}).enableRLS()

/**
 * Quem fez o quê, incluindo a IA. Só cresce: um gatilho recusa update e delete (migração do modelo de dados).
 * `detalhe` leva ids e nomes de campo, nunca dado de saúde nem senha.
 */
export const eventoAuditoria = pgTable('evento_auditoria', {
  id: id(),
  quem: text('quem').notNull(),
  acao: text('acao').notNull(),
  alvo: text('alvo').notNull(),
  quando: momento('quando').notNull().defaultNow(),
  detalhe: jsonb('detalhe').notNull().default({}),
}).enableRLS()

/** LGPD: cada leitura de dado de saúde por perfil autorizado (GGVP-96 CA13). */
export const acessoDadoSensivel = pgTable('acesso_dado_sensivel', {
  id: id(),
  usuarioId: uuid('usuario_id')
    .notNull()
    .references(() => usuario.id),
  perfil: text('perfil').notNull(),
  casoId: uuid('caso_id'),
  recurso: text('recurso').notNull(),
  quando: momento('quando').notNull().defaultNow(),
}).enableRLS()
