import { validarCnj } from '@ggv/campos'
import { describe, expect, it } from 'vitest'
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
