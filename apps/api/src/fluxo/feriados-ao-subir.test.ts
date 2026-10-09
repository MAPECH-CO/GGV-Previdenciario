import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { eventoAuditoria, feriado } from '../banco/esquema.ts'
import { feriadosDaLei } from './feriados.ts'
import { carregarFeriadosSeVazio } from './feriados-ao-subir.ts'

let banco: Banco
let fechar: () => Promise<void>
const AGORA = new Date('2026-10-09T09:00:00Z')

beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
})
afterEach(() => fechar())

describe('P17 · os feriados da lei ao subir a API', () => {
  it('com a tabela vazia, carrega os de 2026 e 2027 e grava no histórico', async () => {
    const esperados = feriadosDaLei(2026).length + feriadosDaLei(2027).length
    expect(await carregarFeriadosSeVazio(banco, AGORA)).toBe(esperados)
    expect(await banco.select().from(feriado)).toHaveLength(esperados)
    const [ev] = await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'feriados_carregados'))
    expect([ev.quem, ev.detalhe]).toEqual(['sistema', { anos: [2026, 2027], acrescentados: esperados, origem: 'inicio_do_servidor' }])
  })

  it('com algum feriado na tabela, não mexe em nada (o que a Sênior tirou não volta)', async () => {
    await banco.insert(feriado).values({ data: '2026-11-20', tribunal: null, descricao: 'Consciência Negra' })
    expect(await carregarFeriadosSeVazio(banco, AGORA)).toBe(0)
    expect(await banco.select().from(feriado)).toHaveLength(1)
  })
})
