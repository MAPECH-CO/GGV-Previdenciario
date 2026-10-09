import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import type { Tarefa } from '../dados/tipos.ts'
import { CampoBusca } from './CampoBusca.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 8, 14, 32), latencia: 0 })
  zerarExemplo()
})

const FILA: Tarefa[] = [
  { id: 't1', codigo: 'D2.06', cliente: { id: 'marta-exemplo', nome: 'Marta Exemplo' }, acao: 'Lançar prestação de contas', detalhe: '', href: '/casos/x/prestacao' },
  { id: 't2', codigo: 'D4.01', cliente: null, contexto: 'Vigília das publicações', acao: 'Reprocessar vigília', detalhe: '' },
]

function buscar(perfil: string, termo: string) {
  entrarComo(perfil)
  render(comSessao(<CampoBusca tarefas={FILA} />))
  fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar processo, cliente ou tarefa' }), { target: { value: termo } })
  fireEvent.submit(screen.getByRole('search'))
  return screen.findByRole('region', { name: 'Resultado da busca' })
}
const nomes = (lista: string) => within(screen.getByRole('list', { name: lista })).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])

describe('GGVP-78 CA9 · a busca da tela inicial respeita o perfil (GGVP-135)', () => {
  it('quem vê o caso acha o cliente pelo nome, como no balcão, e a tarefa da própria fila', async () => {
    await buscar('atendimento', 'marta')
    expect(nomes('Clientes encontrados')).toEqual([['Marta Exemplo', '/clientes/marta-exemplo']])
    expect(nomes('Tarefas encontradas')).toEqual([['Marta Exemplo · Lançar prestação de contas', '/casos/x/prestacao']])
  })

  it('pelo número do processo, acha o cliente dele', async () => {
    await buscar('senior', '0000001-00.2025')
    expect(nomes('Clientes encontrados')).toEqual([['Antônio Exemplo', '/clientes/antonio-exemplo']])
  })

  it('o Financeiro, que não vê o caso, não acha cliente: só as tarefas dele, e a tela diz por quê', async () => {
    const resultado = await buscar('financeiro', 'marta')
    expect(screen.queryByRole('list', { name: 'Clientes encontrados' })).toBeNull()
    expect(nomes('Tarefas encontradas')).toEqual([['Marta Exemplo · Lançar prestação de contas', '/casos/x/prestacao']])
    expect(resultado.textContent).toContain('A busca de clientes e processos é de quem vê o caso: aqui, só as suas tarefas.')
  })

  it('a tarefa sem cliente se acha pelo contexto; sem nada, a tela diz', async () => {
    await buscar('senior', 'vigilia')
    expect(nomes('Tarefas encontradas')).toEqual([['Vigília das publicações · Reprocessar vigília', '/tarefas/t2']])
    expect(screen.queryByRole('list', { name: 'Clientes encontrados' })).toBeNull()
  })

  it('nada encontrado', async () => {
    const resultado = await buscar('atendimento', 'zzzz')
    expect(resultado.textContent).toBe('Nada encontrado para «zzzz».')
  })
})
