import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { registrarConfirmacao } from '../dados/confirmacao.ts'
import { configurarExemplo, obterFicha, tarefasDoSetor, zerarExemplo } from '../dados/servidor.ts'
import { ConfirmarAgendamento } from './ConfirmarAgendamento.tsx'

let agora = new Date(2026, 9, 5, 14, 32)

beforeEach(() => {
  agora = new Date(2026, 9, 5, 14, 32)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
})

async function abrir(id = 'josefa-entrevista') {
  render(<ConfirmarAgendamento agendamentoId={id} />)
  await screen.findByRole('heading', { level: 1, name: /Confirmar agendamento/ })
}

const botao = (nome: string | RegExp) => screen.getByRole('button', { name: nome }) as HTMLButtonElement
const opcao = (nome: string) => screen.getByRole('radio', { name: nome }) as HTMLButtonElement

describe('Confirmar agendamento · tela do passo', () => {
  it('CA1 e CA4 · título, contato, entrevista, ficha, "Ligar" e "Chatwoot"; parado até o contato e as decisões', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Josefa Exemplo · Confirmar agendamento')
    expect(screen.getByText('(11) 90000-0002 · lead')).toBeTruthy()
    const contato = within(screen.getByRole('region', { name: 'Contato do cliente' }))
    expect(contato.getByText('Entrevista hoje às 15:30 · presencial com Dra. Paula')).toBeTruthy()
    expect(contato.getByText('Ficha de atendimento: ainda não preenchida')).toBeTruthy()
    expect(contato.getByRole('button', { name: 'Ligar' })).toBeTruthy()
    expect(contato.getByRole('button', { name: 'Chatwoot' })).toBeTruthy()
    expect(screen.getByText(/peça que traga RG e CPF de todos da casa/)).toBeTruthy()
    expect(screen.getByText('Tentativa 1 de 2 · a próxima em 3 dias · sem resposta na segunda, sobe para a sênior (G15)')).toBeTruthy()
    expect(botao('Confirmar entrevista').disabled).toBe(true)
    expect(screen.getByText('Ligue ou mande a mensagem pelo Chatwoot.')).toBeTruthy()
    expect(opcao('Sim, a doutora prepara a conversa').disabled).toBe(true)
  })

  it('CA1 · o Chatwoot abre a conversa com a mensagem de confirmação para conferir e enviar', async () => {
    await abrir()
    fireEvent.click(botao('Chatwoot'))
    const janela = within(await screen.findByRole('dialog', { name: 'Chatwoot · conversa com Josefa Exemplo' }))
    const texto = (await janela.findByLabelText('Mensagem de confirmação (confira antes de enviar)')) as HTMLTextAreaElement
    await waitFor(() => expect(texto.value).toContain('Passando para confirmar sua conversa'))
    expect(texto.value).toContain('biometria, CadÚnico, senha do Meu INSS e comprovantes de gastos')
    fireEvent.click(janela.getByRole('button', { name: 'Enviar' }))
    expect((await screen.findByRole('status')).textContent).toContain('Mensagem de confirmação enviada pelo Chatwoot às 14:32')
    expect((await obterFicha('josefa-exemplo'))?.contatos.at(-1)?.canal).toBe('Chatwoot')
  })

  it('CA2, CA5 e CA7 · ligou, confirmou e não tem ficha: fica "Preencher ficha" até a hora da entrevista', async () => {
    await abrir()
    fireEvent.click(botao('Ligar'))
    expect(screen.getByRole('status').textContent).toBe('Ligação simulada para (11) 90000-0002: registre o resultado ao lado.')
    fireEvent.click(opcao('Confirmou a entrevista'))
    expect(screen.getByText('Responda se já preencheu a ficha de atendimento.')).toBeTruthy()
    fireEvent.click(opcao('Não, enviar a ficha à cliente'))
    fireEvent.click(botao('Confirmar entrevista'))
    expect((await screen.findByRole('heading', { name: '✓ Entrevista confirmada às 14:32' })).textContent).toBeTruthy()
    expect(screen.getByText(/Ficou a pendência "Preencher ficha" até 15:30/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Preencher a ficha agora' }).getAttribute('href')).toBe('/clientes/josefa-exemplo/ficha-de-atendimento')
    expect(tarefasDoSetor('Atendimento').map((t) => t.acao)).toEqual(['Preencher ficha'])
    expect((await obterFicha('josefa-exemplo'))?.agendamentos[0].confirmacao?.tentativas[0]).toMatchObject({ canal: 'ligacao', quem: 'Você (Atendimento)' })
  })

  it('CA3 · confirmou com ficha: a doutora recebe "Preparar entrevista"', async () => {
    await abrir()
    fireEvent.click(botao('Ligar'))
    fireEvent.click(opcao('Confirmou a entrevista'))
    fireEvent.click(opcao('Sim, a doutora prepara a conversa'))
    fireEvent.click(botao('Confirmar entrevista'))
    expect(await screen.findByText('Dra. Paula recebeu "Preparar entrevista" com a ficha de Josefa.')).toBeTruthy()
    expect(tarefasDoSetor('Jurídico').map((t) => t.acao)).toEqual(['Preparar entrevista'])
  })

  it('CA6 · sem resposta vira "Registrar tentativa", mostra o número e a próxima data', async () => {
    await abrir()
    fireEvent.click(botao('Ligar'))
    fireEvent.click(opcao('Sem resposta'))
    expect(opcao('Não, enviar a ficha à cliente').disabled).toBe(true)
    fireEvent.click(botao('Registrar tentativa'))
    expect(await screen.findByRole('heading', { name: 'Tentativa 1 de 2 registrada' })).toBeTruthy()
    expect(screen.getByText('Sem resposta: a próxima tentativa é em 08/10.')).toBeTruthy()
  })

  it('CA6 · antes dos 3 dias, "Sem resposta" espera e "Confirmou" continua valendo', async () => {
    await registrarConfirmacao('josefa-entrevista', { resultado: 'sem-resposta', canal: 'ligacao' })
    await abrir()
    expect(screen.getByText('Tentativa 2 de 2 a partir de 08/10 · sem resposta na segunda, sobe para a sênior (G15)')).toBeTruthy()
    expect(opcao('Sem resposta').disabled).toBe(true)
    expect(opcao('Confirmou a entrevista').disabled).toBe(false)
  })

  it('compromisso que não existe e entrevista já confirmada não deixam registrar', async () => {
    render(<ConfirmarAgendamento agendamentoId="nao-existe" />)
    expect(await screen.findByRole('heading', { name: 'Compromisso não encontrado' })).toBeTruthy()
    cleanup()
    await registrarConfirmacao('josefa-entrevista', { resultado: 'confirmou', canal: 'ligacao', jaPreencheuFicha: true })
    await abrir()
    expect(screen.getByText('Esta entrevista já foi confirmada.')).toBeTruthy()
    expect(botao('Ligar').disabled).toBe(true)
  })
})
