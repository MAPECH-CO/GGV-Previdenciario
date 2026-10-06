import { describe, expect, it } from 'vitest'
import { DecidirPericia, RegistrarProtocolo } from './inss.ts'

describe('RegistrarProtocolo (GGVP-27 CA4)', () => {
  it('aceita número, DER em dd/mm/aaaa e a conferência marcada; guarda só dígitos e a data em ISO', () => {
    expect(RegistrarProtocolo.parse({ numero: '1234.567-8', der: '05/10/2026', revisado: true })).toEqual({
      numero: '12345678',
      der: '2026-10-05',
      revisado: true,
    })
  })

  it('recusa com mensagem clara cada obrigatório que falta', () => {
    const erros = (dados: unknown) => RegistrarProtocolo.safeParse(dados).error?.issues.map((i) => i.message)
    expect(erros({ numero: '', der: '05/10/2026', revisado: true })).toEqual(['Informe o número do requerimento'])
    expect(erros({ numero: '1', der: '31/02/2026', revisado: true })).toEqual(['Informe a data de entrada do requerimento (dd/mm/aaaa)'])
    expect(erros({ numero: '1', der: '05/10/2026', revisado: false })).toEqual(['Marque "Revisei o requerimento antes de enviar"'])
  })
})

describe('DecidirPericia (GGVP-31 CA5)', () => {
  it('sem perícia, ou com um ou dois tipos', () => {
    expect(DecidirPericia.parse({ precisa: false })).toEqual({ precisa: false })
    expect(DecidirPericia.parse({ precisa: true, tipos: ['medica', 'social'] })).toEqual({ precisa: true, tipos: ['medica', 'social'] })
  })

  it('recusa sem resposta e "sim" sem tipo', () => {
    expect(DecidirPericia.safeParse({}).success).toBe(false)
    expect(DecidirPericia.safeParse({ precisa: true, tipos: [] }).error?.issues[0]?.message).toBe('Escolha a perícia médica, a avaliação social ou as duas')
  })
})
