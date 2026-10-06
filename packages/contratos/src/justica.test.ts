import { describe, expect, it } from 'vitest'
import { ClassificarPublicacao, VincularPublicacao } from './justica.ts'

const erro = (r: { error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message
const CNJ_VALIDO = '0001234-96.2026.4.03.6301'

describe('GGVP-34 · classificar a publicação', () => {
  it('andamento não pede prazo', () => {
    expect(ClassificarPublicacao.parse({ classe: 'andamento' })).toEqual({ classe: 'andamento', dias: null })
  })

  it('exigência e mérito pedem os dias; sem prazo na decisão vira 5 (CPC, art. 218, §3º)', () => {
    expect(ClassificarPublicacao.parse({ classe: 'exigencia', dias: '15' })).toEqual({ classe: 'exigencia', dias: 15 })
    expect(ClassificarPublicacao.parse({ classe: 'merito', semPrazoNaDecisao: true })).toEqual({ classe: 'merito', dias: 5 })
    expect(erro(ClassificarPublicacao.safeParse({ classe: 'exigencia' }))).toBe(
      'Informe o prazo da publicação, em dias (1 a 120), ou marque "sem prazo na decisão"',
    )
    expect(erro(ClassificarPublicacao.safeParse({ classe: 'merito', dias: '0' }))).toBe(
      'Informe o prazo da publicação, em dias (1 a 120), ou marque "sem prazo na decisão"',
    )
    expect(erro(ClassificarPublicacao.safeParse({}))).toBe('Escolha o tipo de ato')
  })
})

describe('GGVP-26 CA8 · vincular um item da fila', () => {
  it('vincular exige CNJ válido e guarda só os dígitos', () => {
    expect(VincularPublicacao.parse({ decisao: 'vincular', numeroCnj: CNJ_VALIDO })).toEqual({ decisao: 'vincular', numeroCnj: '00012349620264036301' })
    expect(erro(VincularPublicacao.safeParse({ decisao: 'vincular', numeroCnj: '0001234-55.2026.4.03.6301' }))).toBe(
      'Número CNJ inválido. Confira os 20 dígitos.',
    )
  })

  it('ou registra que não é do escritório', () => {
    expect(VincularPublicacao.parse({ decisao: 'fora_do_escritorio' })).toEqual({ decisao: 'fora_do_escritorio' })
  })
})
