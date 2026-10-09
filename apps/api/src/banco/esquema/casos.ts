// Caso: o pedido de benefício de uma pessoa, do atendimento ao desfecho (GGVP-108, 24, 40, 21).
import { BENEFICIOS } from '@ggv/contratos'
import { integer, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'
import { usuario } from './acesso.ts'
import { atualizadoEm, criadoEm, emLista, id, momento } from './comum.ts'
import { pessoa } from './pessoas.ts'

// GGVP-104 CA5: o catálogo de benefícios é um só, nos contratos; o banco recusa benefício fora dele.
export { BENEFICIOS }
export const FASES_CASO = ['atendimento', 'administrativa', 'judicial', 'encerrado'] as const
export const DESFECHOS = [
  'deferido',
  'procedente_total',
  'procedente_parcial',
  'improcedente',
  'extinto_sem_merito',
  'desistencia',
] as const

export const caso = pgTable(
  'caso',
  {
    id: id(),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    /** Pode faltar até a advogada confirmar (G3: a sugestão da IA fica em `decisao`). */
    beneficio: text('beneficio'),
    fase: text('fase').notNull().default('atendimento'),
    advogadaResponsavelId: uuid('advogada_responsavel_id').references(() => usuario.id),
    desfecho: text('desfecho'),
    /** Causa da extinção sem mérito (GGVP-37 CA5, GGVP-75 CA2). */
    causaDesfecho: text('causa_desfecho'),
    encerradoEm: momento('encerrado_em'),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    emLista('caso_beneficio', t.beneficio, BENEFICIOS),
    emLista('caso_fase', t.fase, FASES_CASO),
    emLista('caso_desfecho', t.desfecho, DESFECHOS),
  ],
).enableRLS()

/**
 * O contrato do caso da Recepção (GGVP-65 em diante; GGVP-125, bloco 4a), no formato das telas: o kit, o preenchimento, a
 * assinatura, a conferência e a cópia, com a etapa do processo que as telas mostram. Um por caso.
 */
export const contratoRecepcao = pgTable('contrato_recepcao', {
  casoId: uuid('caso_id')
    .primaryKey()
    .references(() => caso.id),
  pessoaId: uuid('pessoa_id')
    .notNull()
    .references(() => pessoa.id),
  dados: jsonb('dados').notNull(),
  atualizadoEm: atualizadoEm(),
}).enableRLS()

export const TIPOS_IDENTIFICADOR = ['nb', 'protocolo_inss', 'cnj'] as const

/** Números do caso, só dígitos, com histórico: o caso aparece pelo NB ou protocolo no INSS e pelo CNJ na Justiça (GGVP-108 CA3). */
export const identificadorCaso = pgTable(
  'identificador_caso',
  {
    id: id(),
    casoId: uuid('caso_id')
      .notNull()
      .references(() => caso.id),
    tipo: text('tipo').notNull(),
    valor: text('valor').notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [unique('identificador_unico').on(t.tipo, t.valor), emLista('identificador_tipo', t.tipo, TIPOS_IDENTIFICADOR)],
).enableRLS()

export const CANAIS_ATENDIMENTO = ['presencial', 'telefone', 'whatsapp', 'video'] as const

/** Entrevista ou conversa registrada (GGVP-40, 76). Gravação só depois do aviso (G10). */
export const atendimento = pgTable(
  'atendimento',
  {
    id: id(),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    casoId: uuid('caso_id').references(() => caso.id),
    canal: text('canal').notNull(),
    responsavelId: uuid('responsavel_id').references(() => usuario.id),
    inicio: momento('inicio').notNull(),
    fim: momento('fim'),
    avisoGravacaoEm: momento('aviso_gravacao_em'),
    /** Gravação e transcrição são documentos (bucket privado). */
    gravacaoDocumentoId: uuid('gravacao_documento_id'),
    transcricaoDocumentoId: uuid('transcricao_documento_id'),
    resumo: text('resumo'),
    /**
     * A conversa do D5 no formato das telas (GGVP-138): com quem, o modo, a análise da IA, as decisões da conferência e
     * a pendência. A gravação fica em `gravacao_recepcao`, o mesmo motor da entrevista. ponytail: documento por enquanto.
     */
    dados: jsonb('dados'),
    criadoEm: criadoEm(),
  },
  (t) => [emLista('atendimento_canal', t.canal, CANAIS_ATENDIMENTO)],
).enableRLS()

/** Ficha de atendimento (GGVP-24, 28): respostas versionadas; a IA só muda o que foi dito, com o antigo no histórico (G14). */
export const fichaAtendimento = pgTable('ficha_atendimento', {
  id: id(),
  casoId: uuid('caso_id')
    .notNull()
    .references(() => caso.id),
  modelo: text('modelo').notNull(),
  versao: integer('versao').notNull().default(1),
  respostas: jsonb('respostas').notNull().default({}),
  preenchidaPor: text('preenchida_por').notNull(),
  criadoEm: criadoEm(),
}).enableRLS()

export const TIPOS_AGENDAMENTO = ['entrevista', 'ida_ao_banco', 'retirada', 'retorno'] as const
export const SITUACOES_AGENDAMENTO = ['marcado', 'confirmado', 'realizado', 'faltou', 'cancelado'] as const

export const agendamento = pgTable(
  'agendamento',
  {
    id: id(),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    casoId: uuid('caso_id').references(() => caso.id),
    tipo: text('tipo').notNull(),
    quando: momento('quando').notNull(),
    local: text('local'),
    /** Quem do escritório acompanha o cliente na ida ao banco, se alguém for (GGVP-44 CA10, ajuste do Mateus em 05/10). */
    acompanhanteId: uuid('acompanhante_id').references(() => usuario.id),
    situacao: text('situacao').notNull().default('marcado'),
    confirmadoEm: momento('confirmado_em'),
    criadoPor: uuid('criado_por').references(() => usuario.id),
    criadoEm: criadoEm(),
  },
  (t) => [emLista('agendamento_tipo', t.tipo, TIPOS_AGENDAMENTO), emLista('agendamento_situacao', t.situacao, SITUACOES_AGENDAMENTO)],
).enableRLS()
