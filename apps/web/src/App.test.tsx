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

  it('GGVP-123 · em /agenda abre a agenda, com a visão pedida', () => {
    zerarExemplo()
    render(<App caminho="/agenda" busca="?ver=lista" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Agenda')
    expect(screen.getByRole('tab', { name: 'Lista' }).getAttribute('aria-selected')).toBe('true')
  })

  it('GGVP-123 · em /agenda/marcar/:id abre a marcação; com ?remarcar=, a remarcação', async () => {
    zerarExemplo()
    render(<App caminho="/agenda/marcar/natalia-exemplo" busca="?remarcar=natalia-entrevista" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Remarcar a entrevista com Natália Exemplo' })).toBeTruthy()
  })

  it('GGVP-21 · em /agenda/confirmar/:id abre a confirmação do agendamento', async () => {
    zerarExemplo()
    render(<App caminho="/agenda/confirmar/josefa-entrevista" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Josefa Exemplo · Confirmar agendamento' })).toBeTruthy()
  })

  it('GGVP-24 · em /clientes/:id/ficha-de-atendimento abre a ficha; com ?modo=tablet, uma pergunta por vez', async () => {
    zerarExemplo()
    render(<App caminho="/clientes/josefa-exemplo/ficha-de-atendimento" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Josefa Exemplo · Preencher ficha' })).toBeTruthy()
    cleanup()
    render(<App caminho="/clientes/josefa-exemplo/ficha-de-atendimento" busca="?modo=tablet" />)
    expect(await screen.findByText('Pergunta 1 de 11')).toBeTruthy()
  })

  it('GGVP-32 · em /advogada abre a Central da Advogada e em /entrevista/:id/preparar, a preparação', async () => {
    zerarExemplo()
    render(<App caminho="/advogada" />)
    expect(screen.getByRole('heading', { name: 'Início da Advogada' })).toBeTruthy()
    cleanup()
    render(<App caminho="/entrevista/josefa-entrevista/preparar" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Josefa Exemplo · Preparar entrevista' })).toBeTruthy()
  })

  it('GGVP-28 e GGVP-36 · as telas de analisar a ficha, da segunda ficha e de renovar a senha', async () => {
    zerarExemplo()
    render(<App caminho="/entrevista/josefa-entrevista/analisar" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Josefa Exemplo · Analisar ficha' })).toBeTruthy()
    cleanup()
    render(<App caminho="/clientes/josefa-exemplo/segunda-ficha" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Josefa Exemplo · Preencher segunda ficha' })).toBeTruthy()
    cleanup()
    render(<App caminho="/entrevista/josefa-entrevista/renovar-senha" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Josefa Exemplo · Renovar senha do gov.br' })).toBeTruthy()
  })

  it('GGVP-40 · a tela do passo da entrevista e a da gravação', async () => {
    zerarExemplo()
    render(<App caminho="/entrevista/josefa-entrevista" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Josefa Exemplo · Fazer entrevista' })).toBeTruthy()
    cleanup()
    render(<App caminho="/entrevista/josefa-entrevista/gravacao" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Entrevista com Josefa Exemplo' })).toBeTruthy()
  })

  it('em rota sem tela avisa que não foi construída e mostra o caminho', () => {
    render(<App caminho="/relatorios" />)
    expect(screen.getByRole('heading', { name: 'Esta tela ainda não foi construída' })).toBeTruthy()
    expect(screen.getByText('/relatorios')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar ao início' }).getAttribute('href')).toBe('/')
  })
})
