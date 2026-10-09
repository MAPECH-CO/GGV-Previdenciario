import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lerFichaEmPapel } from '../dados/fichaAtendimento.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import type { SenhaGov } from '../dados/tipos.ts'
import { CampoCofre } from './CampoCofre.tsx'

/** Senha de teste: não pode aparecer na tela nem no armazenamento depois de guardada (CA9). */
const SENHA_DE_TESTE = 'Teste#Senha-9137'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

function abrir(senhaGov: SenhaGov = { situacao: 'sem-senha' }) {
  const aoMudar = vi.fn()
  const r = render(<CampoCofre fichaId="josefa-exemplo" senhaGov={senhaGov} aoMudar={aoMudar} />)
  return { aoMudar, ...r }
}

describe('Componente do cofre', () => {
  it('CA8 · é um formulário à parte, com a senha mascarada', () => {
    abrir()
    const caixa = screen.getByLabelText('Digite a senha (vai direto ao cofre)') as HTMLInputElement
    expect(caixa.type).toBe('password')
    expect(caixa.form?.getAttribute('aria-label')).toBe('Cofre da senha do gov.br')
    expect(screen.getByText('gov.br: sem senha')).toBeTruthy()
  })

  it('CA2 e CA9 · guarda no cofre, esquece o valor e mostra só a situação', async () => {
    const { aoMudar, rerender } = abrir()
    fireEvent.change(screen.getByLabelText('Digite a senha (vai direto ao cofre)'), { target: { value: SENHA_DE_TESTE } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar no cofre' }))
    await waitFor(() => expect(aoMudar).toHaveBeenCalled())
    const senhaGov = aoMudar.mock.calls[0][0] as SenhaGov
    rerender(<CampoCofre fichaId="josefa-exemplo" senhaGov={senhaGov} aoMudar={aoMudar} />)
    expect(screen.getByText('gov.br: senha no cofre · atualizada em 05/10 por Você (Atendimento)')).toBeTruthy()
    expect((screen.getByLabelText('Trocar a senha (vai direto ao cofre)') as HTMLInputElement).value).toBe('')
    expect(document.body.innerHTML).not.toContain(SENHA_DE_TESTE)
    expect(JSON.stringify(sessionStorage)).not.toContain(SENHA_DE_TESTE)
    expect(JSON.stringify(await obterFicha('josefa-exemplo'))).not.toContain(SENHA_DE_TESTE)
  })

  it('CA3 · "Não sei a senha" deixa o alerta', async () => {
    const { aoMudar } = abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Não sei a senha' }))
    await waitFor(() => expect(aoMudar).toHaveBeenCalledWith({ situacao: 'sem-senha', naoSabe: true }))
  })

  it('CA15 · a senha lida do papel pede a conferência com o papel', async () => {
    await lerFichaEmPapel('josefa-exemplo')
    const ficha = await obterFicha('josefa-exemplo')
    const { aoMudar } = abrir(ficha!.senhaGov)
    expect(screen.getByText(/gov.br: senha no cofre · atualizada em 05\/10 por Leitura da ficha em papel \(IA\) · conferir com o papel/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Conferi a senha do cofre com o papel' }))
    await waitFor(() => expect(aoMudar).toHaveBeenCalledWith(expect.objectContaining({ situacao: 'no-cofre', por: 'Você (Atendimento)' })))
    expect(aoMudar.mock.calls[0][0].conferir).toBeUndefined()
  })
})
