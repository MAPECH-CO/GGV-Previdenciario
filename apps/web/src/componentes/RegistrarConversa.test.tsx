import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { obterGravacoes } from '../dados/transcricao.ts'
import { RegistrarConversa } from './RegistrarConversa.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 14, 32), latencia: 0 })
  zerarExemplo()
  window.localStorage.clear()
  entrarComo()
})

async function abrir(fichaId: string, aoAbrir = vi.fn()) {
  render(comSessao(<RegistrarConversa ficha={(await obterFicha(fichaId))!} aoFechar={() => {}} aoAbrir={aoAbrir} />))
  return aoAbrir
}

const radio = (grupo: string, nome: string) => within(screen.getByRole('radiogroup', { name: grupo })).getByRole('radio', { name: nome })
const botao = (nome: string) => screen.getByRole('button', { name: nome }) as HTMLButtonElement

describe('Registrar conversa · janela (GGVP-76)', () => {
  it('CA3 · canal ligação ou presencial, sem WhatsApp e vídeo; com quem falou; o registro fica no processo', async () => {
    await abrir('maria-exemplo')
    expect(screen.getByRole('heading', { name: /Registrar conversa com o cliente/ })).toBeTruthy()
    expect(screen.getByText('Maria Exemplo · Auxílio por Incapacidade Temporária · o registro fica no processo')).toBeTruthy()
    expect(within(screen.getByRole('radiogroup', { name: 'Canal' })).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Ligação', 'Presencial'])
    expect(document.body.textContent).not.toMatch(/whatsapp|vídeo/i)
    expect(within(screen.getByRole('radiogroup', { name: 'Com quem falou' })).getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'Cliente',
      'Familiar ou contato de apoio',
      'Médico ou clínica',
    ])
    expect(radio('Com quem falou', 'Cliente').getAttribute('aria-checked')).toBe('true')
    expect(botao('Iniciar conversa').disabled).toBe(true)
    expect(screen.getByText('Escolha o canal: ligação ou presencial.')).toBeTruthy()
  })

  it('CA4 e CA9 · presencial sugere a transcrição em tempo real; abre a conversa e vai para a tela do passo', async () => {
    const aoAbrir = await abrir('maria-exemplo')
    fireEvent.click(radio('Canal', 'Presencial'))
    expect((screen.getByRole('radio', { name: 'Transcrição em tempo real · avise o cliente antes de gravar (G10)' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByRole('radio', { name: 'Anexar arquivo · o áudio de uma ligação já feita' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Sem áudio · só o registro escrito' })).toBeTruthy()
    fireEvent.click(botao('Iniciar conversa'))
    await vi.waitFor(() => expect(aoAbrir).toHaveBeenCalled())
    expect(aoAbrir.mock.calls[0][0]).toMatchObject({ fichaId: 'maria-exemplo', canal: 'presencial', modo: 'tempo-real', comQuem: 'cliente', quem: 'Ana (exemplo)' })
  })

  it('CA4 · a ligação sugere anexar o arquivo; "Sem áudio" pede o resumo e salva como só registro', async () => {
    const aoAbrir = await abrir('maria-exemplo')
    fireEvent.click(radio('Canal', 'Ligação'))
    expect(botao('Anexar o áudio').disabled).toBe(false)
    fireEvent.click(radio('Com quem falou', 'Familiar ou contato de apoio'))
    fireEvent.click(screen.getByRole('radio', { name: 'Sem áudio · só o registro escrito' }))
    expect(botao('Salvar o registro').disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Resumo da conversa *'), { target: { value: 'A filha perguntou a data da perícia.' } })
    fireEvent.click(botao('Salvar o registro'))
    await vi.waitFor(() => expect(aoAbrir).toHaveBeenCalled())
    const [g] = await obterGravacoes('maria-exemplo')
    expect(g).toMatchObject({ transcricao: 'sem-audio', titulo: 'Ligação · familiar ou contato de apoio', registro: 'A filha perguntou a data da perícia.' })
  })

  it('com dois processos, escolhe o processo; o lead sem processo fica na ficha', async () => {
    await abrir('cleide-exemplo')
    fireEvent.click(radio('Canal', 'Presencial'))
    expect(screen.getByText('Escolha o processo da conversa.')).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: 'Processo' }), { target: { value: 'cleide-exemplo-2' } })
    expect(botao('Iniciar conversa').disabled).toBe(false)
    render(comSessao(<RegistrarConversa ficha={(await obterFicha('josefa-exemplo'))!} aoFechar={() => {}} />))
    expect(screen.getByText('Josefa Exemplo · o registro fica na ficha do lead')).toBeTruthy()
  })

  it('Documentação e Financeiro não conduzem a conversa (Lucas, 06/10)', async () => {
    entrarComo('documentacao')
    await abrir('maria-exemplo')
    fireEvent.click(radio('Canal', 'Presencial'))
    expect(screen.getByText('A conversa com o cliente é do Atendimento e do Jurídico.')).toBeTruthy()
    expect(botao('Iniciar conversa').disabled).toBe(true)
  })
})
