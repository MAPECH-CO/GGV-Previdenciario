import { describe, expect, it } from 'vitest'
import { calcularChance, corDaChance, oQueFaltaSaber } from './chance.ts'

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

describe('GGVP-150 · cor e o que falta saber', () => {
  it('CA2, CA3 · vermelho abaixo de 15%, amarelo de 15% a 50% (os dois limites incluídos), verde acima de 50%; sem número, sem cor', () => {
    expect([0, 14, 15, 50, 51, 100].map(corDaChance)).toEqual(['vermelho', 'vermelho', 'amarelo', 'amarelo', 'verde', 'verde'])
    expect(corDaChance(null)).toBeNull()
  })

  it('CA4 · os fatores ainda desconhecidos: perito, juízo, parecer médico e os documentos que faltam no checklist', () => {
    expect(oQueFaltaSaber({ peritoConhecido: false, juizoConhecido: false, temParecer: false, faltamNoChecklist: ['comprovante de residência', 'laudo médico'] })).toEqual([
      'o perito',
      'o juízo',
      'o parecer médico',
      'os documentos que faltam no checklist: comprovante de residência, laudo médico',
    ])
    expect(oQueFaltaSaber({ peritoConhecido: true, juizoConhecido: true, temParecer: true, faltamNoChecklist: [] })).toEqual([])
  })
})
