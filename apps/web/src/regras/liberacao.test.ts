import { describe, expect, it } from 'vitest'
import type { Checklist } from './checklist.ts'
import { diasNaFila, idade, parecerEmOrdem, precisaDeParecer, travaDaLiberacao, travaDoParecer } from './liberacao.ts'

const completo: Checklist = { temLista: true, itens: [], completo: true, faltam: [] }
const pronto = {
  checklist: completo,
  beneficio: 'loas-deficiente',
  nomeBeneficio: 'LOAS Deficiente',
  parecer: { situacao: 'suficiente' as const, quem: 'Dra. Paula', data: '2026-10-02' },
  conferiChecklist: true,
  conferiAssinaturas: true,
}

describe('Liberar o caso ao Jurídico (GGVP-18)', () => {
  it('CA7 · o parecer vale para os benefícios da matriz de laudos; fora dela, não se aplica', () => {
    expect(precisaDeParecer('loas-deficiente')).toBe(true)
    expect(precisaDeParecer('auxilio-acidente')).toBe(true)
    expect(precisaDeParecer('loas-idoso')).toBe(false)
    expect(parecerEmOrdem('loas-idoso', undefined)).toBe(true)
    expect(parecerEmOrdem('loas-deficiente', { situacao: 'pendente' })).toBe(false)
  })

  it('CA2 e CA7 · só libera com o checklist completo, o parecer Suficiente e as duas conferências da pessoa', () => {
    expect(travaDaLiberacao(pronto)).toBeNull()
    expect(travaDaLiberacao({ ...pronto, checklist: { ...completo, completo: false, faltam: ['Comprovante de renda'] } })).toBe(
      'O checklist está incompleto. Falta: Comprovante de renda.',
    )
    expect(travaDaLiberacao({ ...pronto, parecer: { situacao: 'pendente' } })).toBe(
      'Não dá para liberar ao Jurídico: a IA analisou, mas o parecer médico ainda não foi confirmado por pessoa do Jurídico (G17).',
    )
    expect(travaDaLiberacao({ ...pronto, conferiAssinaturas: false })).toBe('Marque o checklist e as assinaturas e datas: os dois são conferência sua.')
    expect(travaDaLiberacao({ ...pronto, conferiChecklist: false })).toBe('Marque o checklist e as assinaturas e datas: os dois são conferência sua.')
    expect(travaDaLiberacao({ ...pronto, beneficio: 'loas-idoso', nomeBeneficio: 'LOAS Idoso', parecer: undefined })).toBeNull()
  })

  it('GGVP-33 CA1 · o G17 trava as três ações e diz o que falta em cada situação', () => {
    const insuficiente = { situacao: 'insuficiente' as const, quem: 'Dra. Paula', data: '2026-10-06' }
    expect(travaDoParecer('liberar', 'loas-deficiente', insuficiente)).toBe(
      'Não dá para liberar ao Jurídico: o parecer médico está Insuficiente. Falta o complemento do médico e o parecer refeito (G17).',
    )
    expect(travaDoParecer('aprovar-inss', 'aposentadoria-pcd', { situacao: 'contraditorio' })).toBe(
      'Não dá para aprovar para o INSS: um documento contradiz o requisito do benefício e o parecer está Contraditório (G18).',
    )
    expect(travaDoParecer('pedir-peticao', 'auxilio-acidente', undefined)).toBe('Não dá para pedir a petição: falta o parecer médico "Suficiente", confirmado por pessoa (G17).')
    expect(travaDoParecer('pedir-peticao', 'auxilio-acidente', { situacao: 'pendente' })).toMatch(/ainda não foi confirmado por pessoa/)
    expect(travaDoParecer('aprovar-inss', 'loas-deficiente', { situacao: 'suficiente' })).toBeNull()
    expect(travaDoParecer('liberar', 'loas-idoso', undefined)).toBeNull()
  })

  it('GGVP-33 CA2 · a dispensa de duas sêniores põe o parecer em ordem nas três ações', () => {
    const dispensado = { situacao: 'dispensado' as const, quem: 'Dra. Renata e Dr. Otávio', data: '2026-10-06', justificativa: 'prazo do juiz' }
    expect(parecerEmOrdem('loas-deficiente', dispensado)).toBe(true)
    for (const acao of ['liberar', 'aprovar-inss', 'pedir-peticao'] as const) expect(travaDoParecer(acao, 'loas-deficiente', dispensado)).toBeNull()
  })

  it('CA5 · a idade na fila em dias', () => {
    expect(diasNaFila('2026-10-03', '2026-10-05')).toBe(2)
    expect(diasNaFila('2026-10-05', '2026-10-05')).toBe(0)
    expect(diasNaFila('2026-09-30', '2026-10-05')).toBe(5)
    expect([0, 1, 4].map(idade)).toEqual(['desde hoje', 'há 1 dia', 'há 4 dias'])
  })
})

describe('G18 no Auxílio-Acidente (GGVP-47, CA4)', () => {
  const suficiente = { situacao: 'suficiente' as const, quem: 'Dra. Paula', data: '2026-07-15' }
  const naoConsolidada = { id: 'nao-consolidada', texto: 'Lesão ainda não consolidada' }

  it('a contradição que a IA achou e ninguém conferiu trava, mesmo com o parecer Suficiente anterior, e sugere a troca de benefício', () => {
    const parecer = { ...suficiente, contradicoes: [naoConsolidada] }
    expect(parecerEmOrdem('auxilio-acidente', parecer)).toBe(false)
    expect(travaDoParecer('liberar', 'auxilio-acidente', parecer)).toBe(
      'Não dá para liberar ao Jurídico: a análise da IA achou documento que contradiz o requisito do benefício (lesão ainda não consolidada). O caso fica parado até o Jurídico conferir o parecer (G18). Sugestão: trocar para Auxílio por Incapacidade Temporária; o caso muda de porta.',
    )
    expect(travaDaLiberacao({ ...pronto, beneficio: 'auxilio-acidente', nomeBeneficio: 'Auxílio Acidentário', parecer })).toContain('(G18)')
  })

  it('sem redução da capacidade também trava, sem a sugestão de troca; fora do Auxílio-Acidente, a troca não aparece', () => {
    const semReducao = { id: 'sem-reducao', texto: 'Laudo sem redução da capacidade' }
    expect(travaDoParecer('liberar', 'auxilio-acidente', { ...suficiente, contradicoes: [semReducao] })).not.toContain('Sugestão')
    expect(travaDoParecer('liberar', 'incapacidade-temporaria', { ...suficiente, contradicoes: [naoConsolidada] })).not.toContain('Sugestão')
    expect(travaDoParecer('liberar', 'auxilio-acidente', suficiente)).toBeNull()
  })
})
