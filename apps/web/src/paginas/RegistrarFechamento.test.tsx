import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { registrarResultado } from '../dados/agenda.ts'
import { registrarFechamento } from '../dados/fechamento.ts'
import { configurarExemplo, gravar, ler, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { RegistrarFechamento } from './RegistrarFechamento.tsx'

beforeEach(async () => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
  await registrarResultado('natalia-entrevista', 'realizado')
})

async function abrir() {
  render(<RegistrarFechamento fichaId="natalia-exemplo" />)
  await screen.findByRole('heading', { level: 1, name: /Registrar fechamento/ })
}

const botao = (nome: RegExp | string) => screen.getByRole('button', { name: nome }) as HTMLButtonElement
const escolher = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } })

describe('Registrar fechamento (GGVP-60)', () => {
  it('CA5 · a decisão "Fechou com o escritório?" é obrigatória', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Natália Exemplo · Registrar fechamento')
    expect(screen.getByText('depois da entrevista de 04/10 · fechou com o escritório?')).toBeTruthy()
    expect(botao('Registrar e agendar retorno').disabled).toBe(true)
    expect(screen.getByText('Responda se fechou com o escritório.')).toBeTruthy()
    expect(screen.getByText('Todo lead que não vira cliente fica com o motivo registrado (G16).')).toBeTruthy()
  })

  it('CA5 · "Sim, fechou": vira cliente e segue para o kit do benefício', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Sim, fechou' }))
    expect(screen.getByText(/Natália vira cliente com Auxílio por Incapacidade Temporária/)).toBeTruthy()
    fireEvent.click(botao('Registrar fechamento'))
    expect(await screen.findByRole('heading', { name: '✓ Fechou com o escritório: Natália é cliente' })).toBeTruthy()
    expect((await obterFicha('natalia-exemplo'))?.situacao).toBe('cliente')
  })

  it('CA5 · sem o benefício definido pela advogada, "Sim, fechou" não segue', async () => {
    const banco = ler()
    banco.fichas.find((f) => f.id === 'natalia-exemplo')!.beneficioInteresse = 'nao-sei'
    gravar(banco)
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Sim, fechou' }))
    expect(screen.getByText('Falta o benefício definido pela advogada (D1.12).')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Definir o benefício (D1.12)' }).getAttribute('href')).toBe('/entrevista/natalia-entrevista/beneficio')
  })

  it('CA1, CA2, CA6 e CA12 · "Não fechou": o motivo da lista, e o recontato sugerido em 15 dias para quem ficou de pensar', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Não fechou' }))
    expect(screen.getByText('não fechou · por que não virou cliente')).toBeTruthy()
    expect(screen.getByText('Escolha o motivo: sem ele o lead não pode ser encerrado (G16).')).toBeTruthy()
    escolher('Motivo *', 'preco')
    escolher('Detalhe do motivo (opcional)', 'achou o valor alto')
    expect(screen.getByText('Responda se vale recontatar numa data prevista.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Sim, agendar recontato' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Ficou de pensar · 15 dias' }))
    expect((screen.getByLabelText('Recontatar em *') as HTMLInputElement).value).toBe('20/10/2026')
    fireEvent.click(screen.getByRole('radio', { name: 'Pediu para esperar · 30 dias' }))
    expect((screen.getByLabelText('Recontatar em *') as HTMLInputElement).value).toBe('04/11/2026')
    fireEvent.click(botao('Registrar e agendar retorno'))
    expect(await screen.findByRole('heading', { name: '✓ Registrado: recontatar em 04/11' })).toBeTruthy()
    expect(screen.getByText(/a tarefa "Recontatar lead" aparece na Central nesse dia/)).toBeTruthy()
  })

  it('CA7 · "Não, arquivar o lead": arquivado com o motivo; a data some', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Não fechou' }))
    escolher('Motivo *', 'outro-escritorio')
    fireEvent.click(screen.getByRole('radio', { name: 'Não, arquivar o lead' }))
    expect(screen.queryByLabelText('Recontatar em *')).toBeNull()
    fireEvent.click(botao('Registrar e arquivar o lead'))
    expect(await screen.findByRole('heading', { name: '✓ Lead arquivado com o motivo' })).toBeTruthy()
    expect(screen.getByText('Foi a outro escritório')).toBeTruthy()
  })

  it('CA11 · a recusa do escritório pede quem registra: Atendimento sênior ou advogada do atendimento', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Não fechou' }))
    escolher('Motivo *', 'recusado')
    fireEvent.click(screen.getByRole('radio', { name: 'Não, arquivar o lead' }))
    expect(botao('Registrar e arquivar o lead').disabled).toBe(true)
    expect(screen.getAllByText('A recusa do escritório é registrada pelo Atendimento sênior ou pela advogada do atendimento.').length).toBeGreaterThan(0)
    escolher('Quem registra a recusa *', 'atendimento-senior')
    fireEvent.click(botao('Registrar e arquivar o lead'))
    expect(await screen.findByText(/Você \(Atendimento sênior\)/)).toBeTruthy()
  })

  it('CA4 · o que ficou registrado aparece ao abrir de novo', async () => {
    await registrarFechamento('natalia-exemplo', { fechou: false, motivo: 'sem-retorno', papel: 'atendimento', recontatar: null })
    await abrir()
    expect(screen.getByRole('heading', { name: '✓ Lead arquivado com o motivo' })).toBeTruthy()
    expect(screen.getByText('Sem retorno')).toBeTruthy()
    expect(screen.getByText(/05\/10\/2026 14:32 · Você \(Atendimento\)/)).toBeTruthy()
    expect((screen.getByRole('radio', { name: 'Sim, fechou' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
