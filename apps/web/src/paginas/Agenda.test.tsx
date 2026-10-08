import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { MENSAGEM } from '../regras/formularios.ts'
import { Agenda } from './Agenda.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

const coluna = (nome: string) => within(screen.getByRole('region', { name: nome }))
const periodo = () => screen.getByText(/de 2026|A partir de/, { selector: 'p' }).textContent

describe('Agenda', () => {
  it('CA5 · a semana mostra cada evento com hora, categoria e quem; filtro tira a categoria da tela', async () => {
    render(<Agenda />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Agenda')
    expect(periodo()).toBe('5 – 11 out de 2026')
    const hoje = coluna('seg 05, hoje')
    expect((await hoje.findByRole('button', { name: /Josefa Exemplo/ })).textContent).toBe('15:30 · VisitasJosefa ExemploFazer entrevista')
    expect(hoje.getByRole('button', { name: /Cleide Exemplo/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Visitas e reuniões/ }).textContent).toContain('2')
    expect(screen.getByRole('button', { name: 'Protocolos' }).getAttribute('aria-disabled')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: /Visitas e reuniões/ }))
    expect(hoje.queryByRole('button', { name: /Josefa Exemplo/ })).toBeNull()
  })

  it('CA8 · na semana anterior, a entrevista de ontem sem registro aparece como "confirmar se aconteceu"', async () => {
    render(<Agenda />)
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(periodo()).toBe('28 set – 4 out de 2026')
    expect((await coluna('dom 04').findByRole('button', { name: /Natália Exemplo/ })).textContent).toContain('confirmar se aconteceu')
  })

  it('CA5 · "+ Novo evento" cria compromisso interno, sem cliente, a partir de hoje', async () => {
    render(<Agenda />)
    fireEvent.click(screen.getByRole('button', { name: '+ Novo evento' }))
    const janela = within(screen.getByRole('dialog', { name: 'Novo evento' }))
    fireEvent.click(janela.getByRole('radio', { name: 'Compromisso interno' }))
    fireEvent.change(janela.getByLabelText('Título *'), { target: { value: 'Gravação do vídeo do escritório' } })
    fireEvent.change(janela.getByLabelText('Data * (dd/mm/aaaa)'), { target: { value: '04/10/2026' } })
    fireEvent.change(janela.getByLabelText('Hora *'), { target: { value: '17:00' } })
    fireEvent.click(janela.getByRole('button', { name: 'Pôr na agenda' }))
    expect(janela.getByText(MENSAGEM.dataDoCompromisso)).toBeTruthy()

    fireEvent.change(janela.getByLabelText('Data * (dd/mm/aaaa)'), { target: { value: '06/10/2026' } })
    fireEvent.click(janela.getByRole('button', { name: 'Pôr na agenda' }))
    expect((await coluna('ter 06').findByRole('button', { name: /Gravação do vídeo do escritório/ })).textContent).toContain('Compromisso interno')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('CA1 · "+ Novo evento" de entrevista busca o cliente e leva à tela de marcar', async () => {
    const navegar = vi.fn()
    render(<Agenda navegar={navegar} />)
    fireEvent.click(screen.getByRole('button', { name: '+ Novo evento' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar o cliente por nome, CPF ou telefone' }), { target: { value: 'natali' } })
    fireEvent.click(await screen.findByRole('button', { name: /Natália Exemplo/ }))
    expect(navegar).toHaveBeenCalledWith('/agenda/marcar/natalia-exemplo')
  })

  it('CA8 · o mês mostra o dia de hoje e o que passou sem registro', async () => {
    render(<Agenda />)
    fireEvent.click(screen.getByRole('tab', { name: 'Mês' }))
    expect(periodo()).toBe('Outubro de 2026')
    const hoje = within(screen.getByRole('region', { name: '5/10, hoje' }))
    expect(await hoje.findByRole('button', { name: '15:30 Josefa' })).toBeTruthy()
    expect(within(screen.getByRole('region', { name: '4/10' })).getByRole('button', { name: '10:30 Natália' })).toBeTruthy()
  })

  it('CA8 · a lista começa pelo que precisa confirmar e segue por dia, com o passo e o estado', async () => {
    render(<Agenda vistaInicial="lista" />)
    expect(periodo()).toBe('A partir de hoje · 05/10/2026')
    const confirmar = within(await screen.findByRole('region', { name: 'Para confirmar se aconteceu' }))
    const natalia = confirmar.getByRole('button', { name: /Natália Exemplo/ })
    expect(natalia.textContent).toContain('D1.09')
    expect(natalia.textContent).toContain('confirmar se aconteceu')
    const hoje = within(screen.getByRole('region', { name: 'seg 05/10 · hoje' }))
    expect(hoje.getByRole('button', { name: /Josefa Exemplo/ }).textContent).toContain('presencial · Dra. Paula')
    await waitFor(() => expect(hoje.getAllByRole('button')).toHaveLength(2))
  })
})
