import { describe, expect, it } from 'vitest'
import {
  CONFIANCA_MINIMA,
  baixaConfianca,
  compararComCadastro,
  ehMedico,
  menosLegivel,
  mesmaPessoa,
  motivoDaQuarentena,
  motivoParaNaoArquivar,
  quarentenaAntiga,
} from './leitura.ts'

const CPF = '00000000191'

describe('Leitura dos documentos (GGVP-81)', () => {
  it('CA7 · abaixo de 80% de confiança, a leitura pede atenção', () => {
    expect(CONFIANCA_MINIMA).toBe(80)
    expect(baixaConfianca(79)).toBe(true)
    expect(baixaConfianca(80)).toBe(false)
    expect(baixaConfianca(96)).toBe(false)
  })

  it('CA10 · mesma pessoa: nome igual sem acento, uma letra de diferença ou nome mais completo', () => {
    expect(mesmaPessoa('RITA EXEMPLO', 'Rita Exemplo')).toBe(true)
    expect(mesmaPessoa('Antonio Exemplo', 'Antônio Exemplo')).toBe(true)
    expect(mesmaPessoa('Rita Exenplo', 'Rita Exemplo')).toBe(true)
    expect(mesmaPessoa('Rita de Cássia Exemplo', 'Rita Exemplo')).toBe(true)
    expect(mesmaPessoa('Antônio Exemplo', 'Rita Exemplo')).toBe(false)
    expect(mesmaPessoa('', 'Rita Exemplo')).toBe(false)
  })

  it('CA10 · quarentena pelo CPF de outra pessoa ou pelo nome de outra pessoa', () => {
    const rita = { nome: 'Rita Exemplo' }
    expect(motivoDaQuarentena({ nome: 'Antônio Exemplo', cpf: CPF }, rita)).toBe('o nome lido é Antônio Exemplo, não Rita Exemplo')
    expect(motivoDaQuarentena({ nome: 'Rita de Cássia Exemplo' }, rita)).toBeUndefined()
    expect(motivoDaQuarentena({ cpf: '111.111.111-11' }, { nome: 'Antônio Exemplo', cpf: CPF })).toBe('o CPF lido (111.111.111-11) não é o do cliente')
    expect(motivoDaQuarentena({ nome: 'Antônio Exemplo', cpf: CPF }, { nome: 'Antônio Exemplo', cpf: CPF })).toBeUndefined()
    expect(motivoDaQuarentena({}, rita)).toBeUndefined()
  })

  it('CA3 e CA8 · cada dado lido ao lado do cadastro: igual, novo ou diverge', () => {
    const ficha = { nome: 'Rita Exemplo', cpf: CPF, rg: '00.000.000-0', endereco: undefined }
    expect(compararComCadastro({ nome: 'Rita de Cássia Exemplo', cpf: '000.000.001-91', rg: '000000000', endereco: 'Rua Exemplo, 100' }, ficha)).toEqual([
      { campo: 'nome', lido: 'Rita de Cássia Exemplo', cadastro: 'Rita Exemplo', situacao: 'diverge' },
      { campo: 'cpf', lido: '000.000.001-91', cadastro: CPF, situacao: 'igual' },
      { campo: 'rg', lido: '000000000', cadastro: '00.000.000-0', situacao: 'igual' },
      { campo: 'endereco', lido: 'Rua Exemplo, 100', cadastro: '', situacao: 'novo' },
    ])
    expect(compararComCadastro({}, ficha)).toEqual([])
  })

  it('CA9 · da dupla, sai a cópia menos legível; empatou, a que chegou depois', () => {
    const original = { id: 'a', confianca: 91 }
    expect(menosLegivel(original, { id: 'b', confianca: 74 }).id).toBe('b')
    expect(menosLegivel(original, { id: 'b', confianca: 91 }).id).toBe('b')
    expect(menosLegivel(original, { id: 'b', confianca: 95 }).id).toBe('a')
  })

  it('CA7 e CA9 · "Arquivar" só com a data certa, os duplicados decididos e a conferência marcada', () => {
    const pronto = { aConferir: 4, duplicados: 1, decisao: 'manter' as const, conferi: true, datasValidas: true }
    expect(motivoParaNaoArquivar(pronto)).toBeNull()
    expect(motivoParaNaoArquivar({ ...pronto, aConferir: 0 })).toBe('Nenhum documento para arquivar.')
    expect(motivoParaNaoArquivar({ ...pronto, datasValidas: false })).toBe('Corrija a data do documento (dd/mm/aaaa).')
    expect(motivoParaNaoArquivar({ ...pronto, decisao: undefined })).toBe('Decida o que fazer com o documento duplicado.')
    expect(motivoParaNaoArquivar({ ...pronto, duplicados: 0, decisao: undefined })).toBeNull()
    expect(motivoParaNaoArquivar({ ...pronto, conferi: false })).toBe('Marque "Conferi os documentos lidos pela IA".')
  })

  it('CA12 · o relatório pega a quarentena com mais de um dia, e não a de hoje nem a já resolvida', () => {
    const agora = new Date('2026-10-05T14:32:00')
    const docs = [
      { id: 'velha', situacao: 'quarentena', lidoEm: '2026-10-04T14:00:00' },
      { id: 'nova', situacao: 'quarentena', lidoEm: '2026-10-04T15:00:00' },
      { id: 'resolvida', situacao: 'movido', lidoEm: '2026-10-01T09:00:00' },
    ]
    expect(quarentenaAntiga(docs, agora).map((d) => d.id)).toEqual(['velha'])
  })

  it('CA16 · laudo, receita e prontuário são documentos médicos', () => {
    expect(['laudo', 'receita', 'prontuario', 'rg'].map(ehMedico)).toEqual([true, true, true, false])
  })

  it('GGVP-95 CA1 · os tipos médicos do cartão também são documento médico', () => {
    const medicos = ['atestado', 'relatorio-medico', 'exame', 'cat', 'boletim-ocorrencia', 'relatorio-escolar', 'relatorio-terapia']
    expect(medicos.every(ehMedico)).toBe(true)
    expect(['cnis', 'comprovante-renda'].some(ehMedico)).toBe(false)
  })
})
