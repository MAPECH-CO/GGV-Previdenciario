import { describe, expect, it } from 'vitest'
import { SalvarTermo } from './glossario.ts'

const erro = (entrada: unknown) => {
  const r = SalvarTermo.safeParse(entrada)
  return r.success ? '' : r.error.issues[0].message
}

describe('glossário do escritório (GGVP-143)', () => {
  it('o termo sai sem espaço sobrando; o significado é opcional e vazio vira nulo', () => {
    expect(SalvarTermo.parse({ termo: '  2ª  Vara Federal de Santo Amaro ', tipo: 'juizo' })).toEqual({
      termo: '2ª Vara Federal de Santo Amaro',
      tipo: 'juizo',
      significado: null,
    })
    expect(SalvarTermo.parse({ termo: 'DER', tipo: 'sigla', significado: ' Data de Entrada do Requerimento ' }).significado).toBe('Data de Entrada do Requerimento')
    expect(SalvarTermo.parse({ termo: 'BPC/LOAS', tipo: 'beneficio', significado: '   ' }).significado).toBeNull()
  })

  it('termo vazio, longo demais ou tipo fora da lista são recusados', () => {
    expect(erro({ termo: ' ', tipo: 'sigla' })).toBe('Escreva o termo')
    expect(erro({ tipo: 'sigla' })).toBe('Escreva o termo')
    expect(erro({ termo: 'x'.repeat(121), tipo: 'sigla' })).toBe('O termo vai até 120 caracteres')
    expect(erro({ termo: 'LOAS', tipo: 'apelido' })).toBe('Escolha o tipo do termo')
    expect(erro({ termo: 'LOAS', tipo: 'sigla', significado: 'x'.repeat(301) })).toBe('O significado vai até 300 caracteres')
  })
})
