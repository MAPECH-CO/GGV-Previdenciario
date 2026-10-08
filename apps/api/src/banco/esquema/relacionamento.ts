// Relacionamento com o cliente (GGVP-138): as versões dos campos mudados pela conversa e os dados bancários do repasse.
// A conversa fica em `atendimento` e a mensagem em `mensagem`, que o modelo de dados já tinha.
import { sql } from 'drizzle-orm'
import { check, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { usuario } from './acesso.ts'
import { atendimento, caso } from './casos.ts'
import { criadoEm, emLista, id, momento } from './comum.ts'
import { pessoa } from './pessoas.ts'

export const ONDE_VERSAO = ['ficha', 'processo'] as const
export const ORIGENS_VERSAO = ['antes', 'conversa', 'volta'] as const

/**
 * Cada versão de um campo mudado pela conversa (GGVP-84 CA2, G14): o valor de antes, cada mudança e cada volta, com quem
 * e quando. Os campos do processo (perícia, fato novo, documento citado) vivem aqui até a página do processo existir.
 */
export const versaoCampo = pgTable(
  'versao_campo',
  {
    id: id(),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    casoId: uuid('caso_id').references(() => caso.id),
    onde: text('onde').notNull(),
    campo: text('campo').notNull(),
    valor: text('valor').notNull(),
    /** O nome de quem mudou, como as telas mostram ("Valor de antes da conversa" na primeira). */
    quem: text('quem').notNull(),
    quando: momento('quando').notNull(),
    origem: text('origem').notNull(),
    conversaId: uuid('conversa_id').references(() => atendimento.id),
    criadoEm: criadoEm(),
  },
  (t) => [emLista('versao_campo_onde', t.onde, ONDE_VERSAO), emLista('versao_campo_origem', t.origem, ORIGENS_VERSAO)],
).enableRLS()

export const COMO_VERIFICOU = ['video', 'presencial'] as const

/**
 * Os dados bancários para o repasse (GGVP-111): cada mudança nasce como pedido, com a verificação do cliente, e só vale
 * com a segunda confirmação de outra pessoa (CA5). O banco recusa a mesma pessoa nas duas pontas. Em vigor: a última
 * confirmada; o pedido aberto: a sem confirmação.
 */
export const dadoBancario = pgTable(
  'dado_bancario',
  {
    id: id(),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    banco: text('banco').notNull(),
    agencia: text('agencia').notNull(),
    conta: text('conta').notNull(),
    pix: text('pix'),
    verificacao: text('verificacao').notNull(),
    pedidoPor: uuid('pedido_por')
      .notNull()
      .references(() => usuario.id),
    pedidoEm: momento('pedido_em').notNull(),
    confirmadoPor: uuid('confirmado_por').references(() => usuario.id),
    confirmadoEm: momento('confirmado_em'),
    /** Outro pedido tomou o lugar deste antes da confirmação. */
    descartadoEm: momento('descartado_em'),
    criadoEm: criadoEm(),
  },
  (t) => [
    emLista('dado_bancario_verificacao', t.verificacao, COMO_VERIFICOU),
    check('dado_bancario_pessoas_diferentes', sql`${t.confirmadoPor} is null or ${t.confirmadoPor} <> ${t.pedidoPor}`),
  ],
).enableRLS()
