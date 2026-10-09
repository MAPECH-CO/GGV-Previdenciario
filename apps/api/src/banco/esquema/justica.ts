// Judicialização e vigília (GGVP-26, 30, 34, 37, 52, 54, 63, 67, 71, 74, 79, 83, 87).
import { CLASSES_DE_ATO } from '@ggv/contratos'
import { boolean, date, integer, jsonb, numeric, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { usuario } from './acesso.ts'
import { caso } from './casos.ts'
import { criadoEm, emLista, id, momento } from './comum.ts'
import { documento } from './documentos.ts'

/** As classes do ato vêm do contrato, uma lista só para a tela, o servidor e o banco (GGVP-59: nomeação de perito). */
export const CLASSES_ATO = CLASSES_DE_ATO
export const FILAS_PUBLICACAO = ['revisao'] as const

/** Publicação do diário, casada pelo CNJ normalizado; repetida é descartada pelo hash; sem CNJ vai para a fila de revisão. */
export const publicacao = pgTable(
  'publicacao',
  {
    id: id(),
    fonte: text('fonte').notNull(),
    numeroCnj: text('numero_cnj'),
    casoId: uuid('caso_id').references(() => caso.id),
    disponibilizadaEm: date('disponibilizada_em').notNull(),
    texto: text('texto').notNull(),
    hash: text('hash').notNull().unique(),
    classe: text('classe'),
    classeSugeridaIa: text('classe_sugerida_ia'),
    confiancaIa: numeric('confianca_ia', { precision: 4, scale: 3 }),
    revisadaPor: uuid('revisada_por').references(() => usuario.id),
    revisadaEm: momento('revisada_em'),
    /** Partes citadas, como vieram da fonte (GGVP-26 CA7). */
    partes: text('partes'),
    /** `revisao`: sem CNJ ou CNJ desconhecido, esperando a Sênior (GGVP-26 CA3, CA5). */
    fila: text('fila'),
    motivoFila: text('motivo_fila'),
    vinculadaPor: uuid('vinculada_por').references(() => usuario.id),
    vinculadaEm: momento('vinculada_em'),
    foraDoEscritorio: boolean('fora_do_escritorio').notNull().default(false),
    criadoEm: criadoEm(),
  },
  (t) => [emLista('publicacao_classe', t.classe, CLASSES_ATO), emLista('publicacao_fila', t.fila, FILAS_PUBLICACAO)],
).enableRLS()

export const SITUACOES_RODADA = ['prevista', 'rodando', 'ok', 'falhou', 'nao_rodou'] as const

/** G13: cada rodada da vigília (3 por dia), para nunca confundir falha com dia sem publicação. */
export const rodadaVigilia = pgTable(
  'rodada_vigilia',
  {
    id: id(),
    fonte: text('fonte').notNull(),
    previstaPara: momento('prevista_para').notNull(),
    inicio: momento('inicio'),
    fim: momento('fim'),
    situacao: text('situacao').notNull().default('prevista'),
    capturadas: integer('capturadas').notNull().default(0),
    erro: text('erro'),
    reprocessadaPor: uuid('reprocessada_por').references(() => usuario.id),
    reprocessadaEm: momento('reprocessada_em'),
  },
  (t) => [unique('rodada_unica').on(t.fonte, t.previstaPara), emLista('rodada_situacao', t.situacao, SITUACOES_RODADA)],
).enableRLS()

/** Prazo calculado por código, pelo lado seguro na dúvida (G12, G19, GGVP-34). */
export const prazo = pgTable('prazo', {
  id: id(),
  casoId: uuid('caso_id')
    .notNull()
    .references(() => caso.id),
  origem: text('origem').notNull(),
  publicacaoId: uuid('publicacao_id').references(() => publicacao.id),
  inicio: date('inicio').notNull(),
  fim: date('fim').notNull(),
  regra: text('regra').notNull(),
  /** Versão da regra de contagem usada (GGVP-34 CA6). */
  regraVersao: integer('regra_versao').notNull().default(1),
  criadoEm: criadoEm(),
}).enableRLS()

/** Publicação repetida descartada, com o motivo (GGVP-26 CA2, CA6). */
export const publicacaoDescarte = pgTable('publicacao_descarte', {
  id: id(),
  fonte: text('fonte').notNull(),
  numeroCnj: text('numero_cnj'),
  disponibilizadaEm: date('disponibilizada_em').notNull(),
  trecho: text('trecho').notNull(),
  motivo: text('motivo').notNull(),
  publicacaoId: uuid('publicacao_id').references(() => publicacao.id),
  criadoEm: criadoEm(),
}).enableRLS()

/** Cada reclassificação, para medir o acerto da IA quando ela existir (GGVP-34 CA10, GGVP-37 CA7). */
export const publicacaoReclassificacao = pgTable('publicacao_reclassificacao', {
  id: id(),
  publicacaoId: uuid('publicacao_id')
    .notNull()
    .references(() => publicacao.id),
  de: text('de').notNull(),
  para: text('para').notNull(),
  por: uuid('por')
    .notNull()
    .references(() => usuario.id),
  criadoEm: criadoEm(),
}).enableRLS()

export const TIPOS_PETICAO = ['inicial', 'manifestacao', 'recurso', 'dilacao'] as const

export const peticao = pgTable(
  'peticao',
  {
    id: id(),
    casoId: uuid('caso_id')
      .notNull()
      .references(() => caso.id),
    tipo: text('tipo').notNull(),
    pedidaPor: uuid('pedida_por').references(() => usuario.id),
    /** O pedido da petição inicial (GGVP-63 CA6, CA9): instruções, opções e os documentos citados, na ordem. */
    instrucoes: text('instrucoes'),
    opcoes: jsonb('opcoes'),
    citados: jsonb('citados'),
    criadoEm: criadoEm(),
  },
  (t) => [emLista('peticao_tipo', t.tipo, TIPOS_PETICAO)],
).enableRLS()

/** Versões da peça (G6): a aprovada não muda; mexer depois cria versão nova. Sai sempre com a assinatura padrão do Glauco. */
export const peticaoVersao = pgTable(
  'peticao_versao',
  {
    id: id(),
    peticaoId: uuid('peticao_id')
      .notNull()
      .references(() => peticao.id),
    numero: integer('numero').notNull(),
    conteudo: text('conteudo').notNull(),
    hash: text('hash').notNull(),
    geradaPor: text('gerada_por').notNull(),
    pedidoDeMudanca: text('pedido_de_mudanca'),
    /** A versão anexada pela advogada (GGVP-87; sem IA, ela redige fora do portal). */
    documentoId: uuid('documento_id').references(() => documento.id),
    aprovadaPor: uuid('aprovada_por').references(() => usuario.id),
    aprovadaEm: momento('aprovada_em'),
    /** O pacote do protocolo da versão aprovada (GGVP-71 CA8): os arquivos na ordem, com o documento e o hash. */
    pacote: jsonb('pacote'),
    pacoteGeradoEm: momento('pacote_gerado_em'),
    criadoEm: criadoEm(),
  },
  (t) => [unique('peticao_versao_unica').on(t.peticaoId, t.numero)],
).enableRLS()

export const protocoloJudicial = pgTable('protocolo_judicial', {
  id: id(),
  peticaoVersaoId: uuid('peticao_versao_id')
    .notNull()
    .references(() => peticaoVersao.id),
  tribunal: text('tribunal').notNull(),
  numero: text('numero'),
  protocoladoEm: momento('protocolado_em').notNull(),
  comprovanteDocumentoId: uuid('comprovante_documento_id').references(() => documento.id),
  protocoladoPor: uuid('protocolado_por')
    .notNull()
    .references(() => usuario.id),
}).enableRLS()
