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
  it('GGVP-101 CA7 · a cobrança do Antônio, no limite, chega à sênior como "Decidir cobrança"', () => {
    render(<CentralAdvogada />)
    expect(screen.getByRole('link', { name: 'Antônio Exemplo · Decidir cobrança' }).getAttribute('href')).toBe('/casos/antonio-exemplo-1/cobranca/decidir')
  })

  it('GGVP-20 · o laudo novo do Antônio e o parecer da Rita nascem do caso, com a tela de cada um', () => {
    render(<CentralAdvogada />)
    const laudo = screen.getByRole('link', { name: 'Antônio Exemplo · Analisar laudo novo' })
    expect(laudo.getAttribute('href')).toBe('/casos/antonio-exemplo-1/laudo-novo')
    expect(laudo.closest('li')?.textContent).toContain('enviado pelo Atendimento em 29/09 · resumo e comparação da IA prontos')
    const parecer = screen.getByRole('link', { name: 'Rita Exemplo · Dar parecer médico' })
    expect(parecer.getAttribute('href')).toBe('/casos/rita-exemplo-1/parecer')
    expect(parecer.closest('li')?.textContent).toContain('LOAS Deficiente · a IA sugere Insuficiente · confira item a item (G17)')
  })

  it('mostra a fila, as abas e os atalhos do chat da advogada', () => {
    render(<CentralAdvogada />)
    expect(screen.getByRole('heading', { name: 'O que você tem que fazer' })).toBeTruthy()
    expect(within(screen.getByRole('tabpanel')).getAllByRole('listitem')).toHaveLength(7)
    expect(screen.getByRole('tab', { name: 'Minhas tarefas (7)' }).getAttribute('aria-selected')).toBe('true')
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
