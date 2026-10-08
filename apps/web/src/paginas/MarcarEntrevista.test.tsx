import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eventosDaAgenda, marcarEntrevista } from '../dados/agenda.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import type { Marcacao } from '../dados/tipos.ts'
import { MarcarEntrevista } from './MarcarEntrevista.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function abrir(fichaId: string, remarcar?: string) {
  render(<MarcarEntrevista fichaId={fichaId} remarcar={remarcar} />)
  await screen.findByRole('heading', { level: 1, name: /a entrevista com/ })
}

const escolher = (grupo: string, opcao: string | RegExp) =>
  fireEvent.click(within(screen.getByRole('radiogroup', { name: grupo })).getByRole('radio', { name: opcao }))
const botaoMarcar = () => screen.getByRole('button', { name: /^Marcar/ }) as HTMLButtonElement

const pelaApi = (fichaId: string, resto: Partial<Marcacao>) =>
  marcarEntrevista(fichaId, { tipo: 'video', data: '2026-10-06', hora: '10:30', duracao: 45, com: 'paula', gravar: true, levar: true, pedirFicha: true, confirmarHorarioOcupado: false, ...resto })

describe('Marcar a entrevista', () => {
  it('"Iniciar entrevista (Transcrição)": a pessoa já está aqui, a entrevista nasce agora e a tela dela abre (GGVP-40)', async () => {
    let aberta = ''
    render(<MarcarEntrevista fichaId="antonio-exemplo" navegar={(url) => (aberta = url)} />)
    await screen.findByRole('heading', { level: 1, name: /a entrevista com/ })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar entrevista (Transcrição)' }))
    await vi.waitFor(() => expect(aberta).toMatch(/^\/entrevista\/antonio-exemplo-ag-\d+$/))
    const entrevista = (await obterFicha('antonio-exemplo'))?.agendamentos.at(-1)
    expect(entrevista).toMatchObject({ oQue: 'Entrevista', data: '2026-10-05', hora: '14:32', estado: 'marcado', com: 'Dra. Paula' })
    expect((await obterFicha('antonio-exemplo'))?.historico.at(-1)?.oQue).toBe('Iniciou a entrevista agora (vídeo (meet)) com Dra. Paula, sem marcar antes')
  })

  it('CA1 e CA2 · escolhe tipo, dia, horário e com quem (só a advogada), e a entrevista vai para a agenda', async () => {
    await abrir('natalia-exemplo')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Marcar a entrevista com Natália Exemplo')
    expect(screen.getByText('cliente novo')).toBeTruthy()
    expect(within(screen.getByRole('radiogroup', { name: 'Data' })).getAllByRole('radio').map((b) => b.textContent)).toEqual([
      'ter 06livre',
      'qua 07livre',
      'qui 08livre',
      'sex 09livre',
      'seg 12livre',
    ])
    const comQuem = screen.getByLabelText('Com quem') as HTMLSelectElement
    expect([...comQuem.options].map((o) => o.text)).toEqual(['Escolha…', 'Dra. Paula (advogada) + você'])
    expect(botaoMarcar().disabled).toBe(true)
    expect(screen.getByText('Escolha o dia.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Iniciar entrevista (Transcrição)' }) as HTMLButtonElement).disabled).toBe(false)

    escolher('Data', /ter 06/)
    escolher('Horário', '10:30')
    expect(screen.getByText(/Olá, Natália! Sua conversa com o escritório GGV está marcada para terça, 06\/10, às 10h30, por vídeo/)).toBeTruthy()
    fireEvent.click(botaoMarcar())

    expect(await screen.findByRole('heading', { name: '✓ Entrevista marcada para ter 06/10 às 10:30 · vídeo (meet) · Dra. Paula' })).toBeTruthy()
    expect(await screen.findByRole('dialog', { name: /Chatwoot · conversa com Natália Exemplo/ })).toBeTruthy()
    expect((await eventosDaAgenda('2026-10-06', '2026-10-06')).map((e) => [e.titulo, e.tipo, e.responsavel])).toEqual([['Natália Exemplo', 'video', 'Dra. Paula']])
  })

  it('CA3 · horário ocupado avisa quem está lá e deixa marcar mesmo assim', async () => {
    await pelaApi('josefa-exemplo', {})
    await abrir('natalia-exemplo')
    escolher('Data', /ter 06/)
    escolher('Horário', '10:30')
    fireEvent.click(botaoMarcar())
    expect((await screen.findByRole('alert')).textContent).toContain('Este horário já tem Josefa Exemplo · fazer entrevista às 10:30 com Dra. Paula')
    fireEvent.click(screen.getByRole('button', { name: 'Marcar mesmo assim' }))
    expect(await screen.findByRole('heading', { name: /✓ Entrevista marcada/ })).toBeTruthy()
    expect(await eventosDaAgenda('2026-10-06', '2026-10-06')).toHaveLength(2)
  })

  it('CA7 · remarcar mostra o horário de antes e só marca com o motivo, que vai para "Últimos contatos"', async () => {
    await abrir('natalia-exemplo', 'natalia-entrevista')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Remarcar a entrevista com Natália Exemplo')
    expect(screen.getByText('Antes: 04/10 às 10:30 · 0 de 2 remarcações')).toBeTruthy()
    escolher('Data', /qua 07/)
    escolher('Horário', '14:00')
    expect(botaoMarcar().disabled).toBe(true)
    expect(screen.getByText('Escreva o motivo da remarcação.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Motivo da remarcação *'), { target: { value: 'Ficou sem internet na hora' } })
    fireEvent.click(botaoMarcar())
    expect(await screen.findByRole('heading', { name: /✓ Entrevista remarcada para qua 07\/10 às 14:00/ })).toBeTruthy()
    expect((await obterFicha('natalia-exemplo'))?.contatos.at(-1)).toEqual({ data: '2026-10-05', canal: 'Remarcação', texto: 'Ficou sem internet na hora' })
  })

  it('CA7 · com 2 remarcações, não remarca e avisa que sobe para a advogada sênior (G15)', async () => {
    const motivo = 'Pediu outro dia'
    const primeira = await pelaApi('natalia-exemplo', { remarcar: { agendamentoId: 'natalia-entrevista', motivo } })
    if (primeira.resultado !== 'marcado') throw new Error(primeira.resultado)
    const segunda = await pelaApi('natalia-exemplo', { hora: '14:00', remarcar: { agendamentoId: primeira.agendamento.id, motivo } })
    if (segunda.resultado !== 'marcado') throw new Error(segunda.resultado)
    await abrir('natalia-exemplo', segunda.agendamento.id)
    escolher('Data', /qui 08/)
    escolher('Horário', '09:00')
    expect(botaoMarcar().disabled).toBe(true)
    expect(screen.getByText('Já são 2 remarcações: o caso sobe para a advogada sênior (G15).')).toBeTruthy()
  })
})
