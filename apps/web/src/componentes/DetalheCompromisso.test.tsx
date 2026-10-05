import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarCompromissoInterno, eventosDaAgenda, marcarEntrevista } from '../dados/agenda.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import type { EventoDaAgenda } from '../dados/tipos.ts'
import { DetalheCompromisso } from './DetalheCompromisso.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function evento(id: string): Promise<EventoDaAgenda> {
  const achado = (await eventosDaAgenda('2026-09-01', '2026-12-31')).find((e) => e.id === id)
  if (!achado) throw new Error(id)
  return achado
}

function abrir(e: EventoDaAgenda) {
  const aoMudar = vi.fn()
  const navegar = vi.fn()
  render(<DetalheCompromisso evento={e} aoMudar={aoMudar} aoFechar={vi.fn()} navegar={navegar} />)
  return { aoMudar, navegar, janela: within(screen.getByRole('dialog', { name: /·/ })) }
}

describe('Detalhe do compromisso', () => {
  it('CA8 e CA9 · o que passou sem registro pede confirmação; "Faltou" grava a falta e abre o remarcar', async () => {
    const { navegar, janela } = abrir(await evento('natalia-entrevista'))
    expect(janela.getByRole('heading').textContent).toBe('Natália Exemplo · Fazer entrevista')
    expect(janela.getByText('confirmar se aconteceu')).toBeTruthy()
    expect(janela.getByText('D1.09 · Atender e entrevistar')).toBeTruthy()
    expect(janela.getByText('dom 04/10/2026 · 10:30')).toBeTruthy()
    expect(janela.getByText('Passou sem registro: confirme se aconteceu.')).toBeTruthy()
    fireEvent.click(janela.getByRole('button', { name: 'Faltou' }))
    await waitFor(() => expect(navegar).toHaveBeenCalledWith('/agenda/marcar/natalia-exemplo?remarcar=natalia-entrevista'))
    expect((await obterFicha('natalia-exemplo'))?.historico.at(-1)?.oQue).toBe('Registrou a falta à entrevista de 04/10')
  })

  it('GGVP-21 · a entrevista do lead ainda sem confirmação abre a tarefa de confirmar', async () => {
    const { janela } = abrir(await evento('josefa-entrevista'))
    expect(janela.getByRole('link', { name: 'Confirmar agendamento' }).getAttribute('href')).toBe('/agenda/confirmar/josefa-entrevista')
    cleanup()
    const passado = abrir(await evento('natalia-entrevista'))
    expect(passado.janela.queryByRole('link', { name: 'Confirmar agendamento' })).toBeNull()
  })

  it('CA6 · "Marcar como realizado" registra e a agenda atualiza', async () => {
    const { aoMudar, janela } = abrir(await evento('josefa-entrevista'))
    expect(janela.getByRole('link', { name: 'Josefa Exemplo' }).getAttribute('href')).toBe('/clientes/josefa-exemplo')
    fireEvent.click(janela.getByRole('button', { name: 'Marcar como realizado' }))
    await waitFor(() => expect(aoMudar).toHaveBeenCalled())
    expect((await evento('josefa-entrevista')).estado).toBe('realizado')
  })

  it('CA4 · "Enviar convite" abre o Chatwoot com a mensagem e, enviado, a agenda atualiza', async () => {
    const { aoMudar, janela } = abrir(await evento('josefa-entrevista'))
    fireEvent.click(janela.getByRole('button', { name: 'Enviar convite' }))
    expect(await screen.findByRole('dialog', { name: 'Chatwoot · conversa com Josefa Exemplo' })).toBeTruthy()
    const enviar = screen.getByRole('button', { name: 'Enviar' }) as HTMLButtonElement
    await waitFor(() => expect(enviar.disabled).toBe(false))
    fireEvent.click(enviar)
    await waitFor(() => expect(aoMudar).toHaveBeenCalled())
    expect((await obterFicha('josefa-exemplo'))?.contatos.at(-1)?.canal).toBe('Chatwoot')
  })

  it('CA7 · com 2 remarcações não oferece remarcar e avisa a subida para a sênior; o interno não tem cliente', async () => {
    const motivo = 'Pediu outro dia'
    const base = { tipo: 'video' as const, data: '2026-10-06', duracao: 45, com: 'paula', gravar: true, levar: true, pedirFicha: true, confirmarHorarioOcupado: true }
    const primeira = await marcarEntrevista('natalia-exemplo', { ...base, hora: '09:00', remarcar: { agendamentoId: 'natalia-entrevista', motivo } })
    if (primeira.resultado !== 'marcado') throw new Error(primeira.resultado)
    const segunda = await marcarEntrevista('natalia-exemplo', { ...base, hora: '10:30', remarcar: { agendamentoId: primeira.agendamento.id, motivo } })
    if (segunda.resultado !== 'marcado') throw new Error(segunda.resultado)
    const { janela } = abrir(await evento(segunda.agendamento.id))
    expect(janela.queryByRole('link', { name: 'Remarcar' })).toBeNull()
    expect(janela.getByText('Já são 2 remarcações: o caso sobe para a advogada sênior (G15).')).toBeTruthy()

    const interno = await criarCompromissoInterno({ titulo: 'Gravação do vídeo', data: '2026-10-06', hora: '17:00', duracao: 60, responsavel: 'atendimento' })
    cleanup()
    const outro = abrir(interno)
    expect(outro.janela.queryByText('Cliente')).toBeNull()
    expect(outro.janela.getByText('Você (Atendimento) · interno')).toBeTruthy()
  })
})
