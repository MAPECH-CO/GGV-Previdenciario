import { describe, expect, it } from 'vitest'
import { CumprirItem, DecidirExigencia, DecidirVencida, RegistrarCobranca, ResponderExigencia } from './exigencia.ts'

const erro = (r: { error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message

describe('GGVP-39 · decidir a exigência', () => {
  it('CA1 e CA8 · documentos: itens, dias do INSS e prazo de entrega; linhas vazias somem', () => {
    expect(DecidirExigencia.parse({ pede: 'documentos', itens: ['CadÚnico', ' '], diasInss: '30', prazoEntrega: '20/10/2026' })).toEqual({
      pede: 'documentos',
      itens: [{ descricao: 'CadÚnico', tipoDocumento: null }],
      tiposPericia: [],
      diasInss: 30,
      prazoEntrega: '2026-10-20',
    })
  })

  it('CA8 · a escolha é obrigatória e cada uma pede o que precisa', () => {
    expect(erro(DecidirExigencia.safeParse({ diasInss: 30 }))).toBe('Escolha o que a exigência pede')
    expect(erro(DecidirExigencia.safeParse({ pede: 'documentos', itens: [], diasInss: 30, prazoEntrega: '20/10/2026' }))).toBe('Informe ao menos um documento pedido')
    expect(erro(DecidirExigencia.safeParse({ pede: 'pericia', diasInss: 30 }))).toBe('Escolha o tipo: perícia médica ou avaliação social')
    expect(erro(DecidirExigencia.safeParse({ pede: 'pericia_e_documentos', itens: ['Laudo'], tiposPericia: ['medica'], diasInss: 30 }))).toBe(
      'Informe o prazo de entrega da Documentação (dd/mm/aaaa)',
    )
    expect(DecidirExigencia.safeParse({ pede: 'pericia', tiposPericia: ['social'], diasInss: 30 }).success).toBe(true)
  })

  it('CA7 · os dias do INSS são inteiro de 1 a 120', () => {
    for (const d of ['0', '121', '1,5', 'trinta']) expect(erro(DecidirExigencia.safeParse({ pede: 'pericia', tiposPericia: ['medica'], diasInss: d }))).toBe('Informe o prazo que o INSS deu, em dias (1 a 120)')
  })
})

describe('GGVP-39 · Documentação e Sênior', () => {
  it('CA12 · cobrança com canal e resultado', () => {
    expect(RegistrarCobranca.parse({ canal: 'whatsapp', resultado: 'sem_resposta' })).toEqual({ canal: 'whatsapp', resultado: 'sem_resposta' })
    expect(erro(RegistrarCobranca.safeParse({ resultado: 'entregou' }))).toBe('Escolha o canal da cobrança')
  })

  it('CA11 · item não cumprido pede motivo', () => {
    expect(erro(CumprirItem.safeParse({ acao: 'nao_cumprido', motivo: ' ' }))).toBe('Escreva por que o item não foi cumprido')
    expect(CumprirItem.parse({ acao: 'cumprido' })).toEqual({ acao: 'cumprido' })
  })

  it('CA4 · data da resposta obrigatória e não futura', () => {
    expect(ResponderExigencia.parse({ dataResposta: '05/10/2026' })).toEqual({ dataResposta: '2026-10-05' })
    expect(erro(ResponderExigencia.safeParse({ dataResposta: '01/01/2099' }))).toBe('A data da resposta não pode ser no futuro')
  })

  it('CA14 · vencida: dilação com novo prazo ou perda com motivo', () => {
    expect(DecidirVencida.parse({ decisao: 'dilacao', novoPrazo: '30/10/2026' })).toEqual({ decisao: 'dilacao', novoPrazo: '2026-10-30' })
    expect(erro(DecidirVencida.safeParse({ decisao: 'perda', motivo: '' }))).toBe('Escreva o que aconteceu')
  })
})

describe('GGVP-125 · bloco 5d: o tipo de documento que cumpre o item', () => {
  it('o item vem como texto ou com o tipo; o tipo vazio vira nulo e o item sem texto some', () => {
    const itens = [{ descricao: 'Comprovante de residência', tipoDocumento: 'comprovante-residencia' }, 'CadÚnico', { descricao: 'Declaração', tipoDocumento: '' }, { descricao: ' ', tipoDocumento: 'rg' }]
    expect(DecidirExigencia.parse({ pede: 'documentos', itens, diasInss: '30', prazoEntrega: '20/10/2026' }).itens).toEqual([
      { descricao: 'Comprovante de residência', tipoDocumento: 'comprovante-residencia' },
      { descricao: 'CadÚnico', tipoDocumento: null },
      { descricao: 'Declaração', tipoDocumento: null },
    ])
  })
})
