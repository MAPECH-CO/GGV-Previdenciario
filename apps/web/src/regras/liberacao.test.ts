import { describe, expect, it } from 'vitest'
import type { Checklist } from './checklist.ts'
import { diasNaFila, idade, parecerEmOrdem, precisaDeParecer, travaDaLiberacao } from './liberacao.ts'

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
    expect(travaDaLiberacao({ ...pronto, parecer: { situacao: 'pendente' } })).toBe('O parecer médico ainda não está "Suficiente", confirmado por pessoa (G17).')
    expect(travaDaLiberacao({ ...pronto, conferiAssinaturas: false })).toBe('Marque o checklist e as assinaturas e datas: os dois são conferência sua.')
    expect(travaDaLiberacao({ ...pronto, conferiChecklist: false })).toBe('Marque o checklist e as assinaturas e datas: os dois são conferência sua.')
    expect(travaDaLiberacao({ ...pronto, beneficio: 'loas-idoso', nomeBeneficio: 'LOAS Idoso', parecer: undefined })).toBeNull()
  })

  it('CA5 · a idade na fila em dias', () => {
    expect(diasNaFila('2026-10-03', '2026-10-05')).toBe(2)
    expect(diasNaFila('2026-10-05', '2026-10-05')).toBe(0)
    expect(diasNaFila('2026-09-30', '2026-10-05')).toBe(5)
    expect([0, 1, 4].map(idade)).toEqual(['desde hoje', 'há 1 dia', 'há 4 dias'])
  })
})
