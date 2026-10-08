import { describe, expect, it } from 'vitest'
import { emVigor, motivoParaNaoSalvar, mudancas, novaVersao, roteiroDoBeneficio, versao, type ItemDoRoteiro, type Roteiro } from './roteiro.ts'

const itens: ItemDoRoteiro[] = [
  { id: 'a', tipo: 'obrigatorio', texto: 'Natureza do impedimento', pergunta: 'Qual é a natureza do impedimento?' },
  { id: 'x', tipo: 'contradicao', texto: 'Duração menor que 24 meses' },
  { id: 'c', tipo: 'complementar', texto: 'Provas de gastos' },
]

const loas: Roteiro = {
  id: 'loas-deficiente',
  nome: 'BPC/LOAS Deficiente',
  beneficios: ['loas-deficiente'],
  laudo: true,
  versoes: [{ versao: 1, autor: 'Escritório', quando: '2026-09-26T12:00:00.000Z', itens }],
}
const pcd: Roteiro = { ...loas, id: 'pcd', nome: 'Aposentadoria PCD', beneficios: ['aposentadoria-pcd', 'aposentadoria-pcd-idade'] }

describe('Roteiro de conteúdo mínimo (GGVP-93)', () => {
  it('CA1 e CA3 · um roteiro vale para os benefícios dele; fora de todos, o benefício não tem roteiro', () => {
    expect(roteiroDoBeneficio([loas, pcd], 'aposentadoria-pcd-idade')?.id).toBe('pcd')
    expect(roteiroDoBeneficio([loas, pcd], 'loas-deficiente')?.id).toBe('loas-deficiente')
    expect(roteiroDoBeneficio([loas, pcd], 'pensao-morte')).toBeUndefined()
  })

  it('CA2 · salvar cria a versão seguinte, com autor e data, e a anterior fica para o caso que a usou', () => {
    const editado = itens.map((i) => (i.id === 'a' ? { ...i, texto: '  Natureza e origem do impedimento ' } : i))
    const depois = novaVersao(loas, editado, 'Dra. Renata (exemplo)', '2026-10-06T15:00:00.000Z')
    expect(depois.versoes.map((v) => [v.versao, v.autor])).toEqual([
      [1, 'Escritório'],
      [2, 'Dra. Renata (exemplo)'],
    ])
    expect(emVigor(depois).itens[0].texto).toBe('Natureza e origem do impedimento')
    expect(versao(depois, 1)?.itens[0].texto).toBe('Natureza do impedimento')
    expect(loas.versoes).toHaveLength(1)
    expect(mudancas(versao(depois, 1)!, versao(depois, 2)!)).toBe('1 item alterado')
    expect(mudancas(versao(depois, 1)!, { ...versao(depois, 2)!, itens: [...editado, { id: 'n', tipo: 'complementar', texto: 'Novo' }] })).toBe(
      '1 item alterado, 1 item novo',
    )
  })

  it('CA2 · a edição só salva com um obrigatório e com o texto de cada item', () => {
    expect(motivoParaNaoSalvar(itens)).toBeNull()
    expect(motivoParaNaoSalvar(itens.filter((i) => i.tipo !== 'obrigatorio'))).toBe('O roteiro precisa de pelo menos um item obrigatório.')
    expect(motivoParaNaoSalvar([...itens, { id: 'v', tipo: 'complementar', texto: ' ' }])).toBe('Escreva o texto de cada item.')
    expect(motivoParaNaoSalvar([...itens, { id: 'l', tipo: 'complementar', texto: 'x'.repeat(301) }])).toBe('Cada texto vai até 300 letras.')
    expect(motivoParaNaoSalvar([{ ...itens[0], tipo: 'outro' as never }])).toBe('O roteiro precisa de pelo menos um item obrigatório.')
  })
})
