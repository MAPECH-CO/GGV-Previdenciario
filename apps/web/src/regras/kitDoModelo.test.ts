import { describe, expect, it } from 'vitest'
import { VARIAVEIS_DO_KIT, nomeDaVariavel, variaveisDesconhecidas } from './kitDoModelo.ts'

describe('GGVP-136 · as {{VARIÁVEIS}} do kit', () => {
  it('cada variável existe uma vez só, e as do beneficiário e do genitor(a) seguem o padrão dos modelos do ZapSign', () => {
    const nomes = VARIAVEIS_DO_KIT.map((v) => v.nome)
    expect(new Set(nomes).size).toBe(nomes.length)
    for (const n of [
      'NOME COMPLETO',
      'Nº',
      'TELEFONE P/ CONTATO',
      'DATA DE HOJE',
      'NÚMERO DO CPF DO BENEFICIÁRIO',
      'DATA DE NASCIMENTO DO BENEFICIÁRIO',
      'NOME COMPLETO GENITOR(A)',
      'ESTADO CIVIL GENITOR(A)',
    ])
      expect(nomes, n).toContain(n)
  })

  it('só os telefones para contato são opcionais: saem em branco quando a ficha não tem', () => {
    expect(VARIAVEIS_DO_KIT.filter((v) => v.opcional).map((v) => v.nome)).toEqual(['TELEFONE P/ CONTATO', 'TEL 2'])
  })

  it('o nome vale depois de normalizado: o Word guarda o acento solto e põe espaço na ponta', () => {
    expect(nomeDaVariavel(' NÚMERO DO RG ')).toBe('NÚMERO DO RG')
    expect(variaveisDesconhecidas(['NÚMERO DO RG', 'NOME COMPLETO', 'NOME COMPLETO'])).toEqual([])
  })

  it('variável escrita errada no Word é desconhecida: sairia em branco no papel', () => {
    expect(variaveisDesconhecidas(['NOME COMPLETO', 'NOME COMPLETA', 'CPF', 'NOME COMPLETA'])).toEqual(['NOME COMPLETA', 'CPF'])
  })
})
