import { describe, expect, it } from 'vitest'
import { EntradaDii, EntradaIncapacidade, EntradaLoas24, TentativasBloqueadas } from './governanca.ts'

const erros = (r: { error?: { issues: { message: string }[] } }) => r.error?.issues.map((i) => i.message)

describe('TentativasBloqueadas (GGVP-109 CA9)', () => {
  it('quem, quando, caso e portão; portão fora da lista é recusado', () => {
    const t = { quando: '2026-10-06T12:00:00.000Z', quem: 'Gabi', perfil: 'advogada', casoId: null, cliente: null, portao: 'G8', descricao: 'Aviso' }
    expect(TentativasBloqueadas.parse({ tentativas: [t] }).tentativas[0].portao).toBe('G8')
    expect(TentativasBloqueadas.safeParse({ tentativas: [{ ...t, portao: 'G99' }] }).success).toBe(false)
  })
})

describe('entradas das regras (GGVP-25)', () => {
  it('CA4 · dado que falta passa (a regra responde "não calculável"); data errada não', () => {
    expect(EntradaLoas24.parse({})).toEqual({})
    expect(EntradaLoas24.parse({ inicio: '10/03/2024', persiste: true })).toEqual({ inicio: '2024-03-10', persiste: true })
    expect(erros(EntradaLoas24.safeParse({ inicio: '31/02/2024' }))).toEqual(['Informe a data de início do impedimento (dd/mm/aaaa)'])
  })

  it('atestado com dias inteiros e a correlação marcada', () => {
    expect(erros(EntradaIncapacidade.safeParse({ atestados: [{ inicio: '01/09/2026', dias: 0, correlacionado: true }] }))).toEqual([
      'Os dias do atestado são um número inteiro maior que zero',
    ])
    expect(erros(EntradaIncapacidade.safeParse({ atestados: [{ inicio: '01/09/2026', dias: 5 }] }))).toEqual([
      'Marque se a doença do atestado é clinicamente correlacionada',
    ])
  })

  it('competência no formato mm/aaaa', () => {
    expect(EntradaDii.parse({ dii: '15/08/2026', competencias: ['01/2026'] })).toEqual({ dii: '2026-08-15', competencias: ['01/2026'] })
    expect(erros(EntradaDii.safeParse({ competencias: ['13/2026'] }))).toEqual(['Competência no formato mm/aaaa'])
  })
})

describe('DecidirLaco (GGVP-94 CA9)', () => {
  it('o que o setor deve fazer é obrigatório', async () => {
    const { DecidirLaco } = await import('./exigencia.ts')
    expect(DecidirLaco.parse({ oQueFazer: ' Ligar para a filha ' })).toEqual({ oQueFazer: 'Ligar para a filha' })
    expect(DecidirLaco.safeParse({ oQueFazer: ' ' }).error?.issues.map((i) => i.message)).toEqual(['Escreva o que o setor deve fazer'])
  })
})
