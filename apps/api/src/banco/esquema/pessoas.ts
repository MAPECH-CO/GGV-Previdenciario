// Pessoas: lead e cliente, vínculos, consentimento e o cofre do gov.br (GGVP-16, 43, 60, 103, 108).
import { boolean, customType, date, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { usuario } from './acesso.ts'
import { atualizadoEm, criadoEm, emLista, id, momento } from './comum.ts'

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })

export const SITUACOES_PESSOA = ['lead', 'cliente', 'nao_virou_cliente'] as const

/** Lead ou cliente. CPF e telefone normalizados (só dígitos) pela biblioteca campos; CPF repetido nunca cria outra pessoa. */
export const pessoa = pgTable(
  'pessoa',
  {
    id: id(),
    nome: text('nome').notNull(),
    cpf: text('cpf').unique(),
    dataNascimento: date('data_nascimento'),
    telefone: text('telefone'),
    telefone2: text('telefone_2'),
    email: text('email'),
    cep: text('cep'),
    logradouro: text('logradouro'),
    numero: text('numero'),
    complemento: text('complemento'),
    bairro: text('bairro'),
    cidade: text('cidade'),
    uf: text('uf'),
    situacao: text('situacao').notNull().default('lead'),
    /** G16: todo lead que não vira cliente fica com o motivo. */
    motivoNaoVirou: text('motivo_nao_virou'),
    origem: text('origem'),
    /** A pasta do cliente no Drive do escritório, achada ou criada no primeiro documento (GGVP-107 CA1). */
    drivePastaId: text('drive_pasta_id'),
    /** LGPD: fim da guarda; os dados pessoais são apagados e fica só o que a lei exige. */
    anonimizadoEm: momento('anonimizado_em'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [emLista('pessoa_situacao', t.situacao, SITUACOES_PESSOA)],
).enableRLS()

export const TIPOS_VINCULO = ['responsavel_legal', 'curador', 'familiar', 'procurador'] as const

/** Quem responde pela pessoa (BPC de menor de 16, GGVP-50) ou fala por ela. */
export const pessoaVinculo = pgTable(
  'pessoa_vinculo',
  {
    id: id(),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    vinculadaId: uuid('vinculada_id')
      .notNull()
      .references(() => pessoa.id),
    tipo: text('tipo').notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [emLista('pessoa_vinculo_tipo', t.tipo, TIPOS_VINCULO)],
).enableRLS()

export const FINALIDADES_CONSENTIMENTO = ['atendimento', 'gravacao', 'mensagens', 'dado_saude'] as const

/** LGPD: base legal e consentimento por finalidade, com revogação. */
export const consentimento = pgTable(
  'consentimento',
  {
    id: id(),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    finalidade: text('finalidade').notNull(),
    baseLegal: text('base_legal').notNull(),
    dadoEm: momento('dado_em').notNull().defaultNow(),
    registradoPor: uuid('registrado_por').references(() => usuario.id),
    revogadoEm: momento('revogado_em'),
  },
  (t) => [emLista('consentimento_finalidade', t.finalidade, FINALIDADES_CONSENTIMENTO)],
).enableRLS()

/**
 * Cofre do gov.br (G9, GGVP-103). A senha chega cifrada pela API (AES-256-GCM, chave em variável de ambiente);
 * o banco nunca vê a senha nem a chave. Cada leitura fica no histórico.
 */
export const credencialGovbr = pgTable('credencial_govbr', {
  id: id(),
  pessoaId: uuid('pessoa_id')
    .notNull()
    .unique()
    .references(() => pessoa.id),
  senhaCifrada: bytea('senha_cifrada').notNull(),
  iv: bytea('iv').notNull(),
  /** GGVP-36: renovar antes de vencer. */
  renovarAte: date('renovar_ate'),
  atualizadaPor: uuid('atualizada_por').references(() => usuario.id),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
}).enableRLS()

/**
 * A ficha da Recepção (GGVP-125, bloco 1), no formato das telas do Pedro: dados pessoais, triagem, contatos e o
 * histórico. Uma por pessoa; os dados principais também ficam em `pessoa`, que o resto do portal usa. Sem senha: a do
 * gov.br vai só para o cofre (G9). ponytail: documento por enquanto; normalizar em tabelas quando a ligação terminar.
 */
export const fichaRecepcao = pgTable('ficha_recepcao', {
  pessoaId: uuid('pessoa_id')
    .primaryKey()
    .references(() => pessoa.id),
  documento: jsonb('documento').notNull(),
  atualizadoEm: atualizadoEm(),
}).enableRLS()

/**
 * As tarefas da Recepção (GGVP-125, bloco 2), no formato da Central das telas: encaminhar ao setor, preencher ficha,
 * preparar entrevista, cadastrar lead. O id é o das telas ("preparar-<entrevista>"), uma por motivo. A `tarefa` do
 * portal pede um caso, e o lead ainda não tem. ponytail: juntar com `tarefa` quando o lead ganhar caso.
 */
export const tarefaRecepcao = pgTable('tarefa_recepcao', {
  id: text('id').primaryKey(),
  pessoaId: uuid('pessoa_id')
    .notNull()
    .references(() => pessoa.id),
  setor: text('setor').notNull(),
  dados: jsonb('dados').notNull(),
  concluidaEm: momento('concluida_em'),
  criadoEm: criadoEm(),
}).enableRLS()

/** Compromisso da agenda sem cliente, como "gravação amanhã" (GGVP-123, CA5). */
export const compromissoInterno = pgTable('compromisso_interno', {
  id: id(),
  titulo: text('titulo').notNull(),
  data: date('data').notNull(),
  hora: text('hora').notNull(),
  duracao: integer('duracao').notNull(),
  /** Id da equipe das telas (catálogo EQUIPE). */
  responsavel: text('responsavel').notNull(),
  estado: text('estado').notNull().default('marcado'),
  criadoPor: uuid('criado_por').references(() => usuario.id),
  criadoEm: criadoEm(),
}).enableRLS()

/**
 * As gravações e as conversas sem áudio da Recepção (GGVP-40, GGVP-46; GGVP-125, bloco 3a), no formato das telas,
 * guardadas para sempre. A entrevista com a advogada tem dado de saúde: `so_juridico` (só vai às telas com
 * `dado_saude.ver_detalhe`).
 */
export const gravacaoRecepcao = pgTable('gravacao_recepcao', {
  id: text('id').primaryKey(),
  pessoaId: uuid('pessoa_id')
    .notNull()
    .references(() => pessoa.id),
  soJuridico: boolean('so_juridico').notNull(),
  dados: jsonb('dados').notNull(),
  criadoEm: criadoEm(),
}).enableRLS()
