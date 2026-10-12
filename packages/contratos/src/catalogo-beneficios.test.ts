import { expect, it } from 'vitest'
import { BENEFICIO_NA_CONFIGURACAO, CATALOGO_BENEFICIOS } from './catalogo-beneficios.ts'
import { BENEFICIOS } from './governanca.ts'
it('mantém 34 benefícios distintos, com ligação apenas aos aceitos na Configuração atual', () => {
  expect(CATALOGO_BENEFICIOS).toHaveLength(34)
  expect(new Set(CATALOGO_BENEFICIOS.map(b => b.id)).size).toBe(34)
  expect(CATALOGO_BENEFICIOS.every(b => b.nome.trim())).toBe(true)
  expect(Object.keys(BENEFICIO_NA_CONFIGURACAO).every(id => CATALOGO_BENEFICIOS.some(b => b.id === id))).toBe(true)
  expect(Object.values(BENEFICIO_NA_CONFIGURACAO).every(id => (BENEFICIOS as readonly string[]).includes(id))).toBe(true)
  expect(BENEFICIO_NA_CONFIGURACAO['seguro-carro']).toBeUndefined()
})
