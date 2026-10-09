import { describe, expect, it } from 'vitest'
import { JurimetriaDoJuizo } from './juizo.ts'

describe('jurimetria do juízo (GGVP-64)', () => {
  const exemplo = {
    juizo: 'TRF3 · 6301',
    base: '2026-10-08',
    porBeneficio: [{ beneficio: 'bpc_loas_deficiente', nome: 'BPC/LOAS deficiente', procedentes: 7, decididos: 12, texto: '58% em 12 processos · base de 08/10/2026' }],
    tempoAteASentenca: null,
    processos: [{ numeroCnj: '50001014520234036301', desfecho: 'procedente_total' }],
  }

  it('CA4 · cada taxa vem com os processos e a data da base; o tempo até a sentença pode faltar', () => {
    expect(JurimetriaDoJuizo.parse(exemplo)).toEqual(exemplo)
    expect(JurimetriaDoJuizo.parse({ ...exemplo, tempoAteASentenca: { meses: 14, processos: 3 } }).tempoAteASentenca).toEqual({ meses: 14, processos: 3 })
  })

  it('CA5 · sem a data da base, não vale', () => {
    const { base: _, ...semBase } = exemplo
    expect(JurimetriaDoJuizo.safeParse(semBase).success).toBe(false)
  })
})
