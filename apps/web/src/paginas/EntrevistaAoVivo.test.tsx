import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { configurarExemplo, ler, zerarExemplo } from '../dados/servidor.ts'
import { EntrevistaAoVivo } from './EntrevistaAoVivo.tsx'

/** Senha de teste: não pode aparecer na tela depois de guardada (CA6, G9). */
const SENHA_DE_TESTE = 'Teste#Entrevista-7314'
/** Um segundo de gravação em 5 ms. */
const PASSO = 5
/** A máquina lenta (OneDrive) pede folga nos testes que esperam o relógio. */
const ESPERA = { timeout: 15000 }
const LONGO = 30000

let online = true

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
  online = true
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online })
})

afterEach(() => {
  online = true
})

const botao = (nome: string | RegExp) => screen.getByRole('button', { name: nome }) as HTMLButtonElement
const estado = () => screen.getAllByRole('status')[0].textContent

async function comecar(simular?: string) {
  render(<EntrevistaAoVivo agendamentoId="josefa-entrevista" passo={PASSO} simular={simular} />)
  await screen.findByRole('heading', { level: 1, name: 'Entrevista com Josefa Exemplo' })
  fireEvent.click(botao('Gravar'))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Avisei o cliente que a conversa será gravada' }))
  fireEvent.click(botao('Começar a gravar'))
  await screen.findByText(/● Gravando/)
}

describe('Entrevista com gravação · tela', () => {
  it('CA1 e CA4 · "Gravar" lembra o aviso; só grava depois de "Avisei", com a hora do aviso', async () => {
    render(<EntrevistaAoVivo agendamentoId="josefa-entrevista" passo={PASSO} />)
    await screen.findByText('Antes de gravar · avise o cliente (G10)')
    fireEvent.click(botao('Gravar'))
    expect(screen.getByRole('heading', { name: 'Antes de gravar, avise o cliente (G10)' })).toBeTruthy()
    expect(screen.getByText('“Josefa, esta conversa vai ser gravada e transcrita para preencher a sua ficha. Tudo bem?”')).toBeTruthy()
    expect(botao('Começar a gravar').disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Avisei o cliente que a conversa será gravada' }))
    fireEvent.click(botao('Começar a gravar'))
    expect((await screen.findByText(/● Gravando/)).textContent).toMatch(/● Gravando · 00:00:\d\d · aviso de gravação feito às 14:32 \(G10\)/)
  })

  it('CA5 e CA11 · transcrição ao vivo, roteiro, Pausar e Retomar; ao encerrar, a transcrição, "Cadastrar lead" e "Definir o benefício"', async () => {
    await comecar()
    expect(botao('Definir o benefício (D1.12) · libera ao encerrar a entrevista').disabled).toBe(true)
    await screen.findByText(/Parei em junho de 2026/, undefined, ESPERA)
    expect(screen.getByText(/Desde quando não consegue trabalhar/).textContent).toContain('(respondido)')
    expect(screen.getByRole('region', { name: 'Ficha preenchida pela IA · você confere' }).textContent).toContain('Auxiliar de limpeza')
    fireEvent.click(botao('Pausar'))
    await screen.findByText(/❚❚ Pausada/)
    fireEvent.click(botao('Retomar'))
    await screen.findByText(/● Gravando/)
    fireEvent.click(botao('Encerrar e gerar resumo'))
    await screen.findByRole('heading', { name: /✓ Entrevista encerrada/ })
    await screen.findByText(/Transcrição pronta \(D1.11\)/)
    expect(screen.getByRole('link', { name: 'Definir o benefício (D1.12)' }).getAttribute('href')).toBe('/entrevista/josefa-entrevista/beneficio')
    expect(screen.getByRole('link', { name: 'Cadastrar lead (D1.10)' }).getAttribute('href')).toBe('/clientes/josefa-exemplo/cadastro')
    const acoes = ler().gravacoes[0].acoes.map((a) => a.acao)
    expect(acoes).toEqual(['avisou', 'gravou', 'pausou', 'retomou', 'encerrou'])
  }, LONGO)

  it('CA6 · o cofre pausa a gravação; guardada a senha, ela retoma e a senha não fica na tela', async () => {
    await comecar()
    fireEvent.click(botao(/Abrir o cofre/))
    await screen.findByText(/❚❚ Pausada para a senha do gov.br/)
    fireEvent.change(screen.getByLabelText('Digite a senha (vai direto ao cofre)'), { target: { value: SENHA_DE_TESTE } })
    fireEvent.click(botao('Guardar no cofre'))
    await screen.findByText(/● Gravando/)
    expect(document.body.innerHTML).not.toContain(SENHA_DE_TESTE)
    expect(ler().gravacoes[0].acoes.map((a) => a.acao)).toEqual(['avisou', 'gravou', 'abriu-cofre', 'guardou-senha'])
  })

  it('CA8 · a gravação falha: aviso na hora e registrar sem áudio', async () => {
    await comecar('falha-do-microfone')
    await screen.findByRole('heading', { name: 'A gravação falhou em 00:00:40' }, ESPERA)
    expect(botao('Tentar gravar de novo')).toBeTruthy()
    fireEvent.click(botao('Registrar como sem áudio'))
    fireEvent.change(screen.getByLabelText('O que foi conversado *'), { target: { value: 'Conversamos sobre o LOAS; a cliente traz a carta do INSS.' } })
    fireEvent.click(botao('Registrar sem áudio'))
    await screen.findByRole('heading', { name: '✓ Entrevista registrada sem áudio' })
  }, LONGO)

  it('CA12 · sem internet a gravação segue; ao encerrar, espera e transcreve quando a conexão volta', async () => {
    await comecar()
    online = false
    fireEvent(window, new Event('offline'))
    expect((await screen.findByRole('alert')).textContent).toContain('Sem internet: a gravação continua e o áudio fica guardado neste computador.')
    fireEvent.click(botao('Encerrar e gerar resumo'))
    await screen.findByText(/Sem internet: o áudio está guardado neste computador/)
    online = true
    fireEvent(window, new Event('online'))
    await screen.findByText(/Transcrição pronta \(D1.11\)/)
    expect(ler().gravacoes[0].acoes.filter((a) => a.acao === 'enviou-audio')).toHaveLength(1)
    expect(estado()).toMatch(/^Encerrada/)
  })
})
