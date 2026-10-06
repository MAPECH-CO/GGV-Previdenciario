import { beforeEach, describe, expect, it } from 'vitest'
import { emVigor, versao } from '../regras/roteiro.ts'
import { BENEFICIOS } from './catalogos.ts'
import { obterRoteiro, obterRoteiros, roteiroDoCaso, salvarRoteiro } from './roteiro.ts'
import { configurarExemplo, ler, zerarExemplo } from './servidor.ts'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 6, 15, 10), latencia: 0 })
  zerarExemplo()
})

const SENIOR = { perfil: 'senior', nome: 'Dra. Renata (exemplo)' }

describe('Roteiros · servidor de exemplo', () => {
  it('CA1 · a semente traz a matriz do escritório, cada item com o tipo e o texto', async () => {
    const roteiros = await obterRoteiros()
    expect(roteiros.map((r) => [r.id, r.laudo])).toEqual([
      ['loas-deficiente', true],
      ['pcd', true],
      ['incapacidade-temporaria', true],
      ['incapacidade-permanente', true],
      ['auxilio-acidente', true],
      ['loas-idoso', false],
      ['aposentadorias-comuns', false],
      ['aposentadoria-especial', false],
      ['curatela', true],
      ['isencao-ir', true],
      ['loas-infantil', true],
    ])
    const loas = await obterRoteiro('loas-deficiente')
    expect(emVigor(loas!).itens.map((i) => [i.tipo, i.texto])).toEqual([
      ['obrigatorio', 'Natureza do impedimento (físico, mental, intelectual ou sensorial)'],
      ['obrigatorio', 'Data de início e se o quadro persiste'],
      ['obrigatorio', 'Prognóstico: duração prevista ou permanente'],
      ['obrigatorio', 'Limitações funcionais concretas'],
      ['obrigatorio', 'Barreiras: dependência de terceiros, acompanhamento contínuo, transporte, tratamento'],
      ['contradicao', 'Soma do início até a cessação prevista menor que 24 meses (calculada por código, G19)'],
      ['complementar', expect.stringContaining('Menor de 16 anos')],
      ['complementar', expect.stringContaining('Provas de gastos')],
    ])
    // Todo benefício da semente aponta para o catálogo único.
    expect(roteiros.flatMap((r) => r.beneficios).every((b) => BENEFICIOS.some((x) => x.id === b))).toBe(true)
  })

  it('CA3 · benefício fora de todo roteiro não tem roteiro', () => {
    const banco = ler()
    expect(roteiroDoCaso(banco, 'incapacidade-permanente-acidentaria')?.id).toBe('incapacidade-permanente')
    expect(roteiroDoCaso(banco, 'pensao-morte')).toBeUndefined()
    expect(roteiroDoCaso(banco, 'salario-maternidade')).toBeUndefined()
  })

  it('CA2 · a sênior salva e nasce a versão 2 com autor e data; a versão 1 continua lá', async () => {
    const loas = (await obterRoteiro('loas-deficiente'))!
    const itens = emVigor(loas).itens.map((i) => (i.id === 'prognostico' ? { ...i, texto: 'Prognóstico: duração prevista em meses, ou permanente' } : i))
    const salvo = await salvarRoteiro('loas-deficiente', itens, SENIOR)
    expect(salvo.versoes.map((v) => [v.versao, v.autor, v.quando])).toEqual([
      [1, 'Escritório (roteiro de laudos, 26/09)', new Date('2026-09-26T12:00:00').toISOString()],
      [2, 'Dra. Renata (exemplo)', new Date(2026, 9, 6, 15, 10).toISOString()],
    ])
    expect(versao(salvo, 1)!.itens[2].texto).toBe('Prognóstico: duração prevista ou permanente')
    expect(emVigor((await obterRoteiro('loas-deficiente'))!).itens[2].texto).toBe('Prognóstico: duração prevista em meses, ou permanente')
  })

  it('CA2 · só a sênior edita, e o servidor confere de novo', async () => {
    const itens = emVigor((await obterRoteiro('pcd'))!).itens
    await expect(salvarRoteiro('pcd', itens, { perfil: 'advogada', nome: 'Dra. Paula (exemplo)' })).rejects.toThrow('Só a sênior edita o roteiro.')
    await expect(salvarRoteiro('pcd', itens.filter((i) => i.tipo !== 'obrigatorio'), SENIOR)).rejects.toThrow('pelo menos um item obrigatório')
    await expect(salvarRoteiro('nao-existe', itens, SENIOR)).rejects.toThrow('Roteiro não encontrado')
    expect((await obterRoteiro('pcd'))!.versoes).toHaveLength(1)
  })
})
