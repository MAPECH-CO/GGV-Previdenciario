import { describe, expect, it } from 'vitest'
import { contarIndicios } from './auditar-modelos.ts'
import { limparNumerosDoXml } from './limpar-copias-modelos.ts'

describe('auditoria local dos modelos, com dados inventados', () => {
  it('conta variáveis e indícios sem devolver o texto', () => {
    const c = contarIndicios('{{NOME COMPLETO}} CPF 000.000.000-00 RG 00.000.000-0 CEP 00000-000 telefone (00) 00000-0000. Contratante: Pessoa Inventada')
    expect(c).toMatchObject({ variaveis: 1, cpf: 1, rg: 1, cep: 1, nomesEmQualificacao: 1 })
    expect(Object.values(c).every(v => typeof v === 'number')).toBe(true)
  })
  it('limpa números repartidos em runs, preservando variáveis e formatação', () => {
    const xml = '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{{NOME COMPLETO}} 00000-</w:t></w:r><w:r><w:t>000 (00) 00000-0000</w:t></w:r></w:p>'
    const limpo = limparNumerosDoXml(xml)
    expect(limpo).toContain('<w:rPr><w:b/></w:rPr>')
    expect(limpo).toContain('{{NOME COMPLETO}}')
    expect(limpo).not.toContain('00000')
    expect(limparNumerosDoXml(limpo)).toBe(limpo)
  })
})
