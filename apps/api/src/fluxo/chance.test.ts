import { describe, expect, it } from 'vitest'
import { MSG_CHANCE_DO_OUTRO, calcularChanceDoRecurso, calcularChancePorEtapa, corDaChance, oQueFaltaSaber, type ProcessoParaAChance } from './chance.ts'

/** `n` processos iguais, para montar o acervo pelas contagens da base de 16/10. */
const vezes = (n: number, desfecho: string | null, laudoFavoravel: boolean | null = null, estudoSocialFavoravel: boolean | null = null): ProcessoParaAChance[] =>
  Array.from({ length: n }, () => ({ desfecho, laudoFavoravel, estudoSocialFavoravel }))

/**
 * O LOAS deficiente como a base de 16/10 conta: 192 decididos no mérito (63 ganhos, 38 deles acordos; 129 perdas), 159
 * extinções e 20 desistências fora, 12 em andamento. Com laudo favorável, 72 (55 ganhos); com desfavorável, 115 (4).
 */
const LOAS_DEFICIENTE: ProcessoParaAChance[] = [
  ...vezes(38, 'acordo', true),
  ...vezes(17, 'procedente_total', true),
  ...vezes(17, 'improcedente', true),
  ...vezes(4, 'procedente_parcial', false),
  ...vezes(111, 'improcedente', false),
  ...vezes(4, 'deferido'),
  ...vezes(1, 'improcedente'),
  ...vezes(159, 'extinto_sem_merito', false),
  ...vezes(20, 'desistencia'),
  ...vezes(12, null),
]
/** O LOAS idoso: 81 decididos (31 ganhos); estudo favorável 43 (28 ganhos), desfavorável 35 (0). */
const LOAS_IDOSO: ProcessoParaAChance[] = [
  ...vezes(28, 'procedente_total', null, true),
  ...vezes(15, 'improcedente', null, true),
  ...vezes(35, 'improcedente', null, false),
  ...vezes(3, 'acordo'),
  ...vezes(40, 'extinto_sem_merito'),
]
/** O auxílio por incapacidade: 33 decididos (9 ganhos); laudo favorável 10 (9 ganhos), desfavorável 22 (0). */
const AUXILIO: ProcessoParaAChance[] = [...vezes(9, 'procedente_total', true), ...vezes(1, 'improcedente', true), ...vezes(22, 'improcedente', false), ...vezes(1, 'improcedente'), ...vezes(30, 'extinto_sem_merito')]

describe('GGVP-163 R6 · a chance por etapa do caso (Lucas, 16/10)', () => {
  it('CA6 · antes da perícia: ganho é procedente, em parte, deferido e acordo; perda é improcedente; extinção e desistência ficam fora', () => {
    expect(calcularChancePorEtapa('bpc_loas_deficiente', LOAS_DEFICIENTE)).toEqual({ casos: 192, favoraveis: 63, porcentagem: 33, etapa: 'antes_da_pericia', aviso: null })
    expect(calcularChancePorEtapa('bpc_loas_idoso', LOAS_IDOSO)).toEqual({ casos: 81, favoraveis: 31, porcentagem: 38, etapa: 'antes_da_pericia', aviso: null })
    expect(calcularChancePorEtapa('auxilio_incapacidade_temporaria', AUXILIO)).toEqual({ casos: 33, favoraveis: 9, porcentagem: 27, etapa: 'antes_da_pericia', aviso: null })
  })

  it('CA7 · depois do laudo, a conta é só entre os casos com o mesmo resultado de laudo', () => {
    expect(calcularChancePorEtapa('bpc_loas_deficiente', LOAS_DEFICIENTE, { laudoFavoravel: true })).toMatchObject({ casos: 72, favoraveis: 55, porcentagem: 76, etapa: 'depois_do_laudo' })
    expect(calcularChancePorEtapa('bpc_loas_deficiente', LOAS_DEFICIENTE, { laudoFavoravel: false })).toMatchObject({ casos: 115, favoraveis: 4, porcentagem: 3, etapa: 'depois_do_laudo' })
    expect(calcularChancePorEtapa('auxilio_incapacidade_temporaria', AUXILIO, { laudoFavoravel: true })).toMatchObject({ casos: 10, favoraveis: 9, porcentagem: 90 })
    expect(calcularChancePorEtapa('auxilio_incapacidade_temporaria', AUXILIO, { laudoFavoravel: false })).toMatchObject({ casos: 22, favoraveis: 0, porcentagem: 0 })
  })

  it('CA8 · no LOAS idoso quem decide é o estudo social; o laudo não muda a etapa', () => {
    expect(calcularChancePorEtapa('bpc_loas_idoso', LOAS_IDOSO, { estudoSocialFavoravel: true })).toMatchObject({ casos: 43, favoraveis: 28, porcentagem: 65, etapa: 'depois_do_estudo_social' })
    expect(calcularChancePorEtapa('bpc_loas_idoso', LOAS_IDOSO, { estudoSocialFavoravel: false })).toMatchObject({ casos: 35, favoraveis: 0, porcentagem: 0, etapa: 'depois_do_estudo_social' })
    expect(calcularChancePorEtapa('bpc_loas_idoso', LOAS_IDOSO, { laudoFavoravel: true })).toMatchObject({ casos: 81, porcentagem: 38, etapa: 'antes_da_pericia' })
  })

  it('CA9 · nenhuma etapa do LOAS deficiente mostra os 8% da regra antiga (extinção como derrota, acordo fora)', () => {
    const etapas = [{}, { laudoFavoravel: true }, { laudoFavoravel: false }].map((e) => calcularChancePorEtapa('bpc_loas_deficiente', LOAS_DEFICIENTE, e).porcentagem)
    expect(etapas).toEqual([33, 76, 3])
    expect(etapas).not.toContain(8)
  })

  it('o recorte da etapa sem caso cai na etapa anterior, com aviso', () => {
    const soFavoraveis = [...vezes(3, 'procedente_total', true), ...vezes(1, 'improcedente', true)]
    expect(calcularChancePorEtapa('pensao_morte', soFavoraveis, { laudoFavoravel: false })).toEqual({
      casos: 4,
      favoraveis: 3,
      porcentagem: 75,
      etapa: 'antes_da_pericia',
      aviso: 'Nenhum caso da base com o mesmo laudo: a chance é a de antes da perícia.',
    })
    expect(calcularChancePorEtapa('bpc_loas_idoso', vezes(2, 'improcedente'), { estudoSocialFavoravel: true }).aviso).toBe('Nenhum caso da base com o mesmo estudo social: a chance é a de antes da perícia.')
  })

  it('o benefício "outro" não tem chance; sem benefício ou sem caso decidido, sem número (G22: zero não é amostra)', () => {
    expect(calcularChancePorEtapa('outro', LOAS_DEFICIENTE)).toEqual({ casos: 0, favoraveis: 0, porcentagem: null, etapa: 'antes_da_pericia', aviso: MSG_CHANCE_DO_OUTRO })
    expect(calcularChancePorEtapa(null, LOAS_DEFICIENTE)).toMatchObject({ casos: 0, porcentagem: null, aviso: null })
    expect(calcularChancePorEtapa('pensao_morte', [])).toMatchObject({ casos: 0, porcentagem: null })
    expect(calcularChancePorEtapa('pensao_morte', vezes(2, 'desistencia'))).toMatchObject({ casos: 0, porcentagem: null })
  })

  it('um caso só já conta, com o número ao lado (G22, sem amostra mínima)', () => {
    expect(calcularChancePorEtapa('pensao_morte', vezes(1, 'improcedente'))).toMatchObject({ casos: 1, favoraveis: 0, porcentagem: 0 })
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

describe('GGVP-161 CA2 · a chance do recurso por código', () => {
  it('provido e provido em parte sobre os recursos julgados; sem recurso julgado não conta', () => {
    expect(calcularChanceDoRecurso(['provido', 'provido_parcial', 'nao_provido', 'nao_provido', null])).toEqual({ casos: 4, favoraveis: 2, porcentagem: 50 })
  })

  it('sem recurso julgado, sem número; um só já conta (G22)', () => {
    expect(calcularChanceDoRecurso([null, null])).toEqual({ casos: 0, favoraveis: 0, porcentagem: null })
    expect(calcularChanceDoRecurso(['nao_provido'])).toEqual({ casos: 1, favoraveis: 0, porcentagem: 0 })
  })
})
