import { describe, expect, it } from 'vitest'
import { numeroDoCaso } from './identificadores.ts'

const em = (dia: number) => new Date(Date.UTC(2026, 9, dia, 12))
const PROTOCOLO = { tipo: 'protocolo_inss', valor: '123456789', criadoEm: em(1) }
const NB = { tipo: 'nb', valor: '7123456789', criadoEm: em(3) }
const CNJ = { tipo: 'cnj', valor: '00011239320184036301', criadoEm: em(6) }

describe('GGVP-108 CA3, CA5 · o número que mostra o caso', () => {
  it('no INSS, o NB; sem ele, o protocolo', () => {
    expect(numeroDoCaso('administrativa', [PROTOCOLO])).toBe(PROTOCOLO)
    expect(numeroDoCaso('administrativa', [PROTOCOLO, NB])).toBe(NB)
    expect(numeroDoCaso('atendimento', [])).toBeNull()
  })

  it('na Justiça, o número CNJ, mesmo com o NB de origem; sem ele, o número do INSS', () => {
    expect(numeroDoCaso('judicial', [PROTOCOLO, NB, CNJ])).toBe(CNJ)
    expect(numeroDoCaso('judicial', [PROTOCOLO, NB])).toBe(NB)
  })

  it('encerrado, o último número que o caso ganhou', () => {
    expect(numeroDoCaso('encerrado', [CNJ, PROTOCOLO, NB])).toBe(CNJ)
    expect(numeroDoCaso('encerrado', [PROTOCOLO])).toBe(PROTOCOLO)
  })
})
