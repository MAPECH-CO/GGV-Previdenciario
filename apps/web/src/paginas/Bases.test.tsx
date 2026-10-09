import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ListaDeClientes, ListaDeProcessos } from '@ggv/contratos'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo } from '../dados/servidor.ts'
import { Clientes } from './Clientes.tsx'
import { Processos } from './Processos.tsx'

// GGVP-78 · Clientes e Processos (Figma 1927:605 e 1927:888). Dados fictícios.
const SEB = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const CLA = '7a2d3b9f-4c5e-4d6f-9a71-829304b5c6d7'
const CASO = '8b3e4c0a-5d6f-4e70-8b82-93a415c6d7e8'

const clientes: ListaDeClientes = {
  clientes: [
    { id: SEB, nome: 'Sebastião Nunes', cpf: '***.982.247-**', beneficio: 'Auxílio-Acidente', cidade: 'São Paulo · SP', processos: 2, situacao: 'em_andamento', ultimoContato: '2026-10-08' },
    { id: CLA, nome: 'Fernanda Ruiz', cpf: null, beneficio: null, cidade: null, processos: 0, situacao: 'lead', ultimoContato: null },
  ],
  total: 2,
  leads: 1,
  pagina: 1,
  paginas: 3,
  opcoes: { beneficios: ['Auxílio-Acidente'], cidades: ['São Paulo · SP'] },
}

const processos: ListaDeProcessos = {
  processos: [
    {
      id: CASO,
      numero: '5005290-87.2026.4.03.6301',
      clienteId: SEB,
      autor: 'Sebastião Nunes',
      beneficio: 'Auxílio-Acidente',
      fase: 'judicial',
      foro: 'JEF São Paulo',
      juiz: null,
      perito: 'Dr. Rui Tavares',
      desfecho: 'acordo',
      ajuizadoEm: '2026-02-10',
    },
  ],
  total: 1,
  doAcervo: 1,
  pagina: 1,
  paginas: 1,
  opcoes: { beneficios: ['Auxílio-Acidente'], foros: ['JEF São Paulo'], juizes: [], peritos: ['Dr. Rui Tavares'] },
}

let pedidos: { url: string; metodo: string; corpo?: Record<string, string> }[] = []
function servidor(corpo: object) {
  pedidos = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      pedidos.push({ url, metodo: init?.method ?? 'GET', corpo: init?.body ? JSON.parse(String(init.body)) : undefined })
      return new Response(JSON.stringify(corpo), { status: 200 })
    }),
  )
}
const ultimo = () => pedidos.at(-1)!

beforeEach(() => configurarExemplo({ agora: () => new Date(2026, 9, 9, 12), latencia: 0 }))
afterEach(() => vi.unstubAllGlobals())

describe('Clientes (GGVP-78)', () => {
  it('a base como no Figma: topo com Clientes aceso, filtros, a tabela, a contagem e a nota da situação', async () => {
    servidor(clientes)
    entrarComo('atendimento-lider')
    render(comSessao(<Clientes />))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Clientes')
    const topo = within(screen.getByRole('navigation', { name: 'Principal' }))
    expect(topo.getByRole('link', { name: 'Clientes' }).getAttribute('aria-current')).toBe('page')
    expect(topo.getByRole('link', { name: 'Processos' }).getAttribute('href')).toBe('/processos')
    // "+ Novo cliente" no topo e na página: é do Atendimento.
    expect(screen.getAllByRole('link', { name: '+ Novo cliente' })).toHaveLength(2)
    const filtros = within(screen.getByRole('group', { name: 'Filtros' }))
    expect(filtros.getAllByRole('combobox').map((s) => s.getAttribute('aria-label'))).toEqual(['Benefício', 'Localização', 'Êxito', 'Situação'])
    expect((filtros.getByRole('combobox', { name: 'Situação' }) as HTMLSelectElement).value).toBe('ativos')

    const tabela = await screen.findByRole('table', { name: 'Clientes' })
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Cliente', 'CPF', 'Benefício', 'Cidade', 'Processos', 'Situação / êxito', 'Último contato'])
    const [, seb, fer] = within(tabela).getAllByRole('row')
    expect(within(seb).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Sebastião Nunes', '***.982.247-**', 'Auxílio-Acidente', 'São Paulo · SP', '2', 'Em andamento', 'ontem'])
    expect(within(seb).getByRole('link', { name: 'Sebastião Nunes' }).getAttribute('href')).toBe(`/clientes/${SEB}`)
    expect(within(seb).getByRole('link', { name: '2 processos de Sebastião Nunes' }).getAttribute('href')).toBe(`/processos?cliente=${SEB}`)
    expect(within(fer).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Fernanda Ruiz', '—', '—', '—', '0', 'Lead', '—'])
    expect(screen.getByRole('status').textContent).toBe('1 cliente · 1 lead · mostrando 2')
    expect(screen.getByText(/Situação: Êxito = ganho, ganho parcial ou acordo já decidido/)).toBeTruthy()
    expect(screen.getByText('Página 1 de 3')).toBeTruthy()
  })

  it('a Sênior não tem "+ Novo cliente", que é do Atendimento', async () => {
    servidor(clientes)
    entrarComo('senior')
    render(comSessao(<Clientes />))
    await screen.findByRole('table', { name: 'Clientes' })
    expect(screen.queryByRole('link', { name: '+ Novo cliente' })).toBeNull()
  })

  it('a busca vai no corpo do POST, nunca no endereço; filtro e página vão na consulta', async () => {
    servidor(clientes)
    entrarComo('advogada')
    render(comSessao(<Clientes />))
    await screen.findByRole('table', { name: 'Clientes' })
    expect(ultimo()).toMatchObject({ url: '/api/clientes?situacao=ativos&ordem=contato&pagina=1', metodo: 'GET' })

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por nome, CPF ou telefone' }), { target: { value: '529.982' } })
    await waitFor(() => expect(ultimo()).toMatchObject({ url: '/api/clientes/busca', metodo: 'POST', corpo: { busca: '529.982' } }))
    expect(pedidos.some((p) => p.url.includes('529'))).toBe(false)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por nome, CPF ou telefone' }), { target: { value: '' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Situação' }), { target: { value: 'leads' } })
    await waitFor(() => expect(ultimo().url).toBe('/api/clientes?situacao=leads&ordem=contato&pagina=1'))
    fireEvent.click(screen.getByRole('button', { name: 'Próxima ›' }))
    await waitFor(() => expect(ultimo().url).toBe('/api/clientes?situacao=leads&ordem=contato&pagina=2'))
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() => expect(ultimo().url).toBe('/api/clientes?situacao=ativos&ordem=contato&pagina=1'))
  })

  it('Exportar CSV pede o filtro inteiro e baixa o arquivo', async () => {
    servidor(clientes)
    const criar = vi.fn(() => 'blob:clientes')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() }))
    entrarComo('atendimento-lider')
    render(comSessao(<Clientes />))
    await screen.findByRole('table', { name: 'Clientes' })
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))
    await waitFor(() => expect(criar).toHaveBeenCalled())
    expect(ultimo().url).toBe('/api/clientes?situacao=ativos&ordem=contato&tudo=1')
  })
})

describe('Processos (GGVP-78)', () => {
  it('cada processo numa linha: o número abre o processo, o autor abre a ficha', async () => {
    servidor(processos)
    entrarComo('advogada')
    render(comSessao(<Processos />))
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Processos')
    expect(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('link', { name: 'Processos' }).getAttribute('aria-current')).toBe('page')
    const filtros = within(screen.getByRole('group', { name: 'Filtros' }))
    expect(filtros.getAllByRole('combobox').map((s) => s.getAttribute('aria-label'))).toEqual(['Tribunal', 'Juiz', 'Perito', 'Benefício', 'Êxito', 'Fase'])

    const tabela = await screen.findByRole('table', { name: 'Processos' })
    expect(within(tabela).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Processo', 'Autor (cliente)', 'Benefício', 'Tribunal / foro', 'Juiz', 'Perito', 'Desfecho', 'Ajuizado'])
    const [, linha] = within(tabela).getAllByRole('row')
    expect(within(linha).getAllByRole('cell').map((c) => c.textContent)).toEqual([
      '5005290-87.2026.4.03.6301Judicial',
      'Sebastião Nunes',
      'Auxílio-Acidente',
      'JEF São Paulo',
      '—',
      'Dr. Rui Tavares',
      'Acordo',
      'fev/26',
    ])
    expect(within(linha).getByRole('link', { name: '5005290-87.2026.4.03.6301' }).getAttribute('href')).toBe(`/casos/${CASO}`)
    expect(within(linha).getByRole('link', { name: 'Sebastião Nunes' }).getAttribute('href')).toBe(`/clientes/${SEB}`)
    expect(screen.getByRole('status').textContent).toBe('1 processo · 1 lidos no Raio-X · mostrando 1')
    expect(screen.getByText(/Desfecho segue o Raio-X/)).toBeTruthy()
  })

  it('vindo da contagem em Clientes, só os processos daquele cliente; "Limpar" tira o filtro', async () => {
    servidor(processos)
    entrarComo('senior')
    render(comSessao(<Processos cliente={SEB} />))
    await screen.findByRole('table', { name: 'Processos' })
    expect(ultimo().url).toBe(`/api/processos?ordem=ajuizamento&cliente=${SEB}&pagina=1`)
    expect(screen.getByRole('status').textContent).toContain('só de Sebastião Nunes')
    fireEvent.change(screen.getByRole('combobox', { name: 'Fase' }), { target: { value: 'judicial' } })
    await waitFor(() => expect(ultimo().url).toBe(`/api/processos?fase=judicial&ordem=ajuizamento&cliente=${SEB}&pagina=1`))
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    await waitFor(() => expect(ultimo().url).toBe('/api/processos?ordem=ajuizamento&pagina=1'))
  })

  it('a busca pelo número vai no corpo do POST', async () => {
    servidor(processos)
    entrarComo('advogada')
    render(comSessao(<Processos />))
    await screen.findByRole('table', { name: 'Processos' })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Autor, nº do processo ou CPF' }), { target: { value: '5005290' } })
    await waitFor(() => expect(ultimo()).toMatchObject({ url: '/api/processos/busca', metodo: 'POST', corpo: { busca: '5005290' } }))
  })
})
