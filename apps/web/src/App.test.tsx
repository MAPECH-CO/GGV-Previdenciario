import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App.tsx'

describe('App', () => {
  it('na raiz abre a Central do Atendimento', () => {
    render(<App caminho="/" />)
    expect(screen.getByRole('heading', { name: 'O que você tem que fazer' })).toBeTruthy()
  })

  it('em /tokens abre o guia de tokens', () => {
    render(<App caminho="/tokens" />)
    expect(screen.getByRole('heading', { name: 'Tokens do Figma' })).toBeTruthy()
  })

  it('em rota sem tela avisa que não foi construída e mostra o caminho', () => {
    render(<App caminho="/clientes/novo" />)
    expect(screen.getByRole('heading', { name: 'Esta tela ainda não foi construída' })).toBeTruthy()
    expect(screen.getByText('/clientes/novo')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar ao início' }).getAttribute('href')).toBe('/')
  })
})
