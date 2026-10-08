import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { registrarResultado } from '../dados/agenda.ts'
import { registrarFechamento } from '../dados/fechamento.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { Recontatar } from './Recontatar.tsx'

let agora = new Date(2026, 9, 5, 14, 32)

beforeEach(async () => {
  agora = new Date(2026, 9, 5, 14, 32)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
  await registrarResultado('natalia-entrevista', 'realizado')
  await registrarFechamento('natalia-exemplo', { fechou: false, motivo: 'sem-direito', papel: 'atendimento', recontatar: { data: '20/10/2026' } })
  agora = new Date(2026, 9, 20, 9, 0)
})

async function abrir() {
  render(<Recontatar fichaId="natalia-exemplo" />)
  await screen.findByRole('heading', { level: 1, name: /Recontatar lead/ })
}

const botao = (nome: string) => screen.getByRole('button', { name: nome }) as HTMLButtonElement

describe('Recontatar lead (GGVP-60)', () => {
  it('CA3 e CA8 · quem ainda não podia se aposentar volta ao cálculo; a tarefa traz o motivo, o cálculo e o contato', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Natália Exemplo · Recontatar lead')
    expect(screen.getByText('recontato de 20/10 · ainda não tem direito')).toBeTruthy()
    expect(screen.getByText('Ainda não podia se aposentar: o caso volta para o cálculo de tempo e pontos (D1.13).')).toBeTruthy()
    expect(screen.getByText('Último cálculo: nenhum registrado.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir o cálculo (D1.13)' }).getAttribute('href')).toBe('/entrevista/natalia-entrevista/calculo')
    fireEvent.click(botao('Ligar'))
    expect(screen.getByText('Ligue para (11) 90000-0003 (ligação simulada).')).toBeTruthy()
  })

  it('CA10 · "Quer seguir": o caso volta ao cálculo', async () => {
    await abrir()
    expect(botao('Registrar o recontato').disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Quer seguir: voltar ao cálculo (D1.13)' }))
    fireEvent.click(botao('Registrar o recontato'))
    expect(await screen.findByRole('heading', { name: '✓ O caso volta ao cálculo de tempo e pontos' })).toBeTruthy()
    expect((await obterFicha('natalia-exemplo'))?.fechamento?.situacao).toBe('recalcular')
  })

  it('CA10 e CA12 · "Ainda não": nova data, com a sugestão de 30 dias para quem pediu para esperar', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Ainda não: nova data' }))
    expect(screen.getByText('Escolha a nova data, de hoje em diante.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Pediu para esperar · 30 dias' }))
    expect((screen.getByLabelText('Recontatar em *') as HTMLInputElement).value).toBe('19/11/2026')
    fireEvent.click(botao('Registrar o recontato'))
    expect(await screen.findByRole('heading', { name: '✓ Novo recontato em 19/11' })).toBeTruthy()
  })

  it('CA10 e G16 · "Não vai seguir": arquiva com o motivo', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Não vai seguir: arquivar' }))
    expect(screen.getByText('Escolha o motivo para arquivar (G16).')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Motivo *'), { target: { value: 'desistiu' } })
    fireEvent.click(botao('Registrar o recontato'))
    expect(await screen.findByRole('heading', { name: '✓ Lead arquivado com o motivo' })).toBeTruthy()
    expect((await obterFicha('natalia-exemplo'))?.fechamento).toMatchObject({ situacao: 'arquivado', motivo: 'desistiu' })
  })

  it('CA9 · passou da data: o recontato continua aberto e aparece atrasado', async () => {
    agora = new Date(2026, 9, 22, 9, 0)
    await abrir()
    expect(screen.getByText('recontato atrasado, era 20/10 · ainda não tem direito')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Ainda não: nova data' })).toBeTruthy()
  })
})
