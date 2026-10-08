import { describe, expect, it } from 'vitest'
import { calcularChance } from './chance.ts'

describe('GGVP-131 CA2 · chance de êxito por código', () => {
  it('favoráveis sobre decididos, arredondado; desistência e desfecho vazio não contam', () => {
    expect(calcularChance(['deferido', 'procedente_parcial', 'procedente_total', 'improcedente'])).toEqual({ casos: 4, favoraveis: 3, porcentagem: 75 })
    expect(calcularChance(['deferido', 'improcedente', 'extinto_sem_merito', 'desistencia', null])).toEqual({ casos: 3, favoraveis: 1, porcentagem: 33 })
  })

  it('sem caso decidido, sem número', () => {
    expect(calcularChance([])).toEqual({ casos: 0, favoraveis: 0, porcentagem: null })
    expect(calcularChance(['desistencia'])).toEqual({ casos: 0, favoraveis: 0, porcentagem: null })
  })

  it('um caso só já conta, com o número ao lado (G22, sem amostra mínima)', () => {
    expect(calcularChance(['improcedente'])).toEqual({ casos: 1, favoraveis: 0, porcentagem: 0 })
  })
})
