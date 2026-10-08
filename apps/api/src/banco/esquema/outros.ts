// Financeiro, jurimetria e acervo, mensagens e configuração (GGVP-44, 55, 59, 64, 75, 90, 92, 98, 102, 104).
import { sql } from 'drizzle-orm'
import { boolean, check, date, integer, jsonb, numeric, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { usuario } from './acesso.ts'
import { caso } from './casos.ts'
import { documento } from './documentos.ts'
import { atualizadoEm, criadoEm, emLista, id, momento } from './comum.ts'
import { pessoa } from './pessoas.ts'

/**
 * Prestação de contas (G8): o aviso ao cliente só nasce depois do OK da advogada.
 * Quem dá o OK não registra o recebimento (GGVP-96 CA16): o banco recusa a mesma pessoa nas duas pontas.
 */
export const prestacaoContas = pgTable(
  'prestacao_contas',
  {
    id: id(),
    casoId: uuid('caso_id')
      .notNull()
      .references(() => caso.id),
    valorRecebido: numeric('valor_recebido', { precision: 14, scale: 2 }).notNull(),
    honorarios: numeric('honorarios', { precision: 14, scale: 2 }).notNull(),
    valorCliente: numeric('valor_cliente', { precision: 14, scale: 2 }).notNull(),
    /** Alterar depois de concluída grava a versão seguinte; a anterior fica (GGVP-44 CA6). */
    versao: integer('versao').notNull().default(1),
    percentualHonorarios: numeric('percentual_honorarios', { precision: 5, scale: 2 }),
    formaPagamento: text('forma_pagamento'),
    prazoPagamento: date('prazo_pagamento'),
    cartaDocumentoId: uuid('carta_documento_id').references(() => documento.id),
    /** Motivo da divergência registrada pelo Financeiro (GGVP-44 CA9). */
    divergencia: text('divergencia'),
    okAdvogadaPor: uuid('ok_advogada_por').references(() => usuario.id),
    okAdvogadaEm: momento('ok_advogada_em'),
    recebidaPor: uuid('recebida_por').references(() => usuario.id),
    recebidaEm: momento('recebida_em'),
    clienteAvisadoEm: momento('cliente_avisado_em'),
    criadoEm: criadoEm(),
  },
  (t) => [
    unique('prestacao_versao_unica').on(t.casoId, t.versao),
    check('prestacao_pessoas_diferentes', sql`${t.okAdvogadaPor} is null or ${t.recebidaPor} is null or ${t.okAdvogadaPor} <> ${t.recebidaPor}`),
    check('prestacao_aviso_depois_do_ok', sql`${t.clienteAvisadoEm} is null or ${t.okAdvogadaEm} is not null`),
  ],
).enableRLS()

/** Perito com as grafias conhecidas, para a jurimetria (GGVP-59, 73). */
export const perito = pgTable('perito', {
  id: id(),
  nome: text('nome').notNull(),
  nomeNormalizado: text('nome_normalizado').notNull().unique(),
  grafias: jsonb('grafias').notNull().default([]),
  especialidade: text('especialidade'),
  /** O perfil do perito (GGVP-61, GGVP-73): o tipo, onde atua e um laudo por linha, sem dado pessoal do cliente. */
  perfil: jsonb('perfil'),
  criadoEm: criadoEm(),
}).enableRLS()

export const juizo = pgTable(
  'juizo',
  {
    id: id(),
    tribunal: text('tribunal').notNull(),
    nome: text('nome').notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [unique('juizo_unico').on(t.tribunal, t.nome)],
).enableRLS()

/** Acervo do escritório (D4): só desfecho conferido por pessoa entra nas contas da jurimetria (GGVP-41 CA5, GGVP-55 CA7). */
export const processoAcervo = pgTable('processo_acervo', {
  id: id(),
  numeroCnj: text('numero_cnj').unique(),
  casoId: uuid('caso_id').references(() => caso.id),
  beneficio: text('beneficio'),
  peritoId: uuid('perito_id').references(() => perito.id),
  juizoId: uuid('juizo_id').references(() => juizo.id),
  desfecho: text('desfecho'),
  desfechoConferidoPor: uuid('desfecho_conferido_por').references(() => usuario.id),
  dataDecisao: date('data_decisao'),
  fonte: text('fonte').notNull(),
  criadoEm: criadoEm(),
}).enableRLS()

export const CANAIS_MENSAGEM = ['whatsapp', 'sms', 'email', 'telefone'] as const
export const STATUS_MENSAGEM = ['enviada', 'entregue', 'lida', 'falhou'] as const

/** Mensagem ao cliente pelo modelo, com registro (GGVP-102). Nunca leva diagnóstico nem CID. */
export const mensagem = pgTable(
  'mensagem',
  {
    id: id(),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    casoId: uuid('caso_id').references(() => caso.id),
    canal: text('canal').notNull(),
    modeloId: uuid('modelo_id'),
    conteudo: text('conteudo').notNull(),
    aprovadaPor: uuid('aprovada_por').references(() => usuario.id),
    enviadaPor: uuid('enviada_por').references(() => usuario.id),
    enviadaEm: momento('enviada_em'),
    /** GGVP-138: o modelo do catálogo das telas (`MODELOS_DE_MENSAGEM`), a conversa do Chatwoot e o status de entrega. */
    modelo: text('modelo'),
    conversaChatwoot: integer('conversa_chatwoot'),
    status: text('status'),
    /** O motivo do Chatwoot quando não saiu (GGVP-102 CA5). */
    erro: text('erro'),
    criadoEm: criadoEm(),
  },
  (t) => [emLista('mensagem_canal', t.canal, CANAIS_MENSAGEM), emLista('mensagem_status', t.status, STATUS_MENSAGEM)],
).enableRLS()

/** Configuração do escritório (GGVP-104): limites de cobrança (Q1), prazo de guarda (LGPD) e afins, com quem mudou. */
export const configuracao = pgTable('configuracao', {
  chave: text('chave').primaryKey(),
  valor: jsonb('valor').notNull(),
  alteradoPor: uuid('alterado_por').references(() => usuario.id),
  atualizadoEm: atualizadoEm(),
}).enableRLS()

/** Roteiro de conteúdo mínimo por benefício, versionado (GGVP-93). */
export const roteiroLaudo = pgTable(
  'roteiro_laudo',
  {
    id: id(),
    beneficio: text('beneficio').notNull(),
    versao: integer('versao').notNull(),
    itens: jsonb('itens').notNull(),
    vigenteDesde: date('vigente_desde').notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [unique('roteiro_versao_unica').on(t.beneficio, t.versao)],
).enableRLS()

/** Kit de documentos por benefício (G1, GGVP-65). */
export const kitDocumento = pgTable(
  'kit_documento',
  {
    id: id(),
    beneficio: text('beneficio').notNull(),
    tipoDocumento: text('tipo_documento').notNull(),
    obrigatorio: boolean('obrigatorio').notNull().default(true),
    /** GGVP-104 CA1, CA6: cada publicação é uma versão; o caso usa a vigente quando foi aberto. */
    versao: integer('versao').notNull().default(1),
    vigenteDesde: momento('vigente_desde').notNull().defaultNow(),
    revogadoEm: momento('revogado_em'),
  },
  (t) => [unique('kit_unico').on(t.beneficio, t.tipoDocumento, t.versao)],
).enableRLS()

export const TIPOS_MODELO = ['contrato', 'mensagem', 'peticao'] as const

export const modelo = pgTable(
  'modelo',
  {
    id: id(),
    tipo: text('tipo').notNull(),
    nome: text('nome').notNull(),
    versao: integer('versao').notNull().default(1),
    conteudo: text('conteudo').notNull(),
    ativo: boolean('ativo').notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [unique('modelo_versao_unica').on(t.tipo, t.nome, t.versao), emLista('modelo_tipo', t.tipo, TIPOS_MODELO)],
).enableRLS()

/** Feriados e suspensões por tribunal, para a contagem de prazo (GGVP-34). `tribunal` nulo: nacional. */
export const feriado = pgTable(
  'feriado',
  {
    id: id(),
    data: date('data').notNull(),
    tribunal: text('tribunal'),
    descricao: text('descricao').notNull(),
  },
  (t) => [unique('feriado_unico').on(t.data, t.tribunal)],
).enableRLS()
