import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { registrarConfirmacao } from '../dados/confirmacao.ts'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { CentralAdvogada } from './CentralAdvogada.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

describe('Central da Advogada', () => {
  it('mostra a fila, as abas e os atalhos do chat da advogada', () => {
    render(<CentralAdvogada />)
    expect(screen.getByRole('heading', { name: 'O que você tem que fazer' })).toBeTruthy()
    expect(within(screen.getByRole('tabpanel')).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('tab', { name: 'Minhas tarefas (2)' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Tarefas do setor (12)' })).toBeTruthy()
    for (const nome of ['Resumo do caso', 'Criar tarefa', 'Perícias da semana', 'Como o perito avalia?', 'Gerar peça']) {
      expect(screen.getByRole('button', { name: nome })).toBeTruthy()
    }
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('href')).toBe('/advogada')
    expect(screen.getByText('Advogada')).toBeTruthy()
  })

  it('GGVP-32 CA1 · a entrevista de hoje aparece com os pontos de atenção', async () => {
    await registrarConfirmacao('josefa-entrevista', { resultado: 'confirmou', canal: 'ligacao', jaPreencheuFicha: true })
    render(<CentralAdvogada />)
    const preparar = screen.getByRole('link', { name: 'Josefa Exemplo · Preparar entrevista' })
    expect(preparar.getAttribute('href')).toBe('/entrevista/josefa-entrevista/preparar')
    expect(preparar.closest('li')?.textContent).toContain('LOAS Idoso · entrevista hoje 15:30 · ficha em papel · atenção: sem senha do gov.br e ficha não preenchida')
  })
})
