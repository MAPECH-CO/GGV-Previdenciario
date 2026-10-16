import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { textoDoIndicador } from '../regras/baseHistorica.ts'
import { BaseDoBeneficio } from './BaseDoBeneficio.tsx'

// GGVP-163 R5: a página do benefício, com a síntese e as taxas da base histórica (dados inventados).
const PAGINA = {
  beneficio: 'bpc_loas_deficiente',
  nome: 'BPC/LOAS Deficiente',
  dataDaBase: '2026-10-16',
  sintese: [{ ordem: 1, materia: 'bpc_loas_deficiente', texto: 'LOAS deficiente — O que decide o mérito:\n- **A perícia médica decide.** Laudo desfavorável: 4 de 115.\n- Segundo item.' }],
  indicadores: [
    { indicador: 'exito_merito', nome: 'Êxito no mérito', recorte: 'geral', chave: '*', n: 192, sim: 63, valor: 0.328, baseEm: '2026-10-16' },
    { indicador: 'exito_com_laudo_desfavoravel', nome: 'Êxito com laudo desfavorável', recorte: 'geral', chave: '*', n: 115, sim: 4, valor: 0.035, baseEm: '2026-10-16' },
    { indicador: 'exito_merito', nome: 'Êxito no mérito · 2023', recorte: 'ano', chave: '2023', n: 0, sim: 0, valor: null, baseEm: '2026-10-16' },
  ],
}

function servidor(pagina: object = PAGINA, status = 200) {
  const fetch = vi.fn(async (_url: string) => new Response(JSON.stringify(status === 200 ? pagina : { erro: 'Sem permissão.' }), { status }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

describe('Base histórica do benefício (GGVP-163 R5)', () => {
  it('CA3 · a página do LOAS deficiente: as taxas com o número de casos e a data da base ("4 de 115"), e a síntese em parágrafos e listas', async () => {
    const fetch = servidor()
    render(<BaseDoBeneficio beneficio="bpc_loas_deficiente" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Base histórica · BPC/LOAS Deficiente' })).toBeTruthy()
    expect(fetch.mock.calls[0][0]).toBe('/api/base-historica/bpc_loas_deficiente')
    const taxas = screen.getByRole('region', { name: 'Taxas da base histórica' })
    expect(within(taxas).getByText('Êxito com laudo desfavorável').nextElementSibling?.textContent).toBe('4 de 115 (3%) · base de 16/10')
    expect(within(taxas).getByText('Êxito no mérito').nextElementSibling?.textContent).toBe('63 de 192 (33%) · base de 16/10')
    expect(within(taxas).getByText('Êxito no mérito · 2023').nextElementSibling?.textContent).toBe('sem caso · base de 16/10')
    const sintese = screen.getByRole('region', { name: 'Síntese da base histórica' })
    expect(within(sintese).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['A perícia médica decide. Laudo desfavorável: 4 de 115.', 'Segundo item.'])
    expect(within(sintese).getByText('A perícia médica decide.').tagName).toBe('STRONG')
  })

  it('sem a base carregada, a página diz; o erro do servidor aparece como alerta', async () => {
    servidor({ ...PAGINA, dataDaBase: null, sintese: [], indicadores: [] })
    const { unmount } = render(<BaseDoBeneficio beneficio="bpc_loas_deficiente" />)
    expect(await screen.findByText('Sem base histórica carregada: nada a mostrar ainda.')).toBeTruthy()
    unmount()
    servidor({}, 403)
    render(<BaseDoBeneficio beneficio="bpc_loas_deficiente" />)
    expect((await screen.findByRole('alert')).textContent).toBe('Sem permissão.')
  })

  it('sem benefício, a lista dos benefícios do catálogo com o link de cada um; "outro" não tem página', () => {
    servidor()
    render(<BaseDoBeneficio />)
    const lista = screen.getByRole('list', { name: 'Benefícios' })
    expect(within(lista).getByRole('link', { name: 'BPC/LOAS Deficiente' }).getAttribute('href')).toBe('/beneficios/bpc_loas_deficiente')
    expect(within(lista).queryByRole('link', { name: 'Outro' })).toBeNull()
  })

  it('o texto da taxa: sim de n, a porcentagem e a data da base; sem caso, "sem caso"', () => {
    expect(textoDoIndicador({ indicador: 'x', nome: 'x', recorte: 'geral', chave: '*', n: 72, sim: 55, valor: 0.764, baseEm: null }, '2026-10-16')).toBe('55 de 72 (76%) · base de 16/10')
    expect(textoDoIndicador({ indicador: 'x', nome: 'x', recorte: 'geral', chave: '*', n: 0, sim: 0, valor: null, baseEm: null }, null)).toBe('sem caso')
  })
})
