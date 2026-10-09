import { describe, expect, it } from 'vitest'
import { AgendarIdaAoBanco, ConcluirIdaAoBanco, ReceberPrestacao, RegistrarEnvio, SalvarPrestacao } from './prestacao.ts'

const erro = (r: { error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message
const OK = { valorRecebido: '12.345,67', percentual: '30', formaPagamento: 'pix', prazoPagamento: '30/10/2026', conferiCarta: true }

describe('GGVP-44 · prestação de contas', () => {
  it('CA5 · valor em pt-BR, percentual e prazo; concluir exige a conferência com a carta', () => {
    expect(SalvarPrestacao.parse(OK)).toEqual({ valorRecebido: 12345.67, percentual: 30, formaPagamento: 'pix', prazoPagamento: '2026-10-30', conferiCarta: true })
    expect(erro(SalvarPrestacao.safeParse({ ...OK, conferiCarta: false }))).toBe('Marque "Conferi os valores com a carta de concessão"')
    expect(erro(SalvarPrestacao.safeParse({ ...OK, valorRecebido: '0' }))).toBe('Informe o valor recebido (atrasados), como 1.234,56')
    expect(erro(SalvarPrestacao.safeParse({ ...OK, percentual: '101' }))).toBe('Informe o percentual de honorários do contrato (0 a 100)')
  })

  it('forma de pagamento: opcional, mas só da lista', () => {
    expect(SalvarPrestacao.parse({ ...OK, formaPagamento: '' }).formaPagamento).toBeUndefined()
    expect(erro(SalvarPrestacao.safeParse({ ...OK, formaPagamento: 'Débito' }))).toBe('Escolha a forma de pagamento da lista')
  })

  it('CA9 · divergência pede o motivo', () => {
    expect(erro(ReceberPrestacao.safeParse({ resultado: 'divergencia', motivo: ' ' }))).toBe('Escreva qual é a divergência')
    expect(ReceberPrestacao.parse({ resultado: 'recebido', valoresConferem: true })).toEqual({ resultado: 'recebido', valoresConferem: true })
  })

  it('GGVP-98 CA3 · "Receber e lançar" só com os valores conferidos', () => {
    expect(erro(ReceberPrestacao.safeParse({ resultado: 'recebido' }))).toBe('Marque "Valores conferem com o comprovante"')
  })
})

describe('GGVP-44 · ida ao banco', () => {
  it('CA10 e GGVP-98 CA6 · data, hora, local e quem acompanha obrigatórios', () => {
    const ANA = '11111111-1111-4111-8111-111111111111'
    const ok = { data: '15/10/2026', hora: '10:00', local: 'Caixa, agência Centro', acompanhanteId: ANA }
    expect(AgendarIdaAoBanco.parse(ok)).toEqual({ data: '2026-10-15', hora: '10:00', local: 'Caixa, agência Centro', acompanhanteId: ANA })
    expect(erro(AgendarIdaAoBanco.safeParse({ ...ok, acompanhanteId: '' }))).toBe('Escolha quem do Atendimento acompanha o cliente')
    expect(erro(AgendarIdaAoBanco.safeParse({ ...ok, hora: '25:00' }))).toBe('Informe a hora (hh:mm)')
    expect(erro(AgendarIdaAoBanco.safeParse({ ...ok, local: '' }))).toBe('Informe a agência ou o local')
    expect(erro(AgendarIdaAoBanco.safeParse({ ...ok, acompanhanteId: 'Ana' }))).toBe('Escolha quem do Atendimento acompanha o cliente')
  })

  it('CA11 · o envio registra o canal', () => {
    expect(erro(RegistrarEnvio.safeParse({}))).toBe('Escolha o canal')
  })

  it('GGVP-98 · quem leva: "Levei" ou "Não deu" com o motivo', () => {
    expect(ConcluirIdaAoBanco.parse({ resultado: 'levado' })).toEqual({ resultado: 'levado' })
    expect(erro(ConcluirIdaAoBanco.safeParse({ resultado: 'nao_deu', motivo: ' ' }))).toBe('Escreva por que não deu')
    expect(erro(ConcluirIdaAoBanco.safeParse({ resultado: 'nao_deu' }))).toBe('Escreva por que não deu')
    expect(erro(ConcluirIdaAoBanco.safeParse({}))).toBe('Escolha "Levei o cliente ao banco" ou "Não deu"')
  })
})
