// Documentos, documentação médica e contrato (GGVP-17, 18, 20, 29, 33, 65, 69, 72, 77, 93, 95).
import { bigint, boolean, date, integer, jsonb, numeric, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core'
import { usuario } from './acesso.ts'
import { caso } from './casos.ts'
import { atualizadoEm, criadoEm, emLista, id, momento } from './comum.ts'
import { pessoa } from './pessoas.ts'

export const SITUACOES_DOCUMENTO = ['recebido', 'conferido', 'recusado'] as const

/**
 * Arquivo do cliente ou do caso. O arquivo mora no Supabase Storage, em bucket privado: aqui só a chave, o tipo,
 * o tamanho e o hash (integridade). `sensivel`: dado de saúde, só para os perfis do Jurídico (GGVP-96).
 */
export const documento = pgTable(
  'documento',
  {
    id: id(),
    pessoaId: uuid('pessoa_id').references(() => pessoa.id),
    casoId: uuid('caso_id').references(() => caso.id),
    tipo: text('tipo').notNull(),
    sensivel: boolean('sensivel').notNull().default(false),
    chaveArmazenamento: text('chave_armazenamento').notNull().unique(),
    nomeOriginal: text('nome_original').notNull(),
    mime: text('mime').notNull(),
    tamanho: bigint('tamanho', { mode: 'number' }).notNull(),
    hashSha256: text('hash_sha256').notNull(),
    origem: text('origem').notNull(),
    situacao: text('situacao').notNull().default('recebido'),
    recebidoPor: uuid('recebido_por').references(() => usuario.id),
    conferidoPor: uuid('conferido_por').references(() => usuario.id),
    conferidoEm: momento('conferido_em'),
    excluidoEm: momento('excluido_em'),
    /** O arquivo na pasta do cliente no Drive (GGVP-107 CA2): o id não muda quando alguém move o arquivo lá. */
    driveArquivoId: text('drive_arquivo_id'),
    /** Ainda vai para o Drive. O que existia antes da integração ficou fora (migração 0027). */
    drivePendente: boolean('drive_pendente').notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [emLista('documento_situacao', t.situacao, SITUACOES_DOCUMENTO)],
).enableRLS()

export const TIPOS_DOCUMENTO_MEDICO = ['atestado', 'relatorio', 'laudo', 'prontuario', 'exame'] as const

/** Dado de saúde: classificação de cada documento médico que entra (GGVP-95). Acesso registrado (LGPD). */
export const documentoMedico = pgTable(
  'documento_medico',
  {
    id: id(),
    documentoId: uuid('documento_id')
      .notNull()
      .unique()
      .references(() => documento.id),
    tipo: text('tipo').notNull(),
    dataEmissao: date('data_emissao'),
    profissional: text('profissional'),
    registroProfissional: text('registro_profissional'),
    cid: text('cid'),
    /** Itens do roteiro de conteúdo mínimo que o documento atende (GGVP-93). */
    itensAtendidos: jsonb('itens_atendidos').notNull().default([]),
    sugestaoIa: jsonb('sugestao_ia'),
    confirmadoPor: uuid('confirmado_por').references(() => usuario.id),
    confirmadoEm: momento('confirmado_em'),
    criadoEm: criadoEm(),
  },
  (t) => [emLista('documento_medico_tipo', t.tipo, TIPOS_DOCUMENTO_MEDICO)],
).enableRLS()

export const RESULTADOS_PARECER = ['suficiente', 'insuficiente', 'contraditorio', 'dispensado'] as const

/** Parecer de suficiência da documentação médica (G17, G18, GGVP-20). Só a Sênior dispensa, com justificativa. */
export const parecerMedico = pgTable(
  'parecer_medico',
  {
    id: id(),
    casoId: uuid('caso_id')
      .notNull()
      .references(() => caso.id),
    roteiroVersao: integer('roteiro_versao').notNull(),
    resultado: text('resultado').notNull(),
    itens: jsonb('itens').notNull().default([]),
    sugestaoIa: jsonb('sugestao_ia'),
    confirmadoPor: uuid('confirmado_por').references(() => usuario.id),
    confirmadoEm: momento('confirmado_em'),
    justificativaDispensa: text('justificativa_dispensa'),
    criadoEm: criadoEm(),
  },
  (t) => [emLista('parecer_resultado', t.resultado, RESULTADOS_PARECER)],
).enableRLS()

export const PARTES_DOCUMENTACAO_MEDICA = ['parecer', 'complemento', 'deficiencia', 'acidente', 'crianca'] as const

/**
 * A documentação médica do caso no formato das telas (GGVP-132): a análise e os registros do parecer, o complemento ao
 * médico, a linha do tempo da deficiência, a circunstância do acidente e a condição da criança. Dado de saúde: só a API
 * lê (RLS sem política), e só o Jurídico recebe o conteúdo. O que o resto do portal lê vai também para `parecer_medico`.
 * ponytail: um documento por parte; dividir em tabelas quando a IA de verdade (GGVP-134) assentar o formato.
 */
export const documentacaoMedica = pgTable(
  'documentacao_medica',
  {
    casoId: uuid('caso_id')
      .notNull()
      .references(() => caso.id),
    parte: text('parte').notNull(),
    documento: jsonb('documento').notNull(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [primaryKey({ columns: [t.casoId, t.parte] }), emLista('documentacao_medica_parte', t.parte, PARTES_DOCUMENTACAO_MEDICA)],
).enableRLS()

export const SITUACOES_CONTRATO = ['rascunho', 'conferido', 'enviado', 'assinado', 'cancelado'] as const

/** Contrato pelo modelo, conferido e assinado (digital pelo ZapSign ou em papel; GGVP-69, 72, 77). */
export const contrato = pgTable(
  'contrato',
  {
    id: id(),
    casoId: uuid('caso_id')
      .notNull()
      .references(() => caso.id),
    modeloId: uuid('modelo_id'),
    modeloVersao: integer('modelo_versao'),
    situacao: text('situacao').notNull().default('rascunho'),
    /** Percentual de honorários do contrato; a prestação de contas calcula com ele (GGVP-44 CA5). */
    percentualHonorarios: numeric('percentual_honorarios', { precision: 5, scale: 2 }),
    assinatura: text('assinatura'),
    zapsignId: text('zapsign_id').unique(),
    documentoId: uuid('documento_id').references(() => documento.id),
    conferidoPor: uuid('conferido_por').references(() => usuario.id),
    conferidoEm: momento('conferido_em'),
    assinadoEm: momento('assinado_em'),
    criadoEm: criadoEm(),
  },
  (t) => [emLista('contrato_situacao', t.situacao, SITUACOES_CONTRATO)],
).enableRLS()
