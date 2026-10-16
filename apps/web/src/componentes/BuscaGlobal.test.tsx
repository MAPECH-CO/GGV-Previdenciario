import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import type { Tarefa } from '../dados/tipos.ts'
import { SessaoContexto } from '../sessao.ts'
import { BuscaGlobal } from './BuscaGlobal.tsx'

const clienteId = '10000000-0000-4000-8000-000000000001'
const casoId = '20000000-0000-4000-8000-000000000002'
const usuario = { nome: 'Pessoa Operadora Inventada', email: 'operadora@example.invalid', perfis: ['atendimento'], perfilAtivo: 'atendimento', trocarSenha: false }
const clientes = { clientes: [{ id: clienteId, nome: 'Cliente Inventado Busca', cpf: null, beneficio: null, cidade: null, processos: 1, situacao: 'em_andamento', ultimoContato: null }], total: 1, leads: 0, pagina: 1, paginas: 1, opcoes: { beneficios: [], cidades: [] } }
const processos = { processos: [{ id: casoId, clienteId, numero: '1234567890', autor: 'Cliente Inventado Busca', beneficio: null, fase: 'administrativa', foro: null, juiz: null, perito: null, desfecho: 'em_andamento', ajuizadoEm: null }], total: 1, doAcervo: 0, pagina: 1, paginas: 1, opcoes: { beneficios: [], foros: [], juizes: [], peritos: [] } }
const vazio = { ...clientes, clientes: [], total: 0 }
const semProcesso = { ...processos, processos: [], total: 0 }

const FILA: Tarefa[] = [
  { id: 't1', codigo: 'D2.06', cliente: { id: 'marta-exemplo', nome: 'Marta Exemplo' }, acao: 'Lançar prestação de contas', detalhe: '', href: '/casos/x/prestacao' },
  { id: 't2', codigo: 'D4.01', cliente: null, contexto: 'Vigília das publicações', acao: 'Reprocessar vigília', detalhe: '' },
  { id: 't3', codigo: 'Chat', cliente: { id: 'antonio-exemplo', nome: 'Antônio Exemplo' }, acao: 'Ligar para o cliente', detalhe: '' },
]

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 8, 14, 32), latencia: 0 })
  zerarExemplo()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** O servidor de mentira: a base de clientes e a de processos, cada uma com a sua resposta. */
function servidor(dosClientes: unknown = clientes, dosProcessos: unknown = processos) {
  const fetch = vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/clientes/busca' ? dosClientes : dosProcessos)))
  vi.stubGlobal('fetch', fetch)
  return fetch
}

function tela(perfil = 'atendimento', tarefas?: Tarefa[]) {
  return render(
    <SessaoContexto value={{ ...usuario, perfilAtivo: perfil }}>
      <BuscaGlobal tarefas={tarefas} />
    </SessaoContexto>,
  )
}

function buscar(termo = 'Cliente Inventado') {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: termo } })
  fireEvent.submit(screen.getByRole('search'))
}

const links = (lista: string) => within(screen.getByRole('list', { name: lista })).getAllByRole('link').map((a) => a.getAttribute('href'))

describe('a busca única do topo', () => {
  it('a advogada acha o cliente e o processo; o termo vai no corpo do POST, nunca no endereço', async () => {
    const fetch = servidor()
    tela('advogada')
    expect(fetch).not.toHaveBeenCalled()
    buscar('1234567890')
    await screen.findByRole('list', { name: 'Processos encontrados' })
    expect(links('Processos encontrados')).toEqual([`/casos/${casoId}`])
    expect(links('Clientes encontrados')).toEqual([`/clientes/${clienteId}`])
    for (const [url, init] of fetch.mock.calls as unknown as [string, RequestInit][]) {
      expect(url).not.toContain('1234567890')
      expect(init.method).toBe('POST')
    }
  })

  it.each(['atendimento', 'atendimento_lider', 'documentacao'])('GGVP-162 CA2 · %s acha só clientes: a busca de processos nem é chamada', async (perfil) => {
    const fetch = servidor()
    tela(perfil)
    expect(screen.getByRole('searchbox', { name: 'Buscar cliente' }).getAttribute('placeholder')).toBe('Nome, CPF, telefone')
    buscar()
    await screen.findByRole('list', { name: 'Clientes encontrados' })
    expect(screen.queryByRole('list', { name: 'Processos encontrados' })).toBeNull()
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/api/clientes/busca'])
  })

  it('na tela inicial acha também as tarefas da fila, com o destino de cada uma', async () => {
    servidor(vazio, semProcesso)
    tela('atendimento', FILA)
    buscar('marta')
    await screen.findByRole('list', { name: 'Tarefas encontradas' })
    expect(links('Tarefas encontradas')).toEqual(['/casos/x/prestacao'])
    expect(links('Clientes encontrados')).toEqual(['/clientes/marta-exemplo'])
  })

  it('a ficha do balcão e a base do servidor não se repetem: o mesmo cliente aparece uma vez', async () => {
    servidor({ ...clientes, clientes: [{ ...clientes.clientes[0], id: 'marta-exemplo', nome: 'Marta Exemplo' }] }, semProcesso)
    tela('atendimento')
    buscar('marta')
    await screen.findByRole('list', { name: 'Clientes encontrados' })
    expect(links('Clientes encontrados')).toEqual(['/clientes/marta-exemplo'])
  })

  it('o Financeiro, que não vê o caso, busca só nas tarefas, e a tela diz por quê', async () => {
    const fetch = servidor()
    tela('financeiro', FILA)
    buscar('marta')
    const resultado = await screen.findByRole('region', { name: 'Resultado da busca' })
    await screen.findByRole('list', { name: 'Tarefas encontradas' })
    expect(screen.queryByRole('list', { name: 'Clientes encontrados' })).toBeNull()
    expect(resultado.textContent).toContain('clientes e processos são de quem acompanha os casos')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('sem ver o caso e fora da tela inicial, não há busca', () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    tela('captador')
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('a tarefa sem tela nem cliente aparece, mas não é link', async () => {
    servidor(vazio, semProcesso)
    tela('senior', FILA)
    buscar('vigilia')
    const lista = await screen.findByRole('list', { name: 'Tarefas encontradas' })
    expect(within(lista).queryAllByRole('link')).toHaveLength(0)
    expect(lista.textContent).toContain('Vigília das publicações · Reprocessar vigília')
  })

  it('nada encontrado diz o que conferir', async () => {
    servidor(vazio, semProcesso)
    tela('atendimento')
    buscar('zzzz')
    expect((await screen.findByRole('region', { name: 'Resultado da busca' })).textContent).toContain('Nada encontrado para «zzzz»')
  })

  it.each([403, 500])('falha %s mostra a busca indisponível, sem resultado antigo', async (status) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })))
    tela()
    buscar()
    expect((await screen.findByRole('alert')).textContent).toContain('indisponível')
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('resposta inválida não vira lista vazia', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))
    tela()
    buscar()
    expect((await screen.findByRole('alert')).textContent).toContain('indisponível')
    expect(screen.queryByText(/Nada encontrado/)).toBeNull()
  })

  it('resposta atrasada não volta depois de apagar o campo', async () => {
    const respostas: (() => void)[] = []
    vi.stubGlobal('fetch', vi.fn((url: string) => new Promise<Response>((ok) => respostas.push(() => ok(new Response(JSON.stringify(url.includes('clientes') ? clientes : processos)))))))
    tela()
    buscar()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
    await act(async () => respostas.forEach((r) => r()))
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('Esc fecha o resultado e devolve o foco ao campo', async () => {
    servidor()
    tela()
    buscar()
    await screen.findByRole('list', { name: 'Clientes encontrados' })
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
    expect(screen.getByRole('searchbox').getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('link')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('searchbox'))
  })

  it('trocar o perfil ativo tira da tela o resultado do perfil anterior', async () => {
    servidor()
    const r = tela()
    buscar()
    await screen.findByRole('list', { name: 'Clientes encontrados' })
    r.rerender(
      <SessaoContexto value={{ ...usuario, perfilAtivo: 'documentacao' }}>
        <BuscaGlobal />
      </SessaoContexto>,
    )
    expect(screen.queryByRole('link')).toBeNull()
  })
})
