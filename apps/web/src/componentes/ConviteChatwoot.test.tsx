import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { marcarEntrevista } from '../dados/agenda.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { ConviteChatwoot } from './ConviteChatwoot.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function marcar(fichaId: string) {
  const resposta = await marcarEntrevista(fichaId, {
    tipo: 'presencial',
    data: '2026-10-06',
    hora: '14:00',
    duracao: 45,
    com: 'paula',
    gravar: true,
    levar: true,
    pedirFicha: true,
    confirmarHorarioOcupado: true,
  })
  if (resposta.resultado !== 'marcado') throw new Error(resposta.resultado)
  return resposta.agendamento.id
}

describe('Convite pelo Chatwoot (simulado)', () => {
  it('CA4 · abre a conversa com a mensagem pronta; a pessoa confere, ajusta e envia, e fica em "Últimos contatos"', async () => {
    const id = await marcar('josefa-exemplo')
    const aoEnviado = vi.fn()
    render(<ConviteChatwoot agendamentoId={id} aoEnviado={aoEnviado} aoFechar={vi.fn()} />)
    expect(await screen.findByRole('heading', { name: 'Chatwoot · conversa com Josefa Exemplo' })).toBeTruthy()
    expect(screen.getByText('WhatsApp (11) 90000-0002 · simulado')).toBeTruthy()
    const texto = screen.getByLabelText(/Mensagem do convite/) as HTMLTextAreaElement
    expect(texto.value).toContain('Olá, Josefa! Sua conversa com o escritório GGV está marcada para terça, 06/10, às 14h, aqui no escritório.')
    expect(texto.value).toContain('preencha a ficha de atendimento em papel')
    fireEvent.change(texto, { target: { value: `${texto.value} Qualquer dúvida, é só responder.` } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(aoEnviado).toHaveBeenCalled())
    expect((await obterFicha('josefa-exemplo'))?.contatos.at(-1)?.texto).toContain('Qualquer dúvida, é só responder.')
  })

  it('sem telefone, não deixa enviar e diz para completar na ficha', async () => {
    const id = await marcar('marta-exemplo')
    render(<ConviteChatwoot agendamentoId={id} aoEnviado={vi.fn()} aoFechar={vi.fn()} />)
    expect(await screen.findByText('Sem telefone: complete na ficha antes de enviar.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  // O cliente de exemplo sai pelo Chatwoot simulado na tela, sem registro no servidor (GGVP-138); o do banco vai pela API,
  // com o registro (apps/api/src/rotas/mensagens.test.ts e e2e/recepcao-servidor.e2e.ts).
  it('GGVP-102 CA6 e CA10 · o convite sai pela conversa do cliente no Chatwoot', async () => {
    const id = await marcar('josefa-exemplo')
    const aoEnviado = vi.fn()
    render(<ConviteChatwoot agendamentoId={id} aoEnviado={aoEnviado} aoFechar={vi.fn()} />)
    const chatwoot = await screen.findByRole('region', { name: 'Na central do Chatwoot' })
    expect(within(chatwoot).getByRole('link', { name: 'Abrir a conversa' }).getAttribute('href')).toMatch(/\/conversations\/5001$/)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(aoEnviado).toHaveBeenCalled())
  })

  it('GGVP-102 CA5 · a falha do Chatwoot fica na tela, e o convite não é registrado como enviado', async () => {
    const id = await marcar('nair-exemplo')
    const aoEnviado = vi.fn()
    render(<ConviteChatwoot agendamentoId={id} aoEnviado={aoEnviado} aoFechar={vi.fn()} />)
    await screen.findByRole('region', { name: 'Na central do Chatwoot' })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByText('A mensagem não saiu pelo Chatwoot: o WhatsApp recusou: o número não tem WhatsApp. Nada foi reenviado sozinho.')).toBeTruthy()
    expect(aoEnviado).not.toHaveBeenCalled()
  })
})
