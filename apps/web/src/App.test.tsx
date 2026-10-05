import { cleanup, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App.tsx'
import { zerarExemplo } from './dados/servidor.ts'

describe('App', () => {
  it('na raiz abre a Central do Atendimento', () => {
    render(<App caminho="/" />)
    expect(screen.getByRole('heading', { name: 'O que você tem que fazer' })).toBeTruthy()
  })

  it('em /tokens abre o guia de tokens', () => {
    render(<App caminho="/tokens" />)
    expect(screen.getByRole('heading', { name: 'Tokens do Figma' })).toBeTruthy()
  })

  it('em /balcao abre o balcão', () => {
    render(<App caminho="/balcao" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Balcão · Receber quem chegou')
  })

  it('em /clientes/novo abre o cadastro de novo cliente', () => {
    render(<App caminho="/clientes/novo" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Novo cliente')
  })

  it('em /clientes/:id abre a ficha daquele cliente; id que não existe avisa', async () => {
    zerarExemplo()
    render(<App caminho="/clientes/antonio-exemplo" />)
    expect(await screen.findByRole('heading', { level: 2, name: 'Antônio Exemplo' })).toBeTruthy()
    cleanup()
    render(<App caminho="/clientes/ninguem" />)
    expect(await screen.findByRole('heading', { name: 'Ficha não encontrada' })).toBeTruthy()
  })

  it('em /balcao/documento/:tarefa abre a tela de receber documento', async () => {
    zerarExemplo()
    render(<App caminho="/balcao/documento/nenhuma" />)
    expect(await screen.findByRole('heading', { name: 'Tarefa não encontrada' })).toBeTruthy()
  })

  it('em rota sem tela avisa que não foi construída e mostra o caminho', () => {
    render(<App caminho="/agenda" />)
    expect(screen.getByRole('heading', { name: 'Esta tela ainda não foi construída' })).toBeTruthy()
    expect(screen.getByText('/agenda')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar ao início' }).getAttribute('href')).toBe('/')
  })
})
