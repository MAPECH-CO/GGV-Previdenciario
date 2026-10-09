import { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as esquema from './esquema.ts'
import { pastaMigracoes } from './migrar.ts'

// Postgres em memória: roda na máquina e no CI sem Docker. Um banco para o arquivo todo.
const db = drizzle(new PGlite(), { schema: esquema })
beforeAll(() => migrate(db, { migrationsFolder: pastaMigracoes }))
afterAll(() => db.$client.close())

const tabelas = async () =>
  (
    await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    )
  ).rows.map((r) => r.table_name)

/** O banco recusa, e o motivo do Postgres (embrulhado pelo Drizzle em `cause`) bate com o esperado. */
async function recusa(consulta: ReturnType<typeof sql>, motivo: RegExp) {
  const erro = await db.execute(consulta).then(
    () => null,
    (e: Error & { cause?: Error }) => e,
  )
  expect(erro, 'o banco aceitou').not.toBeNull()
  expect(`${erro?.cause?.message ?? ''} ${erro?.message}`).toMatch(motivo)
}

describe('migrações', () => {
  it('criam as tabelas da base (GGVP-118, 117) e as do modelo de dados de todos os épicos', async () => {
    const t = await tabelas()
    for (const nome of ['caso', 'evento_auditoria', 'pessoa', 'sessao', 'tarefa', 'usuario']) expect(t).toContain(nome)
    for (const nome of ['identificador_caso', 'etapa', 'decisao', 'documento', 'documento_medico', 'parecer_medico',
      'requerimento_inss', 'exigencia_item', 'pericia', 'publicacao', 'rodada_vigilia', 'peticao_versao',
      'prestacao_contas', 'processo_acervo', 'credencial_govbr', 'consentimento', 'configuracao', 'ficha_recepcao', 'tarefa_recepcao', 'compromisso_interno', 'gravacao_recepcao', 'segunda_ficha_medica', 'contrato_recepcao', 'leitura_documento',
      'publicacao_descarte', 'publicacao_reclassificacao', 'chamada_ia', 'versao_campo', 'dado_bancario', 'glossario_termo']) expect(t).toContain(nome)
    expect(t).toContain('documentacao_medica')
    expect(t).toHaveLength(57)
  })

  it('toda tabela tem RLS ligado: no Supabase, a chave pública não lê nada (GGVP-119)', async () => {
    const { rows } = await db.execute<{ relname: string }>(
      sql`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    )
    expect(rows.map((r) => r.relname)).toEqual([])
  })
})

describe('confiança dos dados', () => {
  it('o histórico só cresce: update e delete são recusados', async () => {
    await db.execute(sql`insert into evento_auditoria (quem, acao, alvo) values ('teste', 'login', 'sessao')`)
    await recusa(sql`update evento_auditoria set acao = 'outra'`, /não pode ser alterado/)
    await recusa(sql`delete from evento_auditoria`, /não pode ser alterado/)
  })

  it('o registro de acesso a dado de saúde também só cresce (GGVP-129 CA3)', async () => {
    const [{ id: u }] = (
      await db.execute<{ id: string }>(sql`insert into usuario (email, nome, senha_hash) values ('jur@exemplo.ggv', 'Jur', 'x') returning id`)
    ).rows
    await db.execute(sql`insert into acesso_dado_sensivel (usuario_id, perfil, recurso) values (${u}, 'advogada', 'documento:x')`)
    await recusa(sql`update acesso_dado_sensivel set perfil = 'senior'`, /não pode ser alterado/)
    await recusa(sql`delete from acesso_dado_sensivel`, /não pode ser alterado/)
  })

  it('estado fora da lista é recusado pelo banco', async () => {
    await recusa(sql`insert into pessoa (nome, situacao) values ('Ana', 'inventado')`, /pessoa_situacao/)
  })

  it('a exigência aceita a origem do despacho da Sênior (GGVP-54) e recusa outra', async () => {
    const [{ id: pessoaId }] = (await db.execute<{ id: string }>(sql`insert into pessoa (nome) values ('Caio') returning id`)).rows
    const [{ id: casoId }] = (await db.execute<{ id: string }>(sql`insert into caso (pessoa_id) values (${pessoaId}) returning id`)).rows
    await db.execute(sql`insert into exigencia (caso_id, origem, descricao, recebida_em) values (${casoId}, 'despacho', 'Laudo', '2026-10-07')`)
    await recusa(sql`insert into exigencia (caso_id, origem, descricao, recebida_em) values (${casoId}, 'outra', 'Laudo', '2026-10-07')`, /exigencia_origem/)
  })

  it('CPF repetido não cria outra pessoa', async () => {
    await db.execute(sql`insert into pessoa (nome, cpf) values ('Ana', '52998224725')`)
    await recusa(sql`insert into pessoa (nome, cpf) values ('Outra', '52998224725')`, /unique|duplicate/i)
  })

  it('o mesmo número de processo não vai para dois casos', async () => {
    const [{ id: pessoaId }] = (await db.execute<{ id: string }>(sql`insert into pessoa (nome) values ('Bia') returning id`)).rows
    const [{ id: a }] = (await db.execute<{ id: string }>(sql`insert into caso (pessoa_id) values (${pessoaId}) returning id`)).rows
    const [{ id: b }] = (await db.execute<{ id: string }>(sql`insert into caso (pessoa_id) values (${pessoaId}) returning id`)).rows
    await db.execute(sql`insert into identificador_caso (caso_id, tipo, valor) values (${a}, 'cnj', '00000000020248260001')`)
    await recusa(sql`insert into identificador_caso (caso_id, tipo, valor) values (${b}, 'cnj', '00000000020248260001')`, /identificador_unico|unique|duplicate/i)
  })

  it('prestação: quem dá o OK não registra o recebimento, e o aviso só vem depois do OK (G8)', async () => {
    const [{ id: pessoaId }] = (await db.execute<{ id: string }>(sql`insert into pessoa (nome) values ('Caio') returning id`)).rows
    const [{ id: casoId }] = (await db.execute<{ id: string }>(sql`insert into caso (pessoa_id) values (${pessoaId}) returning id`)).rows
    const [{ id: u }] = (
      await db.execute<{ id: string }>(sql`insert into usuario (email, nome, senha_hash) values ('adv@exemplo.ggv', 'Adv', 'x') returning id`)
    ).rows
    await recusa(
      sql`insert into prestacao_contas (caso_id, valor_recebido, honorarios, valor_cliente, ok_advogada_por, ok_advogada_em, recebida_por)
          values (${casoId}, 1000, 300, 700, ${u}, now(), ${u})`,
      /prestacao_pessoas_diferentes/,
    )
    await recusa(
      sql`insert into prestacao_contas (caso_id, valor_recebido, honorarios, valor_cliente, cliente_avisado_em)
          values (${casoId}, 1000, 300, 700, now())`,
      /prestacao_aviso_depois_do_ok/,
    )
  })

  it('prestação: com o OK já dado, quem deu o OK não registra o recebimento depois; outra pessoa registra (GGVP-96 CA16)', async () => {
    const [{ id: pessoaId }] = (await db.execute<{ id: string }>(sql`insert into pessoa (nome) values ('Dora') returning id`)).rows
    const [{ id: casoId }] = (await db.execute<{ id: string }>(sql`insert into caso (pessoa_id) values (${pessoaId}) returning id`)).rows
    const [{ id: adv }, { id: fin }] = (
      await db.execute<{ id: string }>(
        sql`insert into usuario (email, nome, senha_hash) values ('adv2@exemplo.ggv', 'Adv', 'x'), ('fin@exemplo.ggv', 'Fin', 'x') returning id`,
      )
    ).rows
    const [{ id }] = (
      await db.execute<{ id: string }>(
        sql`insert into prestacao_contas (caso_id, valor_recebido, honorarios, valor_cliente, ok_advogada_por, ok_advogada_em)
            values (${casoId}, 1000, 300, 700, ${adv}, now()) returning id`,
      )
    ).rows
    await recusa(sql`update prestacao_contas set recebida_por = ${adv}, recebida_em = now() where id = ${id}`, /prestacao_pessoas_diferentes/)
    await db.execute(sql`update prestacao_contas set recebida_por = ${fin}, recebida_em = now() where id = ${id}`)
  })
})
