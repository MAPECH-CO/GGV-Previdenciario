import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { QuadroDoSetor } from '@ggv/contratos'
import { juntarMinhas } from '../dados/setor.ts'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { TarefasDoSetor } from './TarefasDoSetor.tsx'

const BIA = '11111111-1111-4111-8111-111111111111'
const CARLOS = '22222222-2222-4222-8222-222222222222'
const EVA = '33333333-3333-4333-8333-333333333333'
const base = { contexto: null, href: '/casos/x/ajuste', prioridade: null, recado: null, atribuidaPor: null }
const quadro: QuadroDoSetor = {
  setor: 'atendimento',
  pessoas: [
    { id: BIA, nome: 'Bia Santos', funcao: 'Atendimento', carga: 1 },
    { id: CARLOS, nome: 'Carlos Melo', funcao: 'Atendimento', carga: 4 },
    { id: EVA, nome: 'Carla (exemplo)', funcao: 'Atendimento · líder, Atendimento', carga: 0 },
  ],
  tarefas: [
    { ...base, id: 'renovar', codigo: 'D1.08', cliente: { id: 'c1', nome: 'Josefa Ramos' }, acao: 'Renovar senha do gov.br', detalhe: 'BPC/LOAS', prazo: 'até 15h', urgente: true, responsavel: null },
    { ...base, id: 'confirmar', codigo: 'D1.04', cliente: { id: 'c2', nome: 'Helena Duarte' }, acao: 'Confirmar agendamento', detalhe: 'LOAS', prazo: 'hoje', urgente: false, responsavel: { id: BIA, nome: 'Bia Santos' } },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
  entrarComo()
})

describe('Tarefas do setor (GGVP-147)', () => {
  it('CA1 · todas as tarefas abertas do setor, de quem é cada uma e o prazo; filtra por pessoa e por "sem responsável"', () => {
    render(<TarefasDoSetor quadro={quadro} erro="" recarregar={() => undefined} />)
    expect(screen.getByRole('heading', { name: 'Tarefas do setor · Atendimento' })).toBeTruthy()
    const lista = screen.getByRole('list', { name: 'Tarefas do setor' })
    const [renovar, confirmar] = within(lista).getAllByRole('listitem')
    expect(renovar.textContent).toContain('sem responsável')
    expect(renovar.textContent).toContain('até 15h')
    expect(confirmar.textContent).toContain('Bia Santos')
    expect(within(confirmar).getByRole('button', { name: /^Reatribuir/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Sem responsável (1)' }))
    expect(within(lista).getAllByRole('listitem')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Bia Santos (1)' }))
    expect(within(screen.getByRole('list', { name: 'Tarefas do setor' })).getByText(/Confirmar agendamento/)).toBeTruthy()
  })

  it('CA2 · "Atribuir" mostra quem faz com a carga; escolher e atribuir manda ao servidor e recarrega; "Você" é quem está na sessão', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 201 }))
    vi.stubGlobal('fetch', fetch)
    const recarregar = vi.fn()
    entrarComo('atendimento-lider')
    render(comSessao(<TarefasDoSetor quadro={quadro} erro="" recarregar={recarregar} />))
    fireEvent.click(screen.getByRole('button', { name: 'Atribuir: Josefa Ramos · Renovar senha do gov.br' }))
    const janela = screen.getByRole('dialog', { name: 'Atribuir tarefa' })
    expect(within(janela).getByText('Você')).toBeTruthy()
    expect(within(janela).getByLabelText('4 tarefas com Carlos Melo')).toBeTruthy()
    const atribuir = within(janela).getByRole('button', { name: 'Atribuir' }) as HTMLButtonElement
    expect(atribuir.disabled).toBe(true)
    fireEvent.click(within(janela).getByRole('radio', { name: /Bia Santos/ }))
    fireEvent.change(within(janela).getByLabelText('Recado (opcional)'), { target: { value: 'fazer por telefone' } })
    fireEvent.click(atribuir)
    await vi.waitFor(() => expect(recarregar).toHaveBeenCalled())
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect([url, JSON.parse(String(init.body))]).toEqual([
      '/api/setor/atribuicoes',
      { tarefaId: 'renovar', responsavelId: BIA, prazo: '', prioridade: 'normal', recado: 'fazer por telefone', avisar: true },
    ])
  })

  it('CA2 · "Minhas tarefas": sai o que o líder deu a outra pessoa; entra no topo o que deu a esta, com o recado', () => {
    const minha = { ...quadro.tarefas[1], id: 'cobrar', acao: 'Cobrar documento', recado: 'ligar à tarde', atribuidaPor: 'Carla (exemplo)' }
    const fila = juntarMinhas(
      [
        { id: 'renovar', codigo: 'D1.08', cliente: null, acao: 'Renovar senha do gov.br', detalhe: '' },
        { id: 'confirmar', codigo: 'D1.04', cliente: null, acao: 'Confirmar agendamento', detalhe: '' },
      ],
      { minhas: [minha], deOutros: ['confirmar'] },
    )
    expect(fila.map((t) => t.id)).toEqual(['cobrar', 'renovar'])
    expect(fila[0].detalhe).toBe('LOAS · Carla (exemplo) atribuiu a você: ligar à tarde')
  })
})
