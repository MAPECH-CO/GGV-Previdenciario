// A base histórica no portal (GGVP-163): a leitura das vistas `conhecimento.portal_*` e da data da base, tolerando a
// ausência do schema (a máquina do dev, os testes sem a base). Nada aqui grava: a base é do Lucas, e o portal só lê. Os
// números são contados em código (G19) e saem com o número de casos e a data da base (G22).
import { asc, eq, sql } from 'drizzle-orm'
import { ROTULO_BENEFICIO, nomeDoBeneficio, type BaseHistoricaDoBeneficio, type Beneficio, type FundamentosDoJuizo } from '@ggv/contratos'
import type { Banco } from '../banco/conexao.ts'
import { baseDoConhecimento, portalIndicador, portalJuizoFundamento, portalPerito, portalSintese, portalTrecho } from '../banco/conhecimento.ts'
import { NO_CATALOGO } from '../rotas/recepcao.ts'
import type { LaudoDoPerfil } from '../../../web/src/dados/peritos.ts'

/** PGlite e node-postgres devolvem `rows`; o tipo genérico do Drizzle não diz. */
const linhas = async <T>(banco: Banco, consulta: ReturnType<typeof sql>) => ((await banco.execute(consulta)) as unknown as { rows: T[] }).rows

/** R1: a base existe quando o schema e as vistas estão de pé; a cada pedido, sem cache (CA4). */
export async function temBaseHistorica(banco: Banco) {
  const [r] = await linhas<{ ok: boolean }>(
    banco,
    sql`select to_regclass('conhecimento.base') is not null and to_regclass('conhecimento.portal_trecho') is not null and to_regclass('conhecimento.portal_perito') is not null
        and to_regclass('conhecimento.portal_juizo_fundamento') is not null and to_regclass('conhecimento.portal_indicador') is not null and to_regclass('conhecimento.portal_sintese') is not null as ok`,
  )
  return !!r?.ok
}

export type BaseHistorica = { dataDaBase: string | null; carregadoEm: string | null; raioX: string | null }

/** As marcas da carga; nula sem a base. */
export async function baseHistorica(banco: Banco): Promise<BaseHistorica | null> {
  if (!(await temBaseHistorica(banco))) return null
  const marcas = await banco.select().from(baseDoConhecimento)
  const valor = (chave: string) => marcas.find((m) => m.chave === chave)?.valor ?? null
  return { dataDaBase: valor('data_da_base'), carregadoEm: valor('carregado_em'), raioX: valor('raio_x') }
}

/** "Dra. Ana Souza", "ANA SOUZA" e "ana souza" são a mesma: sem acento, sem caixa, sem pontuação e sem o título. */
export const nomeComparavel = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(?:dra?|doutora?|sra?) /, '')

type LaudoDaBase = { processo?: string; beneficio?: string | null; desfecho?: string | null; resultado?: string | null; conclusao?: string | null; o_que_pesou?: { fato?: string }[] | null }
type PerfilDaBase = { tipo?: string; onde?: string[]; laudos?: LaudoDaBase[] } | null

export type LaudosHistoricos = { nome: string; registro: string | null; laudosNaBase: number; favoraveisNaBase: number; laudos: LaudoDoPerfil[] }

/**
 * R2: os laudos históricos do perito, casando pelo nome, pelo nome normalizado ou por uma das grafias (as do portal e as
 * da base). Cada laudo vira um `LaudoDoPerfil` com a referência do processo (nunca o cliente), o benefício no catálogo
 * das telas e a marca `historico`, que deixa o laudo fora do tempo até o laudo, que a base não tem. Nulo sem par ou
 * sem a base.
 */
export async function laudosHistoricosDoPerito(banco: Banco, perito: { nome: string; nomeNormalizado?: string | null; grafias?: unknown }): Promise<LaudosHistoricos | null> {
  return (await historicoDosPeritos(banco, [{ id: 'um', ...perito }])).get('um') ?? null
}

type PeritoDoPortal = { id: string; nome: string; nomeNormalizado?: string | null; grafias?: unknown }

/** R2, para a lista: a base lida uma vez, e cada perito do portal com o seu par (quando há), pelo id. */
export async function historicoDosPeritos(banco: Banco, peritos: PeritoDoPortal[]): Promise<Map<string, LaudosHistoricos>> {
  const achados = new Map<string, LaudosHistoricos>()
  if (!peritos.length || !(await temBaseHistorica(banco))) return achados
  const base = await baseHistorica(banco)
  const todos = await banco.select().from(portalPerito)
  for (const perito of peritos) {
    const chaves = new Set([perito.nome, perito.nomeNormalizado ?? '', ...(Array.isArray(perito.grafias) ? (perito.grafias as string[]) : [])].map(nomeComparavel).filter(Boolean))
    const achado = chaves.size ? todos.find((p) => [p.nome, ...Object.keys((p.grafias as Record<string, number> | null) ?? {})].some((g) => chaves.has(nomeComparavel(g)))) : undefined
    if (!achado) continue
    const perfil = achado.perfil as PerfilDaBase
    const tipo = achado.tipo === 'social' ? 'social' : 'medica'
    const laudos: LaudoDoPerfil[] = (perfil?.laudos ?? []).flatMap((l) => {
      if (!l.processo) return []
      return [
        {
          id: `conhecimento:${l.processo}`,
          caso: l.processo,
          data: base?.dataDaBase ?? '',
          tipo,
          assunto: l.beneficio ? nomeDoBeneficio(l.beneficio) : 'sem benefício na base',
          beneficio: l.beneficio ? (NO_CATALOGO[l.beneficio] ?? l.beneficio) : undefined,
          resultado: l.resultado === 'favoravel' ? 'favoravel' : 'desfavoravel',
          dias: 0,
          historico: true,
          observou: (l.o_que_pesou ?? []).flatMap((x) => (x.fato ? [x.fato] : [])).slice(0, 3),
          perguntou: [],
          pediu: [],
        },
      ]
    })
    achados.set(perito.id, { nome: achado.nome, registro: achado.registro, laudosNaBase: achado.laudos, favoraveisNaBase: achado.favoraveis, laudos })
  }
  return achados
}

const EXEMPLOS_POR_GRUPO = 3

/** R3: os fundamentos históricos do juízo, contados em código: processos distintos, por tipo e benefício, com exemplos. */
export async function fundamentosDoJuizo(banco: Banco, juizo: string): Promise<FundamentosDoJuizo | null> {
  if (!(await temBaseHistorica(banco))) return null
  const rows = await banco.select().from(portalJuizoFundamento).where(eq(portalJuizoFundamento.juizo, juizo)).orderBy(asc(portalJuizoFundamento.processo))
  if (!rows.length) return { processos: 0, grupos: [] }
  const grupos = new Map<string, { tipo: string; beneficio: string; processos: Set<string>; exemplos: { processo: string; texto: string }[] }>()
  for (const r of rows) {
    const beneficio = r.beneficio ?? 'outro'
    const chave = `${r.tipo}|${beneficio}`
    const g = grupos.get(chave) ?? { tipo: r.tipo, beneficio, processos: new Set<string>(), exemplos: [] }
    if (!g.processos.has(r.processo) && g.exemplos.length < EXEMPLOS_POR_GRUPO) g.exemplos.push({ processo: r.processo, texto: r.texto })
    g.processos.add(r.processo)
    grupos.set(chave, g)
  }
  return {
    processos: new Set(rows.map((r) => r.processo)).size,
    grupos: [...grupos.values()]
      .map((g) => ({ tipo: g.tipo, beneficio: g.beneficio, nome: nomeDoBeneficio(g.beneficio), processos: g.processos.size, exemplos: g.exemplos }))
      .sort((a, b) => b.processos - a.processos || a.tipo.localeCompare(b.tipo) || a.nome.localeCompare(b.nome, 'pt-BR')),
  }
}

/** R3: os textos dos fundamentos do juízo para a IA ler junto com as decisões do portal, com o processo de cada um. */
export async function textosDosFundamentos(banco: Banco, juizo: string, limite: number) {
  if (!(await temBaseHistorica(banco))) return []
  return banco
    .select({ processo: portalJuizoFundamento.processo, tipo: portalJuizoFundamento.tipo, texto: portalJuizoFundamento.texto })
    .from(portalJuizoFundamento)
    .where(eq(portalJuizoFundamento.juizo, juizo))
    .orderBy(asc(portalJuizoFundamento.processo), asc(portalJuizoFundamento.tipo))
    .limit(limite)
}

/** R3: os juízos com fundamentos na base, para a rodada da IA ler os que ainda não têm entendimentos. */
export async function juizosComFundamentos(banco: Banco): Promise<string[]> {
  if (!(await temBaseHistorica(banco))) return []
  return (await banco.selectDistinct({ juizo: portalJuizoFundamento.juizo }).from(portalJuizoFundamento)).map((r) => r.juizo)
}

/** R4: os trechos da base, na forma de `acervo_trecho`, com a origem visível e o `hash` da vista (sem duplicar). */
export async function trechosHistoricos(banco: Banco) {
  if (!(await temBaseHistorica(banco))) return []
  return (await banco.select().from(portalTrecho)).map((t) => ({
    origem: `Base histórica · ${t.tipo ?? 'trecho'}`,
    referencia: /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(t.referencia) ? `processo:${t.referencia.replace(/\D/g, '')}` : `conhecimento:${t.referencia}`,
    beneficio: t.beneficio,
    texto: t.texto,
    soJuridico: t.soJuridico,
    hash: t.hash,
  }))
}

const ROTULO_INDICADOR: Record<string, string> = {
  exito_merito: 'Êxito no mérito',
  exito_decididos: 'Êxito nos decididos',
  extincao: 'Extinção sem mérito',
  laudo_favoravel: 'Laudo favorável',
  exito_com_laudo_favoravel: 'Êxito com laudo favorável',
  exito_com_laudo_desfavoravel: 'Êxito com laudo desfavorável',
  estudo_favoravel: 'Estudo social favorável',
  exito_com_estudo_favoravel: 'Êxito com estudo social favorável',
  exito_com_estudo_desfavoravel: 'Êxito com estudo social desfavorável',
  acompanhou_o_laudo: 'A sentença acompanhou o laudo',
  recurso_provido: 'Recurso provido',
  recurso_inss_provido: 'Recurso do INSS provido',
}
const ORDEM_DOS_INDICADORES = Object.keys(ROTULO_INDICADOR)
const RECORTES_DA_PAGINA = ['geral', 'ano']

/** R5: a página do benefício: a síntese na ordem e os indicadores do recorte geral e por ano. Sem a base, só o nome. */
export async function baseHistoricaDoBeneficio(banco: Banco, beneficio: string): Promise<BaseHistoricaDoBeneficio> {
  const nome = ROTULO_BENEFICIO[beneficio as Beneficio] ?? nomeDoBeneficio(beneficio)
  const base = await baseHistorica(banco)
  if (!base) return { beneficio, nome, dataDaBase: null, sintese: [], indicadores: [] }
  const sintese = await banco.select().from(portalSintese).where(eq(portalSintese.beneficio, beneficio)).orderBy(asc(portalSintese.ordem))
  const indicadores = (await banco.select().from(portalIndicador).where(eq(portalIndicador.beneficio, beneficio)))
    .filter((i) => RECORTES_DA_PAGINA.includes(i.recorte ?? ''))
    .map((i) => ({
      indicador: i.indicador,
      nome: `${ROTULO_INDICADOR[i.indicador] ?? i.indicador.replaceAll('_', ' ')}${i.recorte === 'ano' ? ` · ${i.chave ?? ''}` : ''}`,
      recorte: i.recorte ?? 'geral',
      chave: i.chave ?? '*',
      n: i.n,
      sim: i.sim,
      valor: i.valor,
      baseEm: i.baseEm,
    }))
    .sort(
      (a, b) =>
        RECORTES_DA_PAGINA.indexOf(a.recorte) - RECORTES_DA_PAGINA.indexOf(b.recorte) ||
        a.chave.localeCompare(b.chave) ||
        (ORDEM_DOS_INDICADORES.indexOf(a.indicador) + 1 || 99) - (ORDEM_DOS_INDICADORES.indexOf(b.indicador) + 1 || 99) ||
        a.indicador.localeCompare(b.indicador),
    )
  return { beneficio, nome, dataDaBase: base.dataDaBase, sintese: sintese.map((s) => ({ ordem: s.ordem, materia: s.materia, texto: s.texto })), indicadores }
}
