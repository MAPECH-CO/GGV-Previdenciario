import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { conferirChecklist } from '../dados/checklist.ts'
import { obterCobranca } from '../dados/cobranca.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { CobrarDocumento } from './CobrarDocumento.tsx'
import { DecidirCobranca } from './DecidirCobranca.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function cobrarRita() {
  await conferirChecklist('rita-exemplo-1')
  render(<CobrarDocumento processoId="rita-exemplo-1" />)
  await screen.findByRole('heading', { level: 1, name: 'Rita Exemplo · Cobrar documento' })
}

describe('Cobrar documento · tela do passo', () => {
  it('CA4 · mostra o que falta no checklist, a tentativa e o próximo lembrete', async () => {
    await cobrarRita()
    expect(screen.getByText('8 documentos pendentes · 1ª tentativa · vence hoje')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Documentos pendentes' })).getAllByRole('listitem')).toHaveLength(8)
    expect(screen.getByText('Próximo lembrete: hoje')).toBeTruthy()
    expect(screen.getByText(/É a 1ª tentativa: são 2, com 3 dias entre elas/)).toBeTruthy()
  })

  it('CA11 · "Enviar cobrança" abre o Chatwoot com a mensagem pronta e o envio conta como tentativa', async () => {
    await cobrarRita()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar cobrança' }))
    const janela = within(await screen.findByRole('dialog', { name: 'Chatwoot · conversa com Rita Exemplo' }))
    const mensagem = (await janela.findByRole('textbox', { name: 'Mensagem de cobrança (confira antes de enviar)' })) as HTMLTextAreaElement
    expect(mensagem.value).toContain('Para o seu caso de LOAS Deficiente andar, ainda faltam: Documento pessoal (RG)')
    expect(mensagem.value).toContain('até 08/10')
    fireEvent.click(janela.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByText('Cobrança enviada pelo Chatwoot e registrada como tentativa.')).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Tentativas de cobrança' }).textContent).toContain('1ª · 05/10 · Chatwoot · sem resposta')
    // CA5: a próxima tentativa espera os 3 dias.
    expect(screen.getByText('A próxima tentativa é em 08/10, 3 dias depois da última.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Enviar cobrança' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('CA6 · "Ligar" registra a ligação com o resultado', async () => {
    await cobrarRita()
    fireEvent.click(screen.getByRole('button', { name: 'Ligar' }))
    const registrar = screen.getByRole('button', { name: 'Registrar ligação' }) as HTMLButtonElement
    expect(registrar.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Atendeu: vai mandar' }))
    fireEvent.click(registrar)
    expect(await screen.findByText('Ligação registrada como 1ª tentativa.')).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Tentativas de cobrança' }).textContent).toContain('Ligação · respondeu: vai mandar')
  })

  it('CA10 · "Adiar" pede a nova data e mantém a contagem', async () => {
    await cobrarRita()
    fireEvent.click(screen.getByRole('button', { name: 'Adiar' }))
    const adiar = screen.getByRole('button', { name: 'Adiar a cobrança' }) as HTMLButtonElement
    expect(adiar.disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: 'Nova data (obrigatória)' }), { target: { value: '05/10/2026' } })
    expect(screen.getByText('A nova data tem de ser depois de hoje.')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Nova data (obrigatória)' }), { target: { value: '09/10/2026' } })
    fireEvent.click(adiar)
    expect(await screen.findByText('Cobrança adiada para 09/10; a contagem de tentativas continua.')).toBeTruthy()
    expect((await obterCobranca('rita-exemplo-1'))?.tentativa).toBe(1)
  })

  it('CA7 e CA12 · a do Antônio passou para a sênior e continua à vista, com o prazo do juiz', async () => {
    render(<CobrarDocumento processoId="antonio-exemplo-1" />)
    await screen.findByRole('heading', { level: 1, name: 'Antônio Exemplo · Cobrar documento' })
    expect(screen.getByText('Passou do limite: a sênior decide o que fazer. A cobrança continua à vista aqui.')).toBeTruthy()
    expect(screen.getByText(/O prazo do juiz vence em 07\/10: as tentativas se ajustam para caber nele/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Enviar cobrança' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('caso sem cobrança avisa', async () => {
    render(<CobrarDocumento processoId="nair-exemplo-1" />)
    expect(await screen.findByRole('heading', { name: 'Este caso não tem cobrança aberta' })).toBeTruthy()
  })
})

describe('Decidir cobrança · tela da sênior', () => {
  async function abrir() {
    render(<DecidirCobranca processoId="antonio-exemplo-1" />)
    await screen.findByRole('heading', { level: 1, name: 'Antônio Exemplo · Decidir cobrança' })
  }

  it('CA7 · mostra o laço, as pendências e o histórico das tentativas', async () => {
    await abrir()
    expect(screen.getByText('Aposentadoria por Incapacidade Permanente · 2 tentativas sem resposta · limite (G15)')).toBeTruthy()
    expect(screen.getByText('Notas do produtor rural e Certidão')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Tentativas de cobrança' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '30/09 · Chatwoot · sem resposta',
      '03/10 · Ligação · sem resposta',
    ])
  })

  it('CA8 · "Registrar decisão" pede a opção, o prazo e a justificativa; a decisão volta ao Atendimento', async () => {
    await abrir()
    const registrar = screen.getByRole('button', { name: 'Registrar decisão' }) as HTMLButtonElement
    expect(registrar.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Nova tentativa com prazo' }))
    expect(screen.getByText('Informe o novo prazo, depois de hoje (dd/mm/aaaa).')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Novo prazo da tentativa' }), { target: { value: '06/10/2026' } })
    expect(screen.getByText('A justificativa é obrigatória.')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Justificativa *' }), { target: { value: 'a filha leva as notas amanhã' } })
    fireEvent.click(registrar)
    expect(await screen.findByRole('heading', { name: '✓ Decisão registrada às 14:32' })).toBeTruthy()
    expect((await obterFicha('antonio-exemplo'))?.historico.at(-1)).toMatchObject({
      quem: 'Você (Advogada)',
      oQue: 'Decidiu a cobrança: nova tentativa com prazo até 06/10. Justificativa: a filha leva as notas amanhã. A decisão voltou para o Atendimento',
    })
  })
})
