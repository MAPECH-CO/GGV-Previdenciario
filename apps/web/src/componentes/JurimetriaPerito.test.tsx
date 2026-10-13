import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { perfilDoPerito, peritosDeExemplo, type LaudoDoPerfil } from '../dados/peritos.ts'
import { JurimetriaPerito } from './JurimetriaPerito.tsx'

const laudo = (id: string, beneficio: string | undefined, resultado: LaudoDoPerfil['resultado']): LaudoDoPerfil => ({
  id,
  caso: `caso-${id}`,
  data: '2026-09-01',
  tipo: 'medica',
  assunto: 'coluna',
  ...(beneficio && { beneficio }),
  resultado,
  dias: 20,
  observou: [],
  perguntou: [],
  pediu: [],
})

describe('Jurimetria do perito (GGVP-152)', () => {
  it('CA2 · os favoráveis por benefício, cada um com o número de laudos; o laudo antigo, sem o benefício, fica fora do recorte', () => {
    const perito = { ...peritosDeExemplo()[1], laudos: [laudo('1', 'loas-deficiente', 'favoravel'), laudo('2', 'loas-deficiente', 'desfavoravel'), laudo('3', 'pensao-morte', 'favoravel'), laudo('4', undefined, 'favoravel')] }
    const perfil = perfilDoPerito(perito)
    expect(perfil.porBeneficio.map((b) => [b.beneficio, b.jurimetria.laudos, b.jurimetria.favoraveis])).toEqual([
      ['LOAS Deficiente', 2, 1],
      ['Pensão por Morte', 1, 1],
    ])
    render(<JurimetriaPerito perfil={perfil} aoFechar={() => {}} />)
    expect(screen.getByText('LOAS Deficiente').nextElementSibling?.textContent).toMatch(/^50% · 1 de 2 laudos/)
    expect(screen.getByText('Pensão por Morte').nextElementSibling?.textContent).toMatch(/^100% · 1 de 1 laudo/)
  })
})
