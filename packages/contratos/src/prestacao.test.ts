import { describe, expect, it } from 'vitest'
import { AgendarIdaAoBanco, ReceberPrestacao, RegistrarEnvio, SalvarPrestacao } from './prestacao.ts'

const erro = (r: { error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message
const OK = { valorRecebido: '12.345,67', percentual: '30', formaPagamento: 'Pix', prazoPagamento: '30/10/2026', conferiCarta: true }

describe('GGVP-44 · prestação de contas', () => {
  it('CA5 · valor em pt-BR, percentual e prazo; concluir exige a conferência com a carta', () => {
    expect(SalvarPrestacao.parse(OK)).toEqual({ valorRecebido: 12345.67, percentual: 30, formaPagamento: 'Pix', prazoPagamento: '2026-10-30', conferiCarta: true })
    expect(erro(SalvarPrestacao.safeParse({ ...OK, conferiCarta: false }))).toBe('Marque "Conferi os valores com a carta de concessão"')
    expect(erro(SalvarPrestacao.safeParse({ ...OK, valorRecebido: '0' }))).toBe('Informe o valor recebido (atrasados), como 1.234,56')
    expect(erro(SalvarPrestacao.safeParse({ ...OK, percentual: '101' }))).toBe('Informe o percentual de honorários do contrato (0 a 100)')
  })

  it('CA9 · divergência pede o motivo', () => {
    expect(erro(ReceberPrestacao.safeParse({ resultado: 'divergencia', motivo: ' ' }))).toBe('Escreva qual é a divergência')
    expect(ReceberPrestacao.parse({ resultado: 'recebido' })).toEqual({ resultado: 'recebido' })
  })
})

describe('GGVP-44 · ida ao banco', () => {
  it('CA10 · data, hora, local e acompanhante obrigatórios', () => {
    const ok = { data: '15/10/2026', hora: '10:00', local: 'Caixa, agência Centro', acompanhante: 'Ana (Atendimento)' }
    expect(AgendarIdaAoBanco.parse(ok)).toEqual({ ...ok, data: '2026-10-15' })
    expect(erro(AgendarIdaAoBanco.safeParse({ ...ok, hora: '25:00' }))).toBe('Informe a hora (hh:mm)')
    expect(erro(AgendarIdaAoBanco.safeParse({ ...ok, acompanhante: '' }))).toBe('Informe quem acompanha o cliente')
  })

  it('CA11 · o envio registra o canal', () => {
    expect(erro(RegistrarEnvio.safeParse({}))).toBe('Escolha o canal')
  })
})
