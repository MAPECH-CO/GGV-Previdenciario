import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { configuracao, eventoAuditoria, rodadaVigilia } from '../banco/esquema.ts'
import type { Fonte } from './fontes.ts'
import { batida, horariosDaVigilia, planejarDia, rodar } from './rodadas.ts'

let banco: Banco
let fechar: () => Promise<void>
beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
})
afterEach(() => fechar())

const fonteQue = (nome: string, buscar: Fonte['buscar']): Fonte => ({ nome, buscar })
const vazia = fonteQue('aasp', async () => [])
const umaPublicacao = fonteQue('aasp', async () => [{ fonte: 'aasp', numeroCnj: null, disponibilizadaEm: '2026-10-05', texto: 'Intimação.', partes: null }])
const rodadas = () => banco.select().from(rodadaVigilia).orderBy(rodadaVigilia.previstaPara)
const as = (iso: string) => () => new Date(iso)

describe('GGVP-30 · rodadas da vigília', () => {
  it('planeja 3 rodadas por fonte no dia, nos horários do escritório, sem duplicar', async () => {
    await planejarDia(banco, [vazia, fonteQue('djen', async () => [])], new Date('2026-10-05T10:00:00Z'))
    await planejarDia(banco, [vazia], new Date('2026-10-05T12:00:00Z'))
    expect((await rodadas()).map((r) => [r.fonte, r.previstaPara.toISOString()])).toEqual([
      ['aasp', '2026-10-05T11:00:00.000Z'],
      ['djen', '2026-10-05T11:00:00.000Z'],
      ['aasp', '2026-10-05T16:00:00.000Z'],
      ['djen', '2026-10-05T16:00:00.000Z'],
      ['aasp', '2026-10-05T21:00:00.000Z'],
      ['djen', '2026-10-05T21:00:00.000Z'],
    ])
    await banco.insert(configuracao).values({ chave: 'vigilia.horarios', valor: ['07:30', '12:00', '17:30'] })
    expect(await horariosDaVigilia(banco)).toEqual(['07:30', '12:00', '17:30'])
  })

  it('CA7, CA2 · a rodada registra início, fim, fonte, quantidade e status (OK com zero também)', async () => {
    await batida(banco, [umaPublicacao], as('2026-10-05T11:05:00Z'))
    const [r] = await rodadas()
    expect([r.fonte, r.situacao, r.capturadas, r.inicio !== null, r.fim !== null]).toEqual(['aasp', 'ok', 1, true, true])
    await batida(banco, [vazia], as('2026-10-05T16:02:00Z'))
    expect((await rodadas())[1]).toMatchObject({ situacao: 'ok', capturadas: 0 })
  })

  it('CA8 · erro e credencial inválida viram falha com o erro; credencial vai também ao suporte', async () => {
    await planejarDia(banco, [vazia], new Date('2026-10-05T10:00:00Z'))
    const [r] = await rodadas()
    const semCredencial = fonteQue('aasp', async () => {
      throw new Error('credencial inválida (401)')
    })
    expect(await rodar(banco, r.id, semCredencial, as('2026-10-05T11:00:00Z'))).toEqual({ situacao: 'falhou', erro: 'credencial inválida (401)' })
    expect((await banco.select().from(eventoAuditoria).where(eq(eventoAuditoria.acao, 'alarme_suporte'))).length).toBe(1)
  })

  it('CA8 · tempo esgotado também é falha', async () => {
    await planejarDia(banco, [vazia], new Date('2026-10-05T10:00:00Z'))
    const [r] = await rodadas()
    const lenta = fonteQue('aasp', () => new Promise((resolver) => setTimeout(() => resolver([]), 500)))
    const resultado = await rodar(banco, r.id, lenta, as('2026-10-05T11:00:00Z'), 20)
    expect(resultado).toMatchObject({ situacao: 'falhou' })
    expect((await rodadas())[0].erro).toContain('tempo esgotado')
  })

  it('CA9 · a rodada que não rodou até 30 minutos depois do horário vira "não rodou"', async () => {
    await planejarDia(banco, [vazia], new Date('2026-10-05T10:00:00Z'))
    await batida(banco, [], as('2026-10-05T11:31:00Z'))
    expect((await rodadas()).map((r) => r.situacao)).toEqual(['nao_rodou', 'prevista', 'prevista'])
  })
})
