import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App.tsx'
import { zerarExemplo } from './dados/servidor.ts'

// As telas abrem depois de o servidor confirmar a sessão (GGVP-117): aqui ele responde com um usuário de exemplo.
const usuario = { nome: 'Ana', email: 'ana@exemplo.ggv', perfil: 'atendimento', trocarSenha: false }

function servidorResponde(status: number, corpo: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(corpo), { status })))
}

beforeEach(() => servidorResponde(200, usuario))
afterEach(() => vi.unstubAllGlobals())

describe('App', () => {
  it('na raiz abre a Central do Atendimento', async () => {
    render(<App caminho="/" />)
    expect((await screen.findByRole('heading', { name: 'O que você tem que fazer' }))).toBeTruthy()
  })

  it('em /tokens abre o guia de tokens, sem pedir sessão', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    render(<App caminho="/tokens" />)
    expect(screen.getByRole('heading', { name: 'Tokens do Figma' })).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('em /balcao abre o balcão', async () => {
    render(<App caminho="/balcao" />)
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Balcão · Receber quem chegou')
  })

  it('em /clientes/novo abre o cadastro de novo cliente', async () => {
    render(<App caminho="/clientes/novo" />)
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Novo cliente')
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

  it('GGVP-81 · em /clientes/:id/conferir-documentos abre a conferência da leitura da IA', async () => {
    zerarExemplo()
    render(<App caminho="/clientes/rita-exemplo/conferir-documentos" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Rita Exemplo · Conferir documento' })).toBeTruthy()
  })

  it('GGVP-91 · em /casos/:id/checklist abre o checklist do caso; caso que não existe avisa', async () => {
    zerarExemplo()
    render(<App caminho="/casos/rita-exemplo-1/checklist" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Rita Exemplo · Conferir checklist' })).toBeTruthy()
    cleanup()
    render(<App caminho="/casos/nenhum/checklist" />)
    expect(await screen.findByRole('heading', { name: 'Caso não encontrado' })).toBeTruthy()
  })

  it('GGVP-101 · em /casos/:id/cobranca e /cobranca/decidir abrem a cobrança e a decisão da sênior', async () => {
    zerarExemplo()
    render(<App caminho="/casos/antonio-exemplo-1/cobranca" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Antônio Exemplo · Cobrar documento' })).toBeTruthy()
    cleanup()
    render(<App caminho="/casos/antonio-exemplo-1/cobranca/decidir" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Antônio Exemplo · Decidir cobrança' })).toBeTruthy()
  })

  it('GGVP-93 · em /roteiros e /roteiros/:id abrem os roteiros de laudos', async () => {
    zerarExemplo()
    render(<App caminho="/roteiros" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Roteiros de laudos' })).toBeTruthy()
    cleanup()
    render(<App caminho="/roteiros/pcd" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Aposentadoria da Pessoa com Deficiência · Roteiro de conteúdo mínimo' })).toBeTruthy()
  })

  it('GGVP-20 · em /casos/:id/laudo-novo e /casos/:id/parecer abrem a análise do laudo novo e o parecer', async () => {
    zerarExemplo()
    render(<App caminho="/casos/antonio-exemplo-1/laudo-novo" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Antônio Exemplo · Analisar laudo novo' })).toBeTruthy()
    cleanup()
    render(<App caminho="/casos/rita-exemplo-1/parecer" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Rita Exemplo · Dar parecer médico' })).toBeTruthy()
  })

  it('GGVP-18 · em /casos/:id/liberar abre a liberação; com ?perfil=atendimento, só a situação', async () => {
    zerarExemplo()
    render(<App caminho="/casos/sebastiao-exemplo-1/liberar" />)
    expect(await screen.findByRole('button', { name: 'Liberar ao Jurídico' })).toBeTruthy()
    cleanup()
    render(<App caminho="/casos/sebastiao-exemplo-1/liberar" busca="?perfil=atendimento" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Sebastião Exemplo · Liberar ao Jurídico' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Liberar ao Jurídico' })).toBeNull()
  })

  it('GGVP-123 · em /agenda abre a agenda, com a visão pedida', async () => {
    zerarExemplo()
    render(<App caminho="/agenda" busca="?ver=lista" />)
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Agenda')
    expect((await screen.findByRole('tab', { name: 'Lista' })).getAttribute('aria-selected')).toBe('true')
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
    expect((await screen.findByRole('heading', { name: 'Início da Advogada' }))).toBeTruthy()
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

  it('GGVP-43 · a tela de cadastrar o lead', async () => {
    zerarExemplo()
    render(<App caminho="/clientes/josefa-exemplo/cadastro" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Josefa Exemplo · Cadastrar lead' })).toBeTruthy()
  })

  it('GGVP-51 · a tela de definir o benefício', async () => {
    zerarExemplo()
    render(<App caminho="/entrevista/josefa-entrevista/beneficio" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Josefa Exemplo · Definir benefício' })).toBeTruthy()
  })

  it('GGVP-57 · a tela de calcular tempo e pontos', async () => {
    zerarExemplo()
    render(<App caminho="/entrevista/josefa-entrevista/calculo" />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Josefa Exemplo · Calcular tempo e pontos' })).toBeTruthy()
  })

  it('em rota sem tela avisa que não foi construída e mostra o caminho', async () => {
    render(<App caminho="/relatorios" />)
    expect((await screen.findByRole('heading', { name: 'Esta tela ainda não foi construída' }))).toBeTruthy()
    expect((await screen.findByText('/relatorios'))).toBeTruthy()
    expect((await screen.findByRole('link', { name: 'Voltar ao início' })).getAttribute('href')).toBe('/')
  })

  it('GGVP-117 CA4 · sem perfil mostra o aviso e nenhuma tela de caso', async () => {
    servidorResponde(200, { ...usuario, perfil: null })
    render(<App caminho="/" />)
    expect(await screen.findByRole('heading', { name: 'Sem perfil, fale com a gestão.' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'O que você tem que fazer' })).toBeNull()
  })

  it('GGVP-117 CA1 · senha provisória: abre a troca de senha antes de qualquer tela', async () => {
    servidorResponde(200, { ...usuario, trocarSenha: true })
    render(<App caminho="/" />)
    expect(await screen.findByRole('heading', { name: 'Crie a sua senha' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'O que você tem que fazer' })).toBeNull()
  })

  it('GGVP-117 CA3 · sem sessão vai para o login guardando a tela de volta, e não mostra nada', async () => {
    servidorResponde(401, { erro: 'Sua sessão expirou. Entre de novo.' })
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, pathname: '/clientes/novo', search: '?aba=2', assign })
    const { container } = render(<App caminho="/clientes/novo" />)
    await vi.waitFor(() => expect(assign).toHaveBeenCalledOnce())
    expect(assign.mock.calls[0][0]).toBe('/entrar?volta=%2Fclientes%2Fnovo%3Faba%3D2')
    expect(container.textContent).toBe('')
  })
})
