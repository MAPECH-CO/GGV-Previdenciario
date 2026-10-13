import { describe, expect, it } from 'vitest'
import {
  AcordoDoContrato,
  AgendarIdaAoBanco,
  ConcluirIdaAoBanco,
  MSG_CAIXA_ACIMA,
  MSG_HONORARIOS_ACIMA,
  MSG_VALOR_DA_PARCELA,
  ReceberPrestacao,
  RegistrarEnvio,
  SalvarPrestacao,
  calcularPrestacao,
} from './prestacao.ts'

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

describe('GGVP-158 P6.2, P6.3 · o combinado do contrato e a prestação editável', () => {
  it('P6.2 · a entrada e as parcelas, quantas e o valor de cada uma, em pt-BR; sem parcelas, nulo', () => {
    expect(AcordoDoContrato.parse({ entrada: '500,00', parcelas: { quantidade: '4', valor: '300,00' } })).toEqual({ entrada: 500, parcelas: { quantidade: 4, valor: 300 } })
    expect(AcordoDoContrato.parse({ entrada: '0', parcelas: null })).toEqual({ entrada: 0, parcelas: null })
    expect(erro(AcordoDoContrato.safeParse({ entrada: '500,00', parcelas: { quantidade: '4', valor: 'abc' } }))).toBe(MSG_VALOR_DA_PARCELA)
    expect(erro(AcordoDoContrato.safeParse({ entrada: '500,00', parcelas: { quantidade: '0', valor: '300,00' } }))).toBe('Informe quantas parcelas (de 1 a 60)')
    expect(erro(AcordoDoContrato.safeParse({ entrada: '-1', parcelas: null }))).toBe('Informe o valor da entrada, como 1.234,56')
  })

  it('P6.3 · Pix e boleto; transferência e dinheiro não entram mais', () => {
    expect(SalvarPrestacao.parse({ ...OK, formaPagamento: 'boleto' }).formaPagamento).toBe('boleto')
    for (const forma of ['dinheiro', 'transferencia']) expect(erro(SalvarPrestacao.safeParse({ ...OK, formaPagamento: forma }))).toBe('Escolha a forma de pagamento da lista')
  })

  it('P6.3 · os honorários ajustados, o combinado e a parte na Caixa; os honorários vão até o recebido, e a Caixa até os honorários', () => {
    const ajustada = SalvarPrestacao.parse({ ...OK, honorarios: '3.000,00', entrada: '500,00', parcelas: { quantidade: '4', valor: '300,00' }, parteNaCaixa: '1.000,00' })
    expect([ajustada.honorarios, ajustada.entrada, ajustada.parcelas, ajustada.parteNaCaixa]).toEqual([3000, 500, { quantidade: 4, valor: 300 }, 1000])
    expect(SalvarPrestacao.parse({ ...OK, honorarios: '', parteNaCaixa: '' })).toMatchObject({ honorarios: undefined, parteNaCaixa: undefined })
    expect(erro(SalvarPrestacao.safeParse({ ...OK, honorarios: '12.345,68' }))).toBe(MSG_HONORARIOS_ACIMA)
    // Sem ajuste, a Caixa vai até os honorários pelo percentual: 30% de 12.345,67 = 3.703,70.
    expect(erro(SalvarPrestacao.safeParse({ ...OK, parteNaCaixa: '3.703,71' }))).toBe(MSG_CAIXA_ACIMA)
    expect(SalvarPrestacao.safeParse({ ...OK, parteNaCaixa: '3.703,70' }).success).toBe(true)
    expect(erro(SalvarPrestacao.safeParse({ ...OK, honorarios: '1.000,00', parteNaCaixa: '1.000,01' }))).toBe(MSG_CAIXA_ACIMA)
  })

  it('P6.3 · com o ajuste, vale o valor de quem conferiu, e o repasse fecha em centavos', () => {
    expect(calcularPrestacao(12_345.67, 30, 3_000)).toEqual({ valorRecebido: '12345.67', honorarios: '3000.00', repasse: '9345.67' })
    expect(calcularPrestacao(0.1 + 0.2, 50, 0.1)).toEqual({ valorRecebido: '0.30', honorarios: '0.10', repasse: '0.20' })
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
