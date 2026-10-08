import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { RenovarSenha } from './RenovarSenha.tsx'

/** Senha de teste: não pode aparecer na tela nem no armazenamento depois de guardada (CA5, G9). */
const SENHA_DE_TESTE = 'Teste#Renovada-4821'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function abrir() {
  render(<RenovarSenha agendamentoId="josefa-entrevista" />)
  await screen.findByRole('heading', { level: 1, name: /Renovar senha do gov.br/ })
}

const botao = (nome: string) => screen.getByRole('button', { name: nome }) as HTMLButtonElement

describe('Renovar senha do gov.br · tela do passo', () => {
  it('CA4 e CA10 · o título, o prazo da entrevista, o código no celular do cliente e "Guardar no cofre" parado', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Josefa Exemplo · Renovar senha do gov.br')
    expect(screen.getByText('antes da entrevista de hoje às 15:30')).toBeTruthy()
    expect(screen.getByText(/O código de verificação chega no celular do próprio cliente \(ou no e-mail dele\)/)).toBeTruthy()
    expect(screen.getByText('Renovar a senha do Meu INSS e guardar no cofre.')).toBeTruthy()
    expect(screen.getByText('Senha só no cofre; nunca em texto transcrito (G9).')).toBeTruthy()
    expect(botao('Guardar no cofre').disabled).toBe(true)
    expect(screen.getByText('Responda se conseguiu renovar.')).toBeTruthy()
  })

  it('CA2, CA5 e CA9 · "Sim": senha mascarada, a conferência do Meu INSS e só a situação depois de guardar', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }))
    const caixa = screen.getByLabelText('Nova senha do gov.br (vai direto ao cofre, G9)') as HTMLInputElement
    expect(caixa.type).toBe('password')
    fireEvent.change(caixa, { target: { value: SENHA_DE_TESTE } })
    expect(botao('Guardar no cofre').disabled).toBe(true)
    expect(screen.getByText('Confira que o Meu INSS abre e que o CNIS aparece.')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi que o Meu INSS abre e que o CNIS aparece' }))
    fireEvent.click(botao('Guardar no cofre'))
    expect(await screen.findByRole('heading', { name: '✓ senha no cofre · atualizada em 05/10 por Você (Atendimento)' })).toBeTruthy()
    expect(document.body.innerHTML).not.toContain(SENHA_DE_TESTE)
    expect(JSON.stringify(sessionStorage)).not.toContain(SENHA_DE_TESTE)
    expect((await obterFicha('josefa-exemplo'))?.senhaGov.funcionouEm).toBe('2026-10-05')
  })

  it('CA3 e CA6 · "Não": o motivo e o aviso são obrigatórios; o aviso fica registrado e a entrevista segue', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Não' }))
    expect(screen.queryByLabelText(/Nova senha/)).toBeNull()
    expect(botao('Registrar').disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Por que não foi possível *'), { target: { value: 'o celular cadastrado não é mais dela' } })
    expect(screen.getByText('Avise o cliente e marque o aviso.')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: /Avisei o cliente/ }))
    fireEvent.click(botao('Registrar'))
    expect(await screen.findByRole('heading', { name: '✓ Registrado: não foi possível renovar' })).toBeTruthy()
    expect(screen.getByText(/O aviso ao cliente ficou em "Últimos contatos". A entrevista segue no horário marcado/)).toBeTruthy()
    expect((await obterFicha('josefa-exemplo'))?.contatos.at(-1)?.canal).toBe('Aviso')
  })

  it('trocar de "Sim" para "Não" apaga a senha digitada', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }))
    fireEvent.change(screen.getByLabelText('Nova senha do gov.br (vai direto ao cofre, G9)'), { target: { value: SENHA_DE_TESTE } })
    fireEvent.click(screen.getByRole('radio', { name: 'Não' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }))
    expect((screen.getByLabelText('Nova senha do gov.br (vai direto ao cofre, G9)') as HTMLInputElement).value).toBe('')
  })
})
