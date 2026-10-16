// A base histórica do escritório (GGVP-163): o schema `conhecimento`, que o Lucas carrega e recarrega inteiro a cada
// leitura nova dos autos. O portal só lê, pelas cinco vistas `portal_*` e pela tabela `base`; nunca escreve nem migra
// (o `schemaFilter` do drizzle-kit fica em `public`, e este módulo não entra no `esquema.ts`). Sem o schema (a máquina do
// dev, os testes sem a base), quem lê confere antes e segue sem ele: `fluxo/conhecimento.ts`.
import { bigint, boolean, integer, jsonb, pgSchema, real, text } from 'drizzle-orm/pg-core'

export const conhecimento = pgSchema('conhecimento')

/** As marcas da carga: `data_da_base`, `carregado_em`, `raio_x`, `fontes` e `taxonomia_versao`. */
export const baseDoConhecimento = conhecimento.table('base', { chave: text('chave').primaryKey(), valor: text('valor') })

/** Um trecho anonimizado por fonte, na forma de `acervo_trecho` sem `caso_id` e sem `embedding`. */
export const portalTrecho = conhecimento
  .view('portal_trecho', {
    hash: text('hash').notNull(),
    origem: text('origem').notNull(),
    /** O CNJ do processo, ou a matéria na síntese. */
    referencia: text('referencia').notNull(),
    beneficio: text('beneficio'),
    texto: text('texto').notNull(),
    soJuridico: boolean('so_juridico').notNull(),
    tipo: text('tipo'),
    pagina: text('pagina'),
    pessoaId: text('pessoa_id'),
  })
  .existing()

/** O perito da base, com as grafias (um objeto grafia → vezes) e o perfil no formato de `perito.perfil`. */
export const portalPerito = conhecimento
  .view('portal_perito', {
    id: text('id').notNull(),
    nome: text('nome').notNull(),
    registro: text('registro'),
    especialidade: text('especialidade'),
    /** `medico` ou `social`. */
    tipo: text('tipo').notNull(),
    grafias: jsonb('grafias'),
    laudos: bigint('laudos', { mode: 'number' }).notNull(),
    favoraveis: bigint('favoraveis', { mode: 'number' }).notNull(),
    perfil: jsonb('perfil'),
  })
  .existing()

/** Um fundamento de sentença ou acórdão, no juízo do formato de `juizoDoCnj` ("TRF3 · 6301"). */
export const portalJuizoFundamento = conhecimento
  .view('portal_juizo_fundamento', {
    juizo: text('juizo').notNull(),
    vara: text('vara'),
    juiz: text('juiz'),
    beneficio: text('beneficio'),
    processo: text('processo').notNull(),
    desfecho: text('desfecho'),
    /** `fundamento` ou `acordao`. */
    tipo: text('tipo').notNull(),
    texto: text('texto').notNull(),
    pagina: text('pagina'),
  })
  .existing()

/** Uma taxa da base, com o número de casos (`n`) e quantos sim; `base_em` é a data da base, AAAA-MM-DD. */
export const portalIndicador = conhecimento
  .view('portal_indicador', {
    indicador: text('indicador').notNull(),
    beneficio: text('beneficio').notNull(),
    materia: text('materia'),
    /** `geral`, `ano`, `juiz`, `vara`, `relator`, `perito_medico`, `perito_social` ou `condicao`. */
    recorte: text('recorte'),
    chave: text('chave'),
    nome: text('nome'),
    n: integer('n').notNull(),
    sim: integer('sim'),
    valor: real('valor'),
    baseEm: text('base_em'),
  })
  .existing()

/** A síntese do benefício em Markdown, um bloco por ordem. */
export const portalSintese = conhecimento
  .view('portal_sintese', {
    beneficio: text('beneficio').notNull(),
    materia: text('materia'),
    ordem: bigint('ordem', { mode: 'number' }).notNull(),
    texto: text('texto').notNull(),
  })
  .existing()
