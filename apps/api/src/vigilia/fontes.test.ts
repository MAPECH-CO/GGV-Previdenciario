import { PGlite } from '@electric-sql/pglite'
import { validarCnj } from '@ggv/campos'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { describe, expect, it } from 'vitest'
import { pastaMigracoes } from '../banco/migrar.ts'
import { CNJ_EXEMPLO, fonteDeExemplo, fontesAtivas } from './fontes.ts'

describe('fontes da vigília', () => {
  it('sem configuração, roda só a fonte de exemplo', () => {
    expect(fontesAtivas({}).map((f) => f.nome)).toEqual(['exemplo'])
  })

  it('AASP e DJEN sem integração falham com o motivo (nunca devolvem lista vazia)', async () => {
    const [aasp] = fontesAtivas({ FONTES_PUBLICACAO: 'aasp' })
    await expect(aasp.buscar(new Date(), new Date())).rejects.toThrow('credencial ausente')
  })

  it('a fonte de exemplo traz as publicações do dia, com CNJ válidos', async () => {
    const lista = await fonteDeExemplo.buscar(new Date('2026-10-05T00:00:00Z'), new Date('2026-10-05T16:00:00Z'))
    expect(lista.map((p) => p.disponibilizadaEm)).toEqual(Array(6).fill('2026-10-05'))
    for (const cnj of Object.values(CNJ_EXEMPLO)) expect(validarCnj(cnj)).toBe(true)
    expect(lista.filter((p) => p.numeroCnj === null)).toHaveLength(1)
  })
})

describe('GGVP-30 CA3, CA8, CA10 · as fontes reais montadas pelo ambiente (grupo 4, decisão 48)', () => {
  /** Rede gravada: o DJEN e a AASP respondem vazio, e os pedidos ficam guardados. */
  function redeVazia() {
    const pedidos: URL[] = []
    const buscar = (async (entrada: string | URL | Request) => {
      const url = new URL(String(entrada))
      pedidos.push(url)
      const corpo = url.hostname.includes('aasp') ? { intimacoes: [], erro: false, status: 'Sucesso' } : { count: 0, items: [] }
      return new Response(JSON.stringify(corpo), { status: 200 })
    }) as typeof fetch
    return { pedidos, rede: { buscar, esperar: async () => {} } }
  }
  const dia = new Date('2026-10-06T20:00:00Z')

  it('o DJEN usa DJEN_OABS, a AASP usa AASP_CHAVES, e as duas olham TRF3 e TJSP se nada disser outra coisa', async () => {
    const { pedidos, rede } = redeVazia()
    const [djen, aasp] = fontesAtivas({ FONTES_PUBLICACAO: 'djen,aasp', DJEN_OABS: '123.456/sp', AASP_CHAVES: 'k1, k2' }, rede)
    await djen.buscar(dia, dia)
    await aasp.buscar(dia, dia)
    const doDjen = pedidos.filter((u) => u.hostname.includes('pje'))
    expect(doDjen.map((u) => [u.searchParams.get('numeroOab'), u.searchParams.get('ufOab'), u.searchParams.get('siglaTribunal')])).toEqual([
      ['123456', 'SP', 'TRF3'],
      ['123456', 'SP', 'TJSP'],
    ])
    expect(pedidos.filter((u) => u.hostname.includes('aasp')).map((u) => u.searchParams.get('chave'))).toEqual(['k1', 'k2'])
  })

  it('sem a variável, a fonte segue não ligada; configuração errada falha com o motivo, que avisa o suporte', async () => {
    const [semOab, semChave] = fontesAtivas({ FONTES_PUBLICACAO: 'djen,aasp' })
    await expect(semOab.buscar(dia, dia)).rejects.toThrow('credencial ausente')
    await expect(semChave.buscar(dia, dia)).rejects.toThrow('credencial ausente')
    const [oabSemUf] = fontesAtivas({ FONTES_PUBLICACAO: 'djen', DJEN_OABS: '123456' })
    await expect(oabSemUf.buscar(dia, dia)).rejects.toThrow('api: DJEN_OABS fora do formato')
    const [tribunalErrado] = fontesAtivas({ FONTES_PUBLICACAO: 'aasp', AASP_CHAVES: 'k1', VIGILIA_TRIBUNAIS: 'TRF3,TRT2' })
    await expect(tribunalErrado.buscar(dia, dia)).rejects.toThrow('api: tribunal que a vigília não conhece (TRT2)')
  })
})

describe('GGVP-30 CA10 · credenciais das fontes fora do código e do banco', () => {
  it('quais fontes rodam vem só do ambiente (.env local e Coolify)', () => {
    expect(fontesAtivas({ FONTES_PUBLICACAO: 'aasp, djen' }).map((f) => f.nome)).toEqual(['aasp', 'djen'])
  })

  it('o banco não tem coluna onde caiba credencial de fonte (o segredo no código, o gitleaks do CI barra)', async () => {
    const db = drizzle(new PGlite())
    await migrate(db, { migrationsFolder: pastaMigracoes })
    const { rows } = await db.execute<{ coluna: string }>(
      sql`select table_name || '.' || column_name as coluna from information_schema.columns where table_schema = 'public'`,
    )
    await db.$client.close()
    expect(rows.length).toBeGreaterThan(100)
    // `sessao.token_hash` é o hash do cookie de login (GGVP-117), não credencial de fonte.
    const suspeitas = rows.map((r) => r.coluna).filter((c) => /aasp|djen|token|api_?key|chave_api|segredo/.test(c) && c !== 'sessao.token_hash')
    expect(suspeitas).toEqual([])
  })
})
