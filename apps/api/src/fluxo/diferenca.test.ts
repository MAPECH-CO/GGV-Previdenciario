import { describe, expect, it } from 'vitest'
import { diferenca } from './diferenca.ts'

describe('diferença entre versões, por parágrafo (GGVP-67 CA3)', () => {
  it('igual não marca nada', () => {
    expect(diferenca('Dos fatos\nDo direito', 'Dos fatos\nDo direito')).toEqual([
      { tipo: 'igual', texto: 'Dos fatos' },
      { tipo: 'igual', texto: 'Do direito' },
    ])
  })

  it('parágrafo incluído no meio e removido no fim', () => {
    expect(diferenca('Dos fatos\nDo direito\nDo pedido', 'Dos fatos\nDa tutela de urgência\nDo direito')).toEqual([
      { tipo: 'igual', texto: 'Dos fatos' },
      { tipo: 'incluido', texto: 'Da tutela de urgência' },
      { tipo: 'igual', texto: 'Do direito' },
      { tipo: 'removido', texto: 'Do pedido' },
    ])
  })

  it('parágrafo trocado aparece como removido e incluído', () => {
    expect(diferenca('Valor da causa: R$ 10.000', 'Valor da causa: R$ 12.000')).toEqual([
      { tipo: 'removido', texto: 'Valor da causa: R$ 10.000' },
      { tipo: 'incluido', texto: 'Valor da causa: R$ 12.000' },
    ])
  })

  it('a partir de um texto vazio, tudo entra', () => {
    expect(diferenca('', 'Dos fatos')).toEqual([
      { tipo: 'removido', texto: '' },
      { tipo: 'incluido', texto: 'Dos fatos' },
    ])
  })
})
