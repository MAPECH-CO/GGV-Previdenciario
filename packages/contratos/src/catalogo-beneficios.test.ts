import { expect, it } from 'vitest'
import { BENEFICIO_NA_CONFIGURACAO, CATALOGO_BENEFICIOS } from './catalogo-beneficios.ts'
import { BENEFICIOS, ROTULO_BENEFICIO } from './governanca.ts'

it('mantém 34 benefícios distintos, cada um com nome', () => {
  expect(CATALOGO_BENEFICIOS).toHaveLength(34)
  expect(new Set(CATALOGO_BENEFICIOS.map((b) => b.id)).size).toBe(34)
  expect(CATALOGO_BENEFICIOS.every((b) => b.nome.trim())).toBe(true)
})

it('GGVP-158 P4.6 · um catálogo só: os 34 têm o id do servidor, que a Configuração envia e o banco aceita, mais "outro"', () => {
  expect(new Set(CATALOGO_BENEFICIOS.map((b) => b.servidor)).size).toBe(34)
  expect(BENEFICIOS).toHaveLength(35)
  expect(BENEFICIOS.at(-1)).toBe('outro')
  expect(Object.keys(BENEFICIO_NA_CONFIGURACAO)).toEqual(CATALOGO_BENEFICIOS.map((b) => b.id))
  expect(Object.values(BENEFICIO_NA_CONFIGURACAO).every((id) => (BENEFICIOS as readonly string[]).includes(id))).toBe(true)
  expect([BENEFICIO_NA_CONFIGURACAO['seguro-carro'], ROTULO_BENEFICIO.aposentadoria_rural]).toEqual(['seguro_carro', 'Aposentadoria Rural'])
})

it('GGVP-158 P4.6 · os 11 de antes guardam o id, a ordem e o nome que o servidor já usava', () => {
  expect(BENEFICIOS.slice(0, 11)).toEqual([
    'bpc_loas_deficiente',
    'bpc_loas_idoso',
    'aposentadoria_pcd',
    'aposentadoria_idade',
    'aposentadoria_tempo',
    'aposentadoria_especial',
    'aposentadoria_incapacidade_permanente',
    'auxilio_incapacidade_temporaria',
    'auxilio_acidente',
    'pensao_morte',
    'salario_maternidade',
  ])
  expect([BENEFICIO_NA_CONFIGURACAO['aposentadoria-contribuicao'], ROTULO_BENEFICIO.bpc_loas_idoso]).toEqual(['aposentadoria_tempo', 'BPC/LOAS Idoso'])
})
