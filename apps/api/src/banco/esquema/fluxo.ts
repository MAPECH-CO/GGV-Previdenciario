// Fluxo: onde o caso está no BPMN, as tarefas de cada raia e as decisões de pessoa (GGVP-105, 78, 94, 109).
import { date, integer, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { usuario } from './acesso.ts'
import { caso } from './casos.ts'
import { criadoEm, emLista, id, momento } from './comum.ts'

export const DIAGRAMAS = ['D1', 'D2', 'D3', 'D3a', 'D3b', 'D4', 'DP'] as const
export const SITUACOES_ETAPA = ['aberta', 'aguardando_externo', 'concluida', 'cancelada'] as const

/**
 * Um passo do BPMN em andamento no caso. Junção: várias etapas abertas com o mesmo `juncao`.
 * Perícia como subprocesso: a etapa do DP aponta para quem chamou (`chamadaPorId`) e devolve para ela.
 */
export const etapa = pgTable(
  'etapa',
  {
    id: id(),
    casoId: uuid('caso_id')
      .notNull()
      .references(() => caso.id),
    diagrama: text('diagrama').notNull(),
    passo: text('passo').notNull(),
    situacao: text('situacao').notNull().default('aberta'),
    juncao: text('juncao'),
    chamadaPorId: uuid('chamada_por_id'),
    aguardando: text('aguardando'),
    iniciadaEm: momento('iniciada_em').notNull().defaultNow(),
    concluidaEm: momento('concluida_em'),
    concluidaPor: uuid('concluida_por').references(() => usuario.id),
  },
  (t) => [emLista('etapa_diagrama', t.diagrama, DIAGRAMAS), emLista('etapa_situacao', t.situacao, SITUACOES_ETAPA)],
).enableRLS()

export const SITUACOES_TAREFA = ['aberta', 'em_andamento', 'aguardando', 'concluida', 'cancelada'] as const

/** Tarefa de pessoa na Central do perfil dono da raia (GGVP-78). Título nunca leva CID nem diagnóstico. */
export const tarefa = pgTable(
  'tarefa',
  {
    id: id(),
    casoId: uuid('caso_id')
      .notNull()
      .references(() => caso.id),
    etapaId: uuid('etapa_id').references(() => etapa.id),
    passo: text('passo'),
    titulo: text('titulo').notNull(),
    perfilDono: text('perfil_dono'),
    responsavelId: uuid('responsavel_id').references(() => usuario.id),
    situacao: text('situacao').notNull().default('aberta'),
    /** Prazo interno do escritório; o prazo do processo fica em `prazo` e aparece ao lado. */
    prazo: date('prazo'),
    prazoProcessualId: uuid('prazo_processual_id'),
    tentativas: integer('tentativas').notNull().default(0),
    /** G15: limite vem da configuração (Q1); passou, escala. */
    limiteTentativas: integer('limite_tentativas'),
    escaladaEm: momento('escalada_em'),
    escaladaPara: text('escalada_para'),
    evidenciaDocumentoId: uuid('evidencia_documento_id'),
    criadoEm: criadoEm(),
    concluidaEm: momento('concluida_em'),
    concluidaPor: uuid('concluida_por').references(() => usuario.id),
  },
  (t) => [emLista('tarefa_situacao', t.situacao, SITUACOES_TAREFA)],
).enableRLS()

/** Cada tentativa de um laço de cobrança, contato ou remarcação (G15). */
export const tentativa = pgTable('tentativa', {
  id: id(),
  tarefaId: uuid('tarefa_id')
    .notNull()
    .references(() => tarefa.id),
  quando: momento('quando').notNull().defaultNow(),
  canal: text('canal'),
  resultado: text('resultado').notNull(),
  registradaPor: uuid('registrada_por').references(() => usuario.id),
}).enableRLS()

/** O que chega de fora (INSS, publicação, ZapSign, webhook). A chave externa única impede transição duplicada (GGVP-105 CA11). */
export const eventoExterno = pgTable(
  'evento_externo',
  {
    id: id(),
    fonte: text('fonte').notNull(),
    chaveExterna: text('chave_externa').notNull(),
    casoId: uuid('caso_id').references(() => caso.id),
    payload: jsonb('payload').notNull().default({}),
    recebidoEm: momento('recebido_em').notNull().defaultNow(),
    processadoEm: momento('processado_em'),
  },
  (t) => [unique('evento_externo_unico').on(t.fonte, t.chaveExterna)],
).enableRLS()

/**
 * Decisão de pessoa num portão: OK, aprovação, reprovação, despacho, dispensa (G2, G4, G5, G6, G8, G17).
 * A sugestão da IA fica em `sugestaoIa`, separada do que a pessoa decidiu. A IA nunca grava `resultado`.
 */
export const decisao = pgTable('decisao', {
  id: id(),
  casoId: uuid('caso_id')
    .notNull()
    .references(() => caso.id),
  passo: text('passo').notNull(),
  tipo: text('tipo').notNull(),
  resultado: text('resultado').notNull(),
  justificativa: text('justificativa'),
  sugestaoIa: jsonb('sugestao_ia'),
  decididoPor: uuid('decidido_por')
    .notNull()
    .references(() => usuario.id),
  perfil: text('perfil').notNull(),
  decididoEm: momento('decidido_em').notNull().defaultNow(),
}).enableRLS()
