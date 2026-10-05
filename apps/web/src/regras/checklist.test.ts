import { describe, expect, it } from 'vitest'
import { montarChecklist, motivoParaNaoLiberar, type EntradaDoChecklist, type ListaDoBeneficio } from './checklist.ts'

const LOAS: ListaDoBeneficio = {
  obrigatorios: ['rg', 'grupo-familiar'],
  condicionais: [
    { tipo: 'declaracao-moradia', quando: 'moradia' },
    { tipo: 'declaracao-uniao-estavel', quando: 'uniao-estavel' },
    { tipo: 'declaracao-separacao', quando: 'separacao-de-fato' },
  ],
}

const entrada = (resto: Partial<EntradaDoChecklist> = {}): EntradaDoChecklist => ({
  lista: LOAS,
  condicoes: [],
  daEntrevista: [],
  documentos: [],
  contratoAssinado: true,
  ...resto,
})

const situacoes = (e: EntradaDoChecklist) => montarChecklist(e).itens.map((i) => [i.tipo, i.situacao, i.motivo])

describe('Checklist do benefício (GGVP-91)', () => {
  it('CA1 · cada documento com recebido, pendente ou com problema, e o contrato do kit no topo', () => {
    expect(situacoes(entrada({ documentos: [{ tipo: 'rg' }, { tipo: 'grupo-familiar', quarentena: true }] }))).toEqual([
      ['contrato', 'recebido', undefined],
      ['rg', 'recebido', undefined],
      ['grupo-familiar', 'problema', 'chegou, mas está em quarentena: confira de quem é'],
    ])
    expect(montarChecklist(entrada()).itens[1].nome).toBe('Documento pessoal (RG)')
  })

  it('CA2 · sem assinatura ou com data em branco, o item fica pendente (G1); contrato sem assinar também', () => {
    const e = entrada({ contratoAssinado: false, documentos: [{ tipo: 'rg', dataEmBranco: true }, { tipo: 'grupo-familiar', semAssinatura: true }] })
    expect(situacoes(e)).toEqual([
      ['contrato', 'pendente', 'falta a assinatura do cliente (D1.17)'],
      ['rg', 'pendente', 'chegou com a data em branco (G1)'],
      ['grupo-familiar', 'pendente', 'chegou sem assinatura (G1)'],
    ])
    // Chegou outra via, assinada: vale.
    expect(situacoes(entrada({ documentos: [{ tipo: 'grupo-familiar', semAssinatura: true }, { tipo: 'grupo-familiar' }] }))[2][1]).toBe('recebido')
  })

  it('CA3 e CA5 · "completo" é calculado; incompleto não libera e diz o que falta', () => {
    const incompleto = montarChecklist(entrada({ documentos: [{ tipo: 'rg' }] }))
    expect(incompleto.completo).toBe(false)
    expect(incompleto.faltam).toEqual(['Ficha de grupo familiar'])
    expect(motivoParaNaoLiberar(incompleto, 'LOAS Deficiente')).toBe('O checklist está incompleto. Falta: Ficha de grupo familiar.')
    const completo = montarChecklist(entrada({ documentos: [{ tipo: 'rg' }, { tipo: 'grupo-familiar' }] }))
    expect(completo.completo).toBe(true)
    expect(motivoParaNaoLiberar(completo, 'LOAS Deficiente')).toBeNull()
  })

  it('CA6 · benefício sem lista aprovada nunca fica completo e explica o bloqueio', () => {
    const semLista = montarChecklist(entrada({ lista: undefined }))
    expect(semLista).toMatchObject({ temLista: false, completo: false, faltam: [] })
    expect(motivoParaNaoLiberar(semLista, 'Auxílio Acidentário')).toBe(
      'Auxílio Acidentário ainda não tem lista de documentos obrigatórios aprovada pelo escritório (configuração, GGVP-104): o caso não pode ser liberado.',
    )
  })

  it('CA7 · as declarações do LOAS entram só quando a condição do caso pede', () => {
    expect(montarChecklist(entrada()).itens.map((i) => i.tipo)).toEqual(['contrato', 'rg', 'grupo-familiar'])
    const moradia = montarChecklist(entrada({ condicoes: ['moradia'] })).itens.at(-1)
    expect(moradia).toMatchObject({ tipo: 'declaracao-moradia', de: 'condicao', condicao: 'moradia', situacao: 'pendente' })
  })

  it('CA8 · os documentos da entrevista entram junto, sem repetir o que a lista já pede', () => {
    const itens = montarChecklist(entrada({ daEntrevista: ['laudo', 'rg'] })).itens
    expect(itens.map((i) => [i.tipo, i.de])).toEqual([
      ['contrato', 'contrato'],
      ['rg', 'beneficio'],
      ['grupo-familiar', 'beneficio'],
      ['laudo', 'entrevista'],
    ])
    // Sem lista, a entrevista ainda aparece, e o caso continua sem poder liberar.
    expect(montarChecklist(entrada({ lista: undefined, daEntrevista: ['laudo'] })).itens.map((i) => i.tipo)).toEqual(['contrato', 'laudo'])
  })

  it('CA10 · a regra usa a lista que receber: o escritório muda a lista sem mudar código', () => {
    const outra: ListaDoBeneficio = { obrigatorios: ['cnis'], condicionais: [] }
    expect(montarChecklist(entrada({ lista: outra, documentos: [{ tipo: 'cnis' }] })).completo).toBe(true)
  })
})
