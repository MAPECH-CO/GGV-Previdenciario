import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { configurarExemplo, obterFicha, tarefasDoSetor, zerarExemplo } from '../dados/servidor.ts'
import { AnalisarFicha } from './AnalisarFicha.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function abrir() {
  render(<AnalisarFicha agendamentoId="josefa-entrevista" />)
  await screen.findByRole('heading', { level: 1, name: /Analisar ficha/ })
}

const confirmar = () => screen.getByRole('button', { name: 'Confirmar' }) as HTMLButtonElement

describe('Analisar ficha · tela do passo', () => {
  it('o título e as opções do Figma, a senha só pela situação e "Confirmar" parado sem resposta', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Josefa Exemplo · Analisar ficha')
    expect(screen.getByText('acidentário e senha do gov.br')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Sim — abrir 2ª ficha' })).toBeTruthy()
    expect(screen.getByText('gov.br: sem senha')).toBeTruthy()
    expect(screen.getByText('A senha do gov.br vai para o cofre, nunca em texto (G9).')).toBeTruthy()
    expect(confirmar().disabled).toBe(true)
  })

  it('CA1 e CA4 · "Sim" registra a decisão e o Atendimento recebe a segunda ficha com o prazo', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Sim — abrir 2ª ficha' }))
    fireEvent.click(confirmar())
    expect(await screen.findByRole('heading', { name: '✓ Análise registrada às 14:32' })).toBeTruthy()
    expect(screen.getByText(/O Atendimento recebeu: "Preencher segunda ficha" até 15:30/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar à preparação' }).getAttribute('href')).toBe('/entrevista/josefa-entrevista/preparar')
    expect(tarefasDoSetor('Atendimento').map((t) => t.acao)).toContain('Preencher segunda ficha')
    expect((await obterFicha('josefa-exemplo'))?.analise).toMatchObject({ acidentario: true, quem: 'Você (Advogada)' })
  })

  it('CA4 · "Não" também fica registrado', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Não' }))
    fireEvent.click(confirmar())
    expect(await screen.findByRole('heading', { name: /Análise registrada/ })).toBeTruthy()
    expect((await obterFicha('josefa-exemplo'))?.historico.at(-1)?.oQue).toBe('Analisou a ficha: não é auxílio acidentário')
  })
})
