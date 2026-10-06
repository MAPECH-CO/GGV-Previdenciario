import { describe, expect, it } from 'vitest'
import { DecidirConferencia, DecidirPericia, DispensarParecer, EncerrarCaso, RegistrarProtocolo, RespostaDoInss } from './inss.ts'

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

describe('DecidirConferencia (GGVP-23)', () => {
  it('aprovar não pede nada; reprovar pede motivo e, com prazo, a data', () => {
    expect(DecidirConferencia.parse({ decisao: 'aprovar' })).toEqual({ decisao: 'aprovar' })
    expect(DecidirConferencia.parse({ decisao: 'reprovar', motivo: ' Falta o laudo ', temPrazo: true, prazo: '10/10/2026' })).toEqual({
      decisao: 'reprovar',
      motivo: 'Falta o laudo',
      temPrazo: true,
      prazo: '2026-10-10',
    })
    expect(DecidirConferencia.parse({ decisao: 'reprovar', motivo: 'Falta o laudo', temPrazo: false })).toMatchObject({ temPrazo: false })
  })

  it('CA8 · reprovar sem motivo, ou com prazo sem data, é recusado com mensagem clara', () => {
    const erro = (d: unknown) => DecidirConferencia.safeParse(d).error?.issues[0]?.message
    expect(erro({ decisao: 'reprovar', motivo: '  ', temPrazo: false })).toBe('Escreva o que o Atendimento precisa ajustar')
    expect(erro({ decisao: 'reprovar', motivo: 'x', temPrazo: true })).toBe('Informe a data do ajuste (dd/mm/aaaa)')
    expect(erro({ decisao: 'talvez' })).toBe('Escolha aprovar ou reprovar')
  })

  it('G17 · dispensar o parecer pede justificativa', () => {
    expect(DispensarParecer.safeParse({ justificativa: '' }).error?.issues[0]?.message).toBe('Escreva por que o parecer é dispensado')
  })
})

describe('RespostaDoInss (GGVP-35, GGVP-48)', () => {
  it('decisão deferida com o texto; indeferida pede o motivo do INSS', () => {
    expect(RespostaDoInss.parse({ tipo: 'decisao', resultado: 'deferido', texto: ' Benefício concedido ' })).toEqual({
      tipo: 'decisao',
      resultado: 'deferido',
      texto: 'Benefício concedido',
      diferenteDoPedido: false,
    })
    expect(RespostaDoInss.safeParse({ tipo: 'decisao', resultado: 'indeferido', texto: 'x' }).error?.issues[0]?.message).toBe(
      'Informe o motivo que consta no sistema do INSS',
    )
  })

  it('CA6 · exigência pede texto e data válida; sem tipo, pede a escolha', () => {
    expect(RespostaDoInss.parse({ tipo: 'exigencia', texto: 'Apresentar CNIS', data: '05/10/2026' })).toEqual({
      tipo: 'exigencia',
      texto: 'Apresentar CNIS',
      data: '2026-10-05',
    })
    expect(RespostaDoInss.safeParse({ tipo: 'exigencia', texto: 'x', data: '32/10/2026' }).error?.issues[0]?.message).toBe(
      'Informe a data da exigência (dd/mm/aaaa)',
    )
    expect(RespostaDoInss.safeParse({ texto: 'x' }).error?.issues[0]?.message).toBe('Escolha "Decisão" ou "Exigência"')
  })

  it('encerrar pede o motivo', () => {
    expect(EncerrarCaso.safeParse({ motivo: ' ' }).error?.issues[0]?.message).toBe('Escreva por que o caso é encerrado')
  })
})
