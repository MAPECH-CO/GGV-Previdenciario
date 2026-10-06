import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { definirBeneficio } from '../dados/beneficio.ts'
import { encerrarGravacao, iniciarGravacao, transcrever } from '../dados/entrevista.ts'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { MENSAGENS_DO_CALCULO } from '../regras/calculo.ts'
import { CalcularTempo } from './CalcularTempo.tsx'
import { FichaCliente } from './FichaCliente.tsx'

const JOSEFA = 'josefa-entrevista'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function comBeneficio(beneficio: string) {
  const g = await iniciarGravacao(JOSEFA, { avisei: true })
  await encerrarGravacao(g.id, { aos: 140, online: true })
  await transcrever(g.id)
  await definirBeneficio(JOSEFA, { beneficio, conferi: true })
}

async function abrir() {
  render(<CalcularTempo agendamentoId={JOSEFA} />)
  await screen.findByRole('heading', { level: 1, name: /Calcular tempo e pontos/ })
}

const botao = (nome: string) => screen.getByRole('button', { name: nome }) as HTMLButtonElement
const digitar = (rotulo: string, valor: string) => {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } })
  fireEvent.blur(screen.getByLabelText(rotulo))
}

function preencher(anos: string, meses: string, dias: string, pontos: string) {
  digitar('Anos', anos)
  digitar('Meses', meses)
  digitar('Dias', dias)
  digitar('Pontos *', pontos)
  fireEvent.change(screen.getByLabelText('Regra aplicada *'), { target: { value: 'Transição por pontos (EC 103, art. 15)' } })
}

describe('Calcular tempo e pontos · tela do passo', () => {
  it('CA4, CA5 e CA7 · o CNIS do caso com a origem e a data; "Concluir" só com a decisão e a conferência', async () => {
    await comBeneficio('aposentadoria-idade')
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Josefa Exemplo · Calcular tempo e pontos')
    expect(screen.getByText('CNIS baixado do Meu INSS · extraído em 02/10')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Vínculos do CNIS' })).getAllByRole('listitem').map((l) => l.textContent)).toEqual([
      'Exemplo Comércio Ltda01/2012 a 12/2016',
      'Exemplo Limpeza Ltda03/2019 a 05/2026',
    ])
    expect(screen.getByText('informada pelo advogado, conferida com o CNIS; nunca pela IA (G19)')).toBeTruthy()
    expect(botao('Concluir').disabled).toBe(true)
    expect(screen.getByText('Preencha o tempo de contribuição.')).toBeTruthy()
    preencher('18', '4', '0', '79,5')
    expect(screen.getByText('Responda «Já pode se aposentar?».')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }))
    expect(screen.getByText('Marque «Conferi o cálculo com o CNIS».')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi o cálculo com o CNIS' }))
    fireEvent.click(botao('Concluir'))
    expect(await screen.findByRole('heading', { name: '✓ Cálculo registrado: 18 anos e 4 meses, 79,5 pontos' })).toBeTruthy()
  })

  it('CA2 e CA6 · refazer com "Ainda não" pede a data prevista e mostra o cálculo anterior', async () => {
    await comBeneficio('aposentadoria-idade')
    await abrir()
    preencher('18', '4', '0', '79,5')
    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi o cálculo com o CNIS' }))
    fireEvent.click(botao('Concluir'))
    fireEvent.click(await screen.findByRole('button', { name: 'Refazer o cálculo' }))
    preencher('14', '2', '10', '74')
    fireEvent.click(screen.getByRole('radio', { name: 'Ainda não' }))
    expect(screen.getByText('Escreva a data prevista em que poderá se aposentar.')).toBeTruthy()
    digitar('Data prevista em que poderá se aposentar *', '15/03/2028')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi o cálculo com o CNIS' }))
    fireEvent.click(botao('Concluir'))
    await screen.findByRole('heading', { name: '✓ Cálculo registrado: 14 anos, 2 meses e 10 dias, 74,0 pontos' })
    expect(screen.getByText(/Ainda não pode se aposentar: previsto para 15\/03\/2028\. O caso segue para «Registrar o motivo» \(D1\.14\)/)).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Cálculos anteriores' }).textContent).toContain('18 anos e 4 meses, 79,5 pontos')
  })

  it('número fora do limite mostra a mensagem', async () => {
    await comBeneficio('aposentadoria-idade')
    await abrir()
    digitar('Pontos *', '250')
    expect(screen.getByText(MENSAGENS_DO_CALCULO.pontos)).toBeTruthy()
  })

  it('CA3 · benefício sem cálculo: o passo não se aplica', async () => {
    await comBeneficio('loas-idoso')
    await abrir()
    expect(screen.getByRole('heading', { name: 'Este passo não se aplica' })).toBeTruthy()
    expect(screen.getByText(/LOAS Idoso não exige cálculo/)).toBeTruthy()
    expect((screen.getByRole('radio', { name: 'Sim' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('sem benefício definido, leva à definição', async () => {
    await abrir()
    expect(screen.getByRole('link', { name: 'Definir o benefício (D1.12)' }).getAttribute('href')).toBe(`/entrevista/${JOSEFA}/beneficio`)
  })

  it('CA1 · a ficha do cliente mostra o passo obrigatório antes do fechamento', async () => {
    await comBeneficio('aposentadoria-idade')
    render(<FichaCliente id="josefa-exemplo" />)
    expect(await screen.findByText('Calcular tempo e pontos (D1.13): obrigatório antes do fechamento')).toBeTruthy()
    expect(screen.getByText('Caso novo · sem processo ainda')).toBeTruthy()
  })
})
