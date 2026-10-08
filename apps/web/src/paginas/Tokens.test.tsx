import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tokens } from './Tokens.tsx'

describe('Tokens', () => {
  it('mostra as 29 cores, os 17 tamanhos de fonte e os 8 raios', () => {
    render(<Tokens />)
    const itens = (secao: RegExp) => within(screen.getByRole('region', { name: secao })).getAllByRole('listitem')
    expect(itens(/^Cores/)).toHaveLength(29)
    expect(itens(/^Tamanhos de fonte/)).toHaveLength(17)
    expect(itens(/^Raios/)).toHaveLength(8)
  })
})
