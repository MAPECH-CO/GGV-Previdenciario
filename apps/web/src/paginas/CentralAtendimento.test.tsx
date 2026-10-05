import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CentralAtendimento } from './CentralAtendimento.tsx'

describe('Central do Atendimento', () => {
  it('mostra a fila de 14 tarefas e os totais nas abas', () => {
    render(<CentralAtendimento />)
    expect(screen.getByRole('heading', { name: 'O que você tem que fazer' })).toBeTruthy()
    expect(within(screen.getByRole('tabpanel')).getAllByRole('listitem')).toHaveLength(14)
    expect(screen.getByRole('tab', { name: 'Minhas tarefas (14)' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Tarefas do setor (9)' }).getAttribute('aria-selected')).toBe('false')
  })

  it('marca o Início como página atual e oferece o novo cliente', () => {
    render(<CentralAtendimento />)
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Agenda' }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('link', { name: '+ Novo cliente' })).toBeTruthy()
  })

  it('troca de aba com o clique e com as setas do teclado', () => {
    render(<CentralAtendimento />)
    const setor = screen.getByRole('tab', { name: 'Tarefas do setor (9)' })
    fireEvent.click(setor)
    expect(setor.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Tarefas do setor: tela ainda não construída.')).toBeTruthy()

    fireEvent.keyDown(setor, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: 'Minhas tarefas (14)' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { name: 'O que você tem que fazer' })).toBeTruthy()
  })

  it('a sugestão do chat preenche o campo e não envia', () => {
    render(<CentralAtendimento />)
    fireEvent.click(screen.getByRole('button', { name: 'Documentos que faltam' }))
    const campo = screen.getByLabelText('✦ Pergunte ou peça') as HTMLTextAreaElement
    expect(campo.value).toBe('Documentos que faltam')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('enviar sem servidor avisa e mantém o texto, em vez de fingir que enviou', () => {
    render(<CentralAtendimento />)
    const campo = screen.getByLabelText('✦ Pergunte ou peça') as HTMLTextAreaElement
    fireEvent.change(campo, { target: { value: 'Qual é a próxima tarefa da Josefa?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(screen.getByRole('status').textContent).toContain('ainda não está ligado')
    expect(campo.value).toBe('Qual é a próxima tarefa da Josefa?')
  })

  it('enviar com o campo vazio não faz nada', () => {
    render(<CentralAtendimento />)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('a busca é um campo de busca com nome acessível', () => {
    render(<CentralAtendimento />)
    expect(screen.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' })).toBeTruthy()
  })

  it('mostra a aba "✦ Suporte"', () => {
    render(<CentralAtendimento />)
    expect(screen.getByRole('button', { name: '✦ Suporte' })).toBeTruthy()
  })

  it('botões ainda não ligados avisam que estão indisponíveis e não prometem janela', () => {
    render(<CentralAtendimento />)
    for (const nome of ['✦ Suporte', '+ Anexar arquivo', 'Gravar áudio']) {
      expect(screen.getByRole('button', { name: nome }).getAttribute('aria-disabled'), nome).toBe('true')
    }
    expect(screen.getByRole('button', { name: '✦ Suporte' }).getAttribute('aria-haspopup')).toBeNull()
  })
})
