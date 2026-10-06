// Via administrativa no INSS e perícia (GGVP-23, 27, 31, 35, 39, 44, 48, 49, 53, 56, 61, 62, 66, 68, 70).
import { boolean, date, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { usuario } from './acesso.ts'
import { caso } from './casos.ts'
import { criadoEm, emLista, id, momento } from './comum.ts'
import { documento } from './documentos.ts'
import { etapa } from './fluxo.ts'

/** Protocolo no Meu INSS (GGVP-27): número, DER e comprovante obrigatórios; só depois do OK da Sênior (G2). */
export const requerimentoInss = pgTable('requerimento_inss', {
  id: id(),
  casoId: uuid('caso_id')
    .notNull()
    .references(() => caso.id),
  numero: text('numero').notNull().unique(),
  der: date('der').notNull(),
  servico: text('servico'),
  comprovanteDocumentoId: uuid('comprovante_documento_id')
    .notNull()
    .references(() => documento.id),
  revisadoAntesDeEnviar: boolean('revisado_antes_de_enviar').notNull(),
  registradoPor: uuid('registrado_por')
    .notNull()
    .references(() => usuario.id),
  criadoEm: criadoEm(),
}).enableRLS()

export const ORIGENS_EXIGENCIA = ['inss', 'juizo'] as const
export const SITUACOES_EXIGENCIA = ['aberta', 'cumprida', 'vencida', 'dilacao_pedida'] as const
/** O que a exigência pede, decidido pela advogada (GGVP-39 CA8, G5). */
export const PEDIDOS_EXIGENCIA = ['documentos', 'pericia', 'pericia_e_documentos'] as const
export const SITUACOES_ITEM_EXIGENCIA = ['pendente', 'cumprido', 'nao_cumprido'] as const

/** Exigência do INSS ou do juízo (G21): vira itens com prazo, responsável e prova. */
export const exigencia = pgTable(
  'exigencia',
  {
    id: id(),
    casoId: uuid('caso_id')
      .notNull()
      .references(() => caso.id),
    origem: text('origem').notNull(),
    descricao: text('descricao').notNull(),
    recebidaEm: date('recebida_em').notNull(),
    prazo: date('prazo'),
    /** Dias que o INSS deu, como estão na comunicação; o prazo é contado em código (GGVP-39 CA7). */
    diasInss: integer('dias_inss'),
    pede: text('pede'),
    publicacaoId: uuid('publicacao_id'),
    situacao: text('situacao').notNull().default('aberta'),
    analisadaPor: uuid('analisada_por').references(() => usuario.id),
    criadoEm: criadoEm(),
  },
  (t) => [
    emLista('exigencia_origem', t.origem, ORIGENS_EXIGENCIA),
    emLista('exigencia_situacao', t.situacao, SITUACOES_EXIGENCIA),
    emLista('exigencia_pede', t.pede, PEDIDOS_EXIGENCIA),
  ],
).enableRLS()

export const exigenciaItem = pgTable(
  'exigencia_item',
  {
    id: id(),
    exigenciaId: uuid('exigencia_id')
      .notNull()
      .references(() => exigencia.id),
    descricao: text('descricao').notNull(),
    perfilResponsavel: text('perfil_responsavel').notNull(),
    responsavelId: uuid('responsavel_id').references(() => usuario.id),
    prazo: date('prazo'),
    /** O que o setor deve trazer como prova (GGVP-79 CA13) e a tarefa do setor que cumpre o item (GGVP-83). */
    provaEsperada: text('prova_esperada'),
    tarefaId: uuid('tarefa_id'),
    situacao: text('situacao').notNull().default('pendente'),
    /** Por que não foi cumprido (GGVP-39 CA11). */
    motivo: text('motivo'),
    provaDocumentoId: uuid('prova_documento_id').references(() => documento.id),
    cumpridoEm: momento('cumprido_em'),
    cumpridoPor: uuid('cumprido_por').references(() => usuario.id),
  },
  (t) => [emLista('exigencia_item_situacao', t.situacao, SITUACOES_ITEM_EXIGENCIA)],
).enableRLS()

export const TIPOS_PERICIA = ['medica', 'social'] as const
export const RESULTADOS_PERICIA = ['favoravel', 'desfavoravel'] as const

/** Perícia como subprocesso (DP): quem pediu, marcação, comparecimento, remarcações e resultado. Resultado é dado de saúde. */
export const pericia = pgTable(
  'pericia',
  {
    id: id(),
    casoId: uuid('caso_id')
      .notNull()
      .references(() => caso.id),
    tipo: text('tipo').notNull(),
    chamadaPorEtapaId: uuid('chamada_por_etapa_id').references(() => etapa.id),
    agendadaPara: momento('agendada_para'),
    local: text('local'),
    comprovanteDocumentoId: uuid('comprovante_documento_id').references(() => documento.id),
    peritoId: uuid('perito_id'),
    compareceu: boolean('compareceu'),
    remarcacoes: integer('remarcacoes').notNull().default(0),
    resultado: text('resultado'),
    resultadoDocumentoId: uuid('resultado_documento_id').references(() => documento.id),
    criadoEm: criadoEm(),
  },
  (t) => [emLista('pericia_tipo', t.tipo, TIPOS_PERICIA), emLista('pericia_resultado', t.resultado, RESULTADOS_PERICIA)],
).enableRLS()

export const RESULTADOS_INSS = ['deferido', 'indeferido'] as const

/** Decisão do INSS (GGVP-35, 44, 48, 52): o motivo do indeferimento alimenta o banco de motivos. */
export const resultadoInss = pgTable(
  'resultado_inss',
  {
    id: id(),
    casoId: uuid('caso_id')
      .notNull()
      .references(() => caso.id),
    resultado: text('resultado').notNull(),
    dataDecisao: date('data_decisao').notNull(),
    beneficioConcedido: text('beneficio_concedido'),
    motivoIndeferimento: text('motivo_indeferimento'),
    documentoId: uuid('documento_id').references(() => documento.id),
    registradoPor: uuid('registrado_por').references(() => usuario.id),
    criadoEm: criadoEm(),
  },
  (t) => [emLista('resultado_inss_resultado', t.resultado, RESULTADOS_INSS)],
).enableRLS()
