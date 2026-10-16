// O legado do portal antigo, parte 3: a carga no banco do portal novo (16/10, pedido do Mateus). Primeiro a limpeza:
// toda tabela de dados do `public` fica vazia, e ficam só os usuários (os logins de exemplo e os de verdade), as
// sessões, a configuração, os feriados, o glossário, os modelos, os kits, os roteiros e os registros que só crescem
// (`evento_auditoria`, `chamada_ia`, `acesso_dado_sensivel`, que o banco não deixa apagar). Depois a carga, em lotes,
// com `on conflict do nothing` (os ids são estáveis): rodar de novo não duplica. Por fim, o acervo do Raio-X ganha o
// caso de cada CNJ importado. Tudo numa transação: deu erro, nada muda.
import { sql } from 'drizzle-orm'
import type { Banco } from '../conexao.ts'
import type { Carga, CasoDaCarga, EventoDaCarga, IdentificadorDaCarga, PericiaDaCarga, PessoaDaCarga, ResultadoDaCarga } from './transformar.ts'

/** A variável que destrava a limpeza: sem ela, a carga recusa antes de tocar no banco. */
export const CONFIRMACAO = 'CONFIRMO_ZERAR_O_PORTAL'
export const MSG_SEM_CONFIRMACAO = `Recusado: a carga zera os dados do portal. Rode com ${CONFIRMACAO}=sim, e só na homologação.`

/** O que a limpeza não toca: quem entra, o que o escritório configurou e o que só cresce. */
export const TABELAS_QUE_FICAM = [
  'usuario',
  'sessao',
  'configuracao',
  'feriado',
  'glossario_termo',
  'modelo',
  'kit_documento',
  'roteiro_laudo',
  'rodada_vigilia',
  'evento_auditoria',
  'chamada_ia',
  'acesso_dado_sensivel',
] as const

/** As tabelas de dados do `public` que a limpeza esvazia: todas as do portal menos as que ficam (e nada fora do padrão). */
export async function tabelasParaLimpar(banco: Banco): Promise<string[]> {
  const rows = await linhas<{ nome: string }>(
    banco,
    sql`select table_name as nome from information_schema.tables
         where table_schema = 'public' and table_type = 'BASE TABLE' and table_name not like '\\_%'
         order by table_name`,
  )
  return rows.map((l) => l.nome).filter((n) => !(TABELAS_QUE_FICAM as readonly string[]).includes(n))
}

/** PGlite e node-postgres devolvem `rows`; o tipo genérico do Drizzle não diz. */
const linhas = async <T>(banco: Banco, consulta: ReturnType<typeof sql>) => ((await banco.execute(consulta)) as unknown as { rows: T[] }).rows

/** Liga o acervo do Raio-X aos casos importados, pelo CNJ. Roda de novo depois de cada importação do Raio-X. */
export async function ligarAcervo(banco: Banco): Promise<number> {
  await banco.execute(sql.raw(COMANDO_LIGAR_ACERVO))
  const [l] = await linhas<{ n: number | string }>(banco, sql`select count(*)::int as n from public.processo_acervo where caso_id is not null`)
  return Number(l?.n ?? 0)
}

export const COLUNAS = {
  pessoa: ['id', 'nome', 'cpf', 'data_nascimento', 'telefone', 'telefone_2', 'email', 'cep', 'logradouro', 'bairro', 'cidade', 'uf', 'situacao', 'origem', 'renda_por_pessoa', 'drive_pasta_id', 'criado_em', 'atualizado_em'],
  caso: ['id', 'pessoa_id', 'beneficio', 'fase', 'desfecho', 'encerrado_em', 'vara', 'valor_causa', 'criado_em', 'atualizado_em'],
  identificador_caso: ['id', 'caso_id', 'tipo', 'valor', 'criado_em'],
  resultado_inss: ['id', 'caso_id', 'resultado', 'data_decisao', 'criado_em'],
  pericia: ['id', 'caso_id', 'tipo', 'agendada_para', 'local', 'compareceu', 'resultado', 'documento', 'criado_em'],
  evento_auditoria: ['id', 'quem', 'acao', 'alvo', 'quando', 'detalhe'],
} as const
export type Tabela = keyof typeof COLUNAS

type Valor = string | number | boolean | null | Record<string, unknown>
const linhaDaPessoa = (p: PessoaDaCarga): Valor[] => [p.id, p.nome, p.cpf, p.dataNascimento, p.telefone, p.telefone2, p.email, p.cep, p.logradouro, p.bairro, p.cidade, p.uf, p.situacao, p.origem, p.rendaPorPessoa, p.drivePastaId, p.criadoEm, p.criadoEm]
const linhaDoCaso = (c: CasoDaCarga): Valor[] => [c.id, c.pessoaId, c.beneficio, c.fase, c.desfecho, c.encerradoEm, c.vara, c.valorCausa, c.criadoEm, c.atualizadoEm]
const linhaDoIdentificador = (i: IdentificadorDaCarga): Valor[] => [i.id, i.casoId, i.tipo, i.valor, i.criadoEm]
const linhaDoResultado = (x: ResultadoDaCarga): Valor[] => [x.id, x.casoId, x.resultado, x.dataDecisao, x.criadoEm]
const linhaDaPericia = (p: PericiaDaCarga): Valor[] => [p.id, p.casoId, p.tipo, p.agendadaPara, p.local, p.compareceu, p.resultado, p.documento, p.criadoEm]
const linhaDoEvento = (e: EventoDaCarga): Valor[] => [e.id, e.quem, e.acao, e.alvo, e.quando, e.detalhe]

/** As linhas de cada tabela, na ordem em que as chaves estrangeiras pedem. */
export function linhasDaCarga(carga: Carga): { tabela: Tabela; linhas: Valor[][] }[] {
  return [
    { tabela: 'pessoa', linhas: carga.pessoas.map(linhaDaPessoa) },
    { tabela: 'caso', linhas: carga.casos.map(linhaDoCaso) },
    { tabela: 'identificador_caso', linhas: carga.identificadores.map(linhaDoIdentificador) },
    { tabela: 'resultado_inss', linhas: carga.resultados.map(linhaDoResultado) },
    { tabela: 'pericia', linhas: carga.pericias.map(linhaDaPericia) },
    { tabela: 'evento_auditoria', linhas: carga.eventos.map(linhaDoEvento) },
  ]
}

/** Um valor como literal SQL: texto com aspas dobradas, objeto como jsonb, nulo como NULL. */
export function literal(v: Valor): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object') return `${literal(JSON.stringify(v))}::jsonb`
  return `'${v.replaceAll("'", "''")}'`
}

export const LOTE = 200

/** Os comandos da carga, em lotes: cada um é um `insert` com `on conflict do nothing`. Serve ao `carregar` e ao arquivo .sql. */
export function comandosDaCarga(carga: Carga, lote = LOTE): { tabela: Tabela; linhas: number; sql: string }[] {
  const comandos: { tabela: Tabela; linhas: number; sql: string }[] = []
  for (const { tabela, linhas } of linhasDaCarga(carga)) {
    for (let i = 0; i < linhas.length; i += lote) {
      const valores = linhas.slice(i, i + lote).map((l) => `(${l.map(literal).join(', ')})`)
      comandos.push({ tabela, linhas: valores.length, sql: `insert into public.${tabela} (${COLUNAS[tabela].join(', ')}) values\n${valores.join(',\n')}\non conflict do nothing` })
    }
  }
  return comandos
}

/** O acervo do Raio-X ganha o caso do CNJ importado (o Raio-X guarda só dígitos, como o identificador). */
export const COMANDO_LIGAR_ACERVO = `update public.processo_acervo a set caso_id = i.caso_id
  from public.identificador_caso i
 where i.tipo = 'cnj' and i.valor = a.numero_cnj and a.caso_id is null`

export const comandoDaLimpeza = (tabelas: string[]) => `truncate table ${tabelas.map((t) => `public.${t}`).join(', ')}`

/** O arquivo .sql inteiro, para quem prefere aplicar no terminal do banco: limpeza, carga e a ligação do acervo, numa transação. */
export function arquivoSql(carga: Carga, tabelas: string[]): string {
  return ['begin;', `${comandoDaLimpeza(tabelas)};`, ...comandosDaCarga(carga).map((c) => `${c.sql};`), `${COMANDO_LIGAR_ACERVO};`, 'commit;'].join('\n\n')
}

export type Resumo = { limpas: string[]; enviadas: Record<Tabela, number>; acervoLigado: number }

/**
 * Limpa e carrega, numa transação só. `ambiente[CONFIRMACAO]` precisa ser "sim". Devolve o que foi limpo, quantas
 * linhas foram enviadas por tabela e quantos processos do acervo ficaram ligados a um caso.
 */
export async function carregar(banco: Banco, carga: Carga, ambiente: Record<string, string | undefined> = process.env): Promise<Resumo> {
  if (ambiente[CONFIRMACAO] !== 'sim') throw new Error(MSG_SEM_CONFIRMACAO)
  return banco.transaction(async (tx) => {
    const limpas = await tabelasParaLimpar(tx)
    if (limpas.length) await tx.execute(sql.raw(comandoDaLimpeza(limpas)))
    const enviadas = { pessoa: 0, caso: 0, identificador_caso: 0, resultado_inss: 0, pericia: 0, evento_auditoria: 0 } satisfies Record<Tabela, number>
    for (const c of comandosDaCarga(carga)) {
      await tx.execute(sql.raw(c.sql))
      enviadas[c.tabela] += c.linhas
    }
    return { limpas, enviadas, acervoLigado: await ligarAcervo(tx) }
  })
}
