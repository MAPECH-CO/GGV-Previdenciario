import { describe, expect, it } from 'vitest'
import { bloqueioDoAcidente, complementares, especie, motivoParaNaoSalvar, paraDados, type DadosDoAcidente, type TabelaDoAcidente } from './acidente.ts'

// Uma tabela pequena para a regra; a do escritório fica em dados/checklist.ts.
const TABELA: TabelaDoAcidente = {
  trabalho: [
    { tipo: 'cat', exigencia: 'obrigatorio' },
    { tipo: 'boletim-ocorrencia', exigencia: 'desejavel' },
    { tipo: 'processo-auxilio-anterior', exigencia: 'condicional' },
  ],
  trajeto: [{ tipo: 'cat', exigencia: 'obrigatorio' }],
  ocupacional: [
    { tipo: 'cat', exigencia: 'obrigatorio' },
    { tipo: 'ppp', exigencia: 'obrigatorio' },
  ],
  transito: [
    { tipo: 'boletim-ocorrencia', exigencia: 'desejavel' },
    { tipo: 'ficha-pronto-socorro', exigencia: 'obrigatorio' },
  ],
  domestico: [{ tipo: 'ficha-pronto-socorro', exigencia: 'obrigatorio' }],
}

const dados = (resto: Partial<DadosDoAcidente> = {}): DadosDoAcidente => ({
  circunstancia: 'trabalho',
  categoria: 'empregado',
  acidenteEm: '2024-03-15',
  auxilioAnterior: false,
  recusados: [],
  ...resto,
})

describe('Auxílio-Acidente: prova do acidente (GGVP-47)', () => {
  it('a circunstância define a espécie: B94 no trabalho, no trajeto e na doença ocupacional; B36 no trânsito e no doméstico', () => {
    expect(especie('trabalho')).toBe('B94 · auxílio-acidente acidentário')
    expect(especie('trajeto')).toBe('B94 · auxílio-acidente acidentário')
    expect(especie('ocupacional')).toBe('B94 · auxílio-acidente acidentário')
    expect(especie('transito')).toBe('B36 · auxílio-acidente previdenciário')
    expect(especie('domestico')).toBe('B36 · auxílio-acidente previdenciário')
  })

  it('CA1 · cada complementar com a exigência; o condicional se aplica só se houve auxílio por incapacidade temporária antes', () => {
    expect(complementares(TABELA, dados()).map((c) => [c.tipo, c.exigencia, c.aplica])).toEqual([
      ['cat', 'obrigatorio', true],
      ['boletim-ocorrencia', 'desejavel', true],
      ['processo-auxilio-anterior', 'condicional', false],
    ])
    expect(complementares(TABELA, dados({ auxilioAnterior: true })).find((c) => c.tipo === 'processo-auxilio-anterior')?.aplica).toBe(true)
  })

  it('CA2 · a circunstância e a categoria ajustam o obrigatório: CAT e PPP só com vínculo', () => {
    expect(complementares(TABELA, dados({ circunstancia: 'transito' })).map((c) => c.tipo)).toEqual(['boletim-ocorrencia', 'ficha-pronto-socorro'])
    expect(complementares(TABELA, dados({ circunstancia: 'ocupacional' })).map((c) => c.tipo)).toEqual(['cat', 'ppp'])
    expect(complementares(TABELA, dados({ circunstancia: 'ocupacional', categoria: 'avulso' })).map((c) => c.tipo)).toEqual(['cat', 'ppp'])
  })

  it('Lucas, 07/10 · sem empregador (o rural): sem CAT, o boletim vira obrigatório e entram as fotos do acidente', () => {
    expect(complementares(TABELA, dados({ categoria: 'especial' })).map((c) => [c.tipo, c.exigencia])).toEqual([
      ['boletim-ocorrencia', 'obrigatorio'],
      ['fotos-acidente', 'obrigatorio'],
      ['processo-auxilio-anterior', 'condicional'],
    ])
    // Com empregador, a CAT prova o acidente e o boletim segue desejável; na doença ocupacional não há boletim nem fotos.
    expect(complementares(TABELA, dados()).find((c) => c.tipo === 'boletim-ocorrencia')?.exigencia).toBe('desejavel')
    expect(complementares(TABELA, dados({ circunstancia: 'ocupacional', categoria: 'especial' }))).toEqual([])
  })

  it('CA3 · a válvula: a CAT ou o PPP recusados pelo empregador ficam marcados', () => {
    const lista = complementares(TABELA, dados({ circunstancia: 'ocupacional', recusados: ['ppp'] }))
    expect(lista.map((c) => [c.tipo, c.recusado])).toEqual([
      ['cat', false],
      ['ppp', true],
    ])
  })

  it('CA2 · contribuinte individual e facultativo travam na categoria; o doméstico, antes da LC 150/2015', () => {
    expect(bloqueioDoAcidente(dados({ categoria: 'individual' }))).toBe('Contribuinte individual não tem direito ao auxílio-acidente: o caso trava na categoria.')
    expect(bloqueioDoAcidente(dados({ categoria: 'facultativo' }))).toBe('Facultativo não tem direito ao auxílio-acidente: o caso trava na categoria.')
    expect(bloqueioDoAcidente(dados({ categoria: 'domestico', acidenteEm: '2015-06-01' }))).toContain('a partir de 02/06/2015 (LC 150/2015)')
    expect(bloqueioDoAcidente(dados({ categoria: 'domestico', acidenteEm: '2015-06-02' }))).toBeNull()
    expect(bloqueioDoAcidente(dados())).toBeNull()
  })

  it('a tela salva só com a circunstância, a categoria e a data do acidente que não seja futura', () => {
    const v = { circunstancia: 'trajeto' as const, categoria: 'empregado' as const, acidenteEm: '15/03/2024', auxilioAnterior: true, recusados: [] }
    expect(motivoParaNaoSalvar({ ...v, circunstancia: '' }, '2026-10-06')).toBe('Escolha a circunstância do acidente.')
    expect(motivoParaNaoSalvar({ ...v, categoria: '' }, '2026-10-06')).toBe('Escolha a categoria do segurado.')
    expect(motivoParaNaoSalvar({ ...v, acidenteEm: '01/01/2030' }, '2026-10-06')).toBe('Data do acidente em dd/mm/aaaa, que não seja futura.')
    expect(motivoParaNaoSalvar({ ...v, acidenteEm: '31/02/2024' }, '2026-10-06')).toBe('Data do acidente em dd/mm/aaaa, que não seja futura.')
    expect(paraDados(v, '2026-10-06')).toEqual({ circunstancia: 'trajeto', categoria: 'empregado', acidenteEm: '2024-03-15', auxilioAnterior: true, recusados: [] })
  })
})
