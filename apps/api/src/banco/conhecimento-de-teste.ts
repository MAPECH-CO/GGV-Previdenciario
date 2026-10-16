// A base histórica nos testes (GGVP-163): o PGlite ganha o schema `conhecimento` com tabelas da forma das vistas, carregadas
// com dados inventados. Nenhum nome é real; os números dos critérios de aceite da história saem daqui.
import { sql, type SQL } from 'drizzle-orm'
import type { Banco } from './conexao.ts'

export type PeritoDeTeste = {
  id: string
  nome: string
  registro: string | null
  especialidade: string | null
  tipo: 'medico' | 'social'
  grafias: Record<string, number>
  perfil: { tipo: string; onde: string[]; laudos: LaudoDeTeste[] }
}
export type LaudoDeTeste = { processo: string; beneficio: string; desfecho: string; resultado: string; conclusao: string; o_que_pesou: { fato: string; pagina: string }[] }
export type FundamentoDeTeste = { juizo: string; vara: string | null; juiz: string | null; beneficio: string; processo: string; desfecho: string; tipo: 'fundamento' | 'acordao'; texto: string; pagina: string | null }
export type TrechoDeTeste = { hash: string; origem: string; referencia: string; beneficio: string; texto: string; soJuridico: boolean; tipo: string; pagina: string | null; pessoaId: string | null }
export type IndicadorDeTeste = { indicador: string; beneficio: string; materia: string; recorte: string; chave: string; nome: string; n: number; sim: number | null; valor: number | null; baseEm: string }
export type SinteseDeTeste = { beneficio: string; materia: string; ordem: number; texto: string }
export type ConhecimentoDeTeste = {
  base: Record<string, string>
  peritos: PeritoDeTeste[]
  fundamentos: FundamentoDeTeste[]
  trechos: TrechoDeTeste[]
  indicadores: IndicadorDeTeste[]
  sinteses: SinteseDeTeste[]
}

/** Um número CNJ inventado do juízo 6301 (formato NNNNNNN-DD.AAAA.J.TR.OOOO), um por índice. */
export const cnjDeTeste = (i: number, ano = 2024, origem = '6301') => `${String(5000000 + i).padStart(7, '0')}-11.${ano}.4.03.${origem}`

const laudosDeTeste = (quantos: number, favoraveis: number, beneficio: string): LaudoDeTeste[] =>
  Array.from({ length: quantos }, (_, i) => ({
    processo: cnjDeTeste(100 + i, 2023 + (i % 3)),
    beneficio,
    desfecho: i < favoraveis ? 'procedente_total' : 'improcedente',
    resultado: i < favoraveis ? 'favoravel' : 'desfavoravel',
    conclusao: i < favoraveis ? 'Impedimento de longo prazo caracterizado.' : 'Não há elementos para considerar impedimento de longo prazo.',
    o_que_pesou: [{ fato: i < favoraveis ? 'rotina relatada e documentos médicos coerentes' : 'exame físico sem limitação funcional', pagina: String(40 + i) }],
  }))

/** O juízo "TRF3 · 6301" com 552 processos (CA2): 132 deles com acórdão também; mais um juízo pequeno. */
function fundamentosDeTeste(): FundamentoDeTeste[] {
  const beneficios = ['bpc_loas_deficiente', 'bpc_loas_idoso', 'auxilio_incapacidade_temporaria']
  const desfechos = ['improcedente', 'extinto_sem_merito', 'procedente_total', 'acordo']
  const do6301 = Array.from({ length: 552 }, (_, i) => ({
    juizo: 'TRF3 · 6301',
    vara: '10ª Vara Gabinete JEF de São Paulo',
    juiz: 'Juíza de Teste',
    beneficio: beneficios[i % 3],
    processo: cnjDeTeste(i, 2022 + (i % 4)),
    desfecho: desfechos[i % 4],
    tipo: 'fundamento' as const,
    texto: `Fundamento de teste ${i + 1}: a renda per capita do grupo familiar foi apurada conforme a prova dos autos.`,
    pagina: String(100 + i),
  }))
  const acordaos = do6301.slice(0, 132).map((f) => ({ ...f, tipo: 'acordao' as const, texto: `Acórdão de teste: ${f.texto}`, pagina: null }))
  const do6100 = Array.from({ length: 3 }, (_, i) => ({ ...do6301[i], juizo: 'TRF3 · 6100', vara: '1ª Vara Federal de Teste', processo: cnjDeTeste(900 + i, 2024, '6100') }))
  return [...do6301, ...acordaos, ...do6100]
}

/** Os dados padrão: um perito de registro 190895 com 38 laudos e 11 favoráveis (CA1), o 6301 (CA2) e o LOAS deficiente (CA3). */
export const CONHECIMENTO_DE_TESTE: ConhecimentoDeTeste = {
  base: { data_da_base: '2026-10-16', carregado_em: '2026-10-16T17:47:04.438Z', raio_x: '21/09/2026', fontes: 'conferido > leitura > regra > raio_x > cadastro', taxonomia_versao: '1' },
  peritos: [
    {
      id: 'perito_medico:reg-190895',
      nome: 'HELIO DE TAL PERITO',
      registro: '190895',
      especialidade: 'ortopedia',
      tipo: 'medico',
      grafias: { 'Helio de Tal Perito': 30, 'Dr. Helio de Tal Perito': 5, 'Helio Perito': 1, 'HELIO DE TAL PERITO, CRM-SP 190.895': 2 },
      perfil: { tipo: 'medico', onde: ['10ª Vara Gabinete JEF de São Paulo'], laudos: laudosDeTeste(38, 11, 'bpc_loas_deficiente') },
    },
    {
      id: 'perito_social:reg-12345',
      nome: 'MARIA SOCIAL DE TESTE',
      registro: 'CRESS 12345',
      especialidade: null,
      tipo: 'social',
      grafias: { 'Maria Social de Teste': 4 },
      perfil: { tipo: 'social', onde: ['1ª Vara Gabinete JEF de Mauá'], laudos: laudosDeTeste(5, 4, 'bpc_loas_idoso') },
    },
  ],
  fundamentos: fundamentosDeTeste(),
  trechos: [
    {
      hash: 'a1'.repeat(32),
      origem: 'conhecimento:fundamento',
      referencia: cnjDeTeste(7, 2024),
      beneficio: 'bpc_loas_deficiente',
      texto: 'A renda per capita do grupo familiar superou um quarto do salário mínimo, e o estudo social não demonstrou vulnerabilidade.',
      soJuridico: false,
      tipo: 'fundamento',
      pagina: '210',
      pessoaId: null,
    },
    {
      hash: 'b2'.repeat(32),
      origem: 'conhecimento:laudo',
      referencia: cnjDeTeste(7, 2024),
      beneficio: 'bpc_loas_deficiente',
      texto: 'O laudo concluiu por impedimento de longo prazo de natureza mental, com limitação para o trabalho.',
      soJuridico: true,
      tipo: 'laudo',
      pagina: '98',
      pessoaId: 'perito_medico:reg-190895',
    },
    {
      hash: 'c3'.repeat(32),
      origem: 'conhecimento:licao',
      referencia: cnjDeTeste(8, 2023),
      beneficio: 'bpc_loas_idoso',
      texto: 'Juntar o CadÚnico atualizado antes da inicial evita a extinção por falta de documento.',
      soJuridico: false,
      tipo: 'licao',
      pagina: null,
      pessoaId: null,
    },
    {
      hash: 'd4'.repeat(32),
      origem: 'conhecimento:conhecimento',
      referencia: 'bpc_loas_deficiente',
      beneficio: 'bpc_loas_deficiente',
      texto: 'LOAS deficiente: a perícia médica decide; o estudo social raramente derruba um laudo favorável.',
      soJuridico: false,
      tipo: 'conhecimento',
      pagina: null,
      pessoaId: null,
    },
  ],
  indicadores: [
    { indicador: 'exito_merito', beneficio: 'bpc_loas_deficiente', materia: 'bpc_loas_deficiente', recorte: 'geral', chave: '*', nome: '', n: 192, sim: 63, valor: 0.328, baseEm: '2026-10-16' },
    { indicador: 'exito_com_laudo_desfavoravel', beneficio: 'bpc_loas_deficiente', materia: 'bpc_loas_deficiente', recorte: 'geral', chave: '*', nome: '', n: 115, sim: 4, valor: 0.035, baseEm: '2026-10-16' },
    { indicador: 'exito_com_laudo_favoravel', beneficio: 'bpc_loas_deficiente', materia: 'bpc_loas_deficiente', recorte: 'geral', chave: '*', nome: '', n: 72, sim: 55, valor: 0.764, baseEm: '2026-10-16' },
    { indicador: 'extincao', beneficio: 'bpc_loas_deficiente', materia: 'bpc_loas_deficiente', recorte: 'geral', chave: '*', nome: '', n: 351, sim: 159, valor: 0.453, baseEm: '2026-10-16' },
    { indicador: 'exito_merito', beneficio: 'bpc_loas_deficiente', materia: 'bpc_loas_deficiente', recorte: 'ano', chave: '2023', nome: '2023', n: 80, sim: 20, valor: 0.25, baseEm: '2026-10-16' },
    { indicador: 'exito_merito', beneficio: 'bpc_loas_deficiente', materia: 'bpc_loas_deficiente', recorte: 'juiz', chave: 'juiz:teste', nome: 'Juíza de Teste', n: 30, sim: 10, valor: 0.333, baseEm: '2026-10-16' },
    { indicador: 'exito_merito', beneficio: 'bpc_loas_idoso', materia: 'bpc_loas_idoso', recorte: 'geral', chave: '*', nome: '', n: 81, sim: 31, valor: 0.383, baseEm: '2026-10-16' },
  ],
  sinteses: [
    { beneficio: 'bpc_loas_deficiente', materia: 'bpc_loas_deficiente', ordem: 1, texto: 'LOAS deficiente — O retrato:\n- **Metade morreu antes do mérito:** 159 extintos sem mérito.\n- Quase sempre por falha nossa.' },
    { beneficio: 'bpc_loas_deficiente', materia: 'bpc_loas_deficiente', ordem: 2, texto: 'LOAS deficiente — O que decide o mérito:\n- **A perícia médica decide.** Laudo favorável: 55 de 72. Laudo desfavorável: 4 de 115.' },
    { beneficio: 'bpc_loas_idoso', materia: 'bpc_loas_idoso', ordem: 1, texto: 'LOAS idoso — O estudo social decide.' },
  ],
}

const DDL = `
create schema if not exists conhecimento;
create table if not exists conhecimento.base (chave text primary key, valor text);
create table if not exists conhecimento.portal_trecho (hash text not null, origem text not null, referencia text not null, beneficio text, texto text not null, so_juridico boolean not null, tipo text, pagina text, pessoa_id text);
create table if not exists conhecimento.portal_perito (id text not null, nome text not null, registro text, especialidade text, tipo text not null, grafias jsonb, laudos bigint not null, favoraveis bigint not null, perfil jsonb);
create table if not exists conhecimento.portal_juizo_fundamento (juizo text not null, vara text, juiz text, beneficio text, processo text not null, desfecho text, tipo text not null, texto text not null, pagina text);
create table if not exists conhecimento.portal_indicador (indicador text not null, beneficio text not null, materia text, recorte text, chave text, nome text, n integer not null, sim integer, valor real, base_em text);
create table if not exists conhecimento.portal_sintese (beneficio text not null, materia text, ordem bigint not null, texto text not null);
`

const linhas = (valores: SQL[][]) => sql.join(valores.map((v) => sql`(${sql.join(v, sql`, `)})`), sql`, `)
const json = (v: unknown) => sql`${JSON.stringify(v)}::jsonb`

/** Instala o schema no banco embutido e carrega os dados; chamar de novo zera e recarrega. */
export async function instalarConhecimentoDeTeste(banco: Banco, dados: ConhecimentoDeTeste = CONHECIMENTO_DE_TESTE) {
  for (const comando of DDL.split(';').map((c) => c.trim()).filter(Boolean)) await banco.execute(sql.raw(comando))
  for (const t of ['base', 'portal_trecho', 'portal_perito', 'portal_juizo_fundamento', 'portal_indicador', 'portal_sintese']) await banco.execute(sql.raw(`delete from conhecimento.${t}`))
  await banco.execute(sql`insert into conhecimento.base (chave, valor) values ${linhas(Object.entries(dados.base).map(([c, v]) => [sql`${c}`, sql`${v}`]))}`)
  if (dados.peritos.length)
    await banco.execute(
      sql`insert into conhecimento.portal_perito (id, nome, registro, especialidade, tipo, grafias, laudos, favoraveis, perfil) values ${linhas(
        dados.peritos.map((p) => [
          sql`${p.id}`,
          sql`${p.nome}`,
          sql`${p.registro}`,
          sql`${p.especialidade}`,
          sql`${p.tipo}`,
          json(p.grafias),
          sql`${p.perfil.laudos.length}`,
          sql`${p.perfil.laudos.filter((l) => l.resultado === 'favoravel').length}`,
          json(p.perfil),
        ]),
      )}`,
    )
  for (let i = 0; i < dados.fundamentos.length; i += 200)
    await banco.execute(
      sql`insert into conhecimento.portal_juizo_fundamento (juizo, vara, juiz, beneficio, processo, desfecho, tipo, texto, pagina) values ${linhas(
        dados.fundamentos.slice(i, i + 200).map((f) => [sql`${f.juizo}`, sql`${f.vara}`, sql`${f.juiz}`, sql`${f.beneficio}`, sql`${f.processo}`, sql`${f.desfecho}`, sql`${f.tipo}`, sql`${f.texto}`, sql`${f.pagina}`]),
      )}`,
    )
  if (dados.trechos.length)
    await banco.execute(
      sql`insert into conhecimento.portal_trecho (hash, origem, referencia, beneficio, texto, so_juridico, tipo, pagina, pessoa_id) values ${linhas(
        dados.trechos.map((t) => [sql`${t.hash}`, sql`${t.origem}`, sql`${t.referencia}`, sql`${t.beneficio}`, sql`${t.texto}`, sql`${t.soJuridico}`, sql`${t.tipo}`, sql`${t.pagina}`, sql`${t.pessoaId}`]),
      )}`,
    )
  if (dados.indicadores.length)
    await banco.execute(
      sql`insert into conhecimento.portal_indicador (indicador, beneficio, materia, recorte, chave, nome, n, sim, valor, base_em) values ${linhas(
        dados.indicadores.map((x) => [sql`${x.indicador}`, sql`${x.beneficio}`, sql`${x.materia}`, sql`${x.recorte}`, sql`${x.chave}`, sql`${x.nome}`, sql`${x.n}`, sql`${x.sim}`, sql`${x.valor}`, sql`${x.baseEm}`]),
      )}`,
    )
  if (dados.sinteses.length)
    await banco.execute(
      sql`insert into conhecimento.portal_sintese (beneficio, materia, ordem, texto) values ${linhas(dados.sinteses.map((s) => [sql`${s.beneficio}`, sql`${s.materia}`, sql`${s.ordem}`, sql`${s.texto}`]))}`,
    )
}

/** CA4: a base recarregada inteira, com data nova; as vistas continuam de pé. */
export async function recarregarBaseDeTeste(banco: Banco, dataDaBase: string) {
  await banco.execute(sql`update conhecimento.base set valor = ${dataDaBase} where chave = 'data_da_base'`)
  await banco.execute(sql`update conhecimento.portal_indicador set base_em = ${dataDaBase}`)
}
