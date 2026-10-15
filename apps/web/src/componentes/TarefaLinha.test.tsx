import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Tarefa } from '../dados/tipos.ts'
import { TarefaLinha } from './TarefaLinha.tsx'

const tarefa: Tarefa = {
  id: 't1',
  codigo: 'DP.03',
  cliente: { id: 'maria', nome: 'Maria das Graças Oliveira' },
  acao: 'Cobrar documento',
  detalhe: 'Auxílio por incapacidade temporária · perícia 02/10',
  prazo: 'vence hoje',
  urgente: true,
  href: '/casos/maria-1/cobranca',
}

const desenhar = (t: Tarefa) =>
  render(
    <ul>
      <TarefaLinha tarefa={t} />
    </ul>,
  )

describe('TarefaLinha', () => {
  it('mostra cliente, ação, detalhe e prazo; o código do passo do BPMN não aparece (11/10)', () => {
    desenhar(tarefa)
    expect(screen.queryByText('DP.03')).toBeNull()
    expect(screen.getByText('Maria das Graças Oliveira')).toBeTruthy()
    expect(screen.getByText(/Cobrar documento/)).toBeTruthy()
    expect(screen.getByText('Auxílio por incapacidade temporária · perícia 02/10')).toBeTruthy()
    expect(screen.getByText(/vence hoje/)).toBeTruthy()
  })

  it('a linha abre o passo e o nome abre a ficha, em links separados', () => {
    const { container } = desenhar(tarefa)
    const passo = screen.getByRole('link', { name: 'Maria das Graças Oliveira · Cobrar documento' })
    const ficha = screen.getByRole('link', { name: 'Maria das Graças Oliveira' })
    expect(passo.getAttribute('href')).toBe('/casos/maria-1/cobranca')
    expect(ficha.getAttribute('href')).toBe('/clientes/maria')
    expect(passo.contains(ficha)).toBe(false)
    expect(container.querySelector('a a')).toBeNull()
  })

  it('CA4 (Pedro, 14/10) · sem tela própria, a linha abre a ficha; sem cliente, não é link; nunca a "tela não construída"', () => {
    const { unmount } = desenhar({ ...tarefa, href: undefined })
    expect(screen.getByRole('link', { name: 'Maria das Graças Oliveira · Cobrar documento' }).getAttribute('href')).toBe('/clientes/maria')
    unmount()
    desenhar({ ...tarefa, href: undefined, cliente: null, contexto: 'Vigília das publicações' })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText(/Cobrar documento/)).toBeTruthy()
  })

  it('tarefa urgente avisa o leitor de tela; a comum não', () => {
    const { unmount } = desenhar(tarefa)
    expect(screen.getByText('Urgente:', { exact: false })).toBeTruthy()
    unmount()
    desenhar({ ...tarefa, urgente: false })
    expect(screen.queryByText('Urgente:', { exact: false })).toBeNull()
  })

  it('tarefa sem cliente usa o contexto e não cria link de ficha', () => {
    desenhar({ ...tarefa, cliente: null, contexto: 'Balcão', acao: 'Receber quem chegou' })
    expect(screen.getByText('Balcão')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Balcão' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Balcão · Receber quem chegou' })).toBeTruthy()
  })

  it('sem prazo, não desenha o prazo', () => {
    desenhar({ ...tarefa, prazo: undefined, urgente: false })
    expect(screen.queryByText(/vence hoje/)).toBeNull()
  })
})
