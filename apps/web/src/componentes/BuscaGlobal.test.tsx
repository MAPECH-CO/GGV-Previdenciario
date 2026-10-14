import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { BuscaGlobal } from './BuscaGlobal.tsx'
import { SessaoContexto } from '../sessao.ts'
const clienteId = '10000000-0000-4000-8000-000000000001'
const casoId = '20000000-0000-4000-8000-000000000002'
const usuario = { nome: 'Pessoa Operadora Inventada', email: 'operadora@example.invalid', perfis: ['atendimento'], perfilAtivo: 'atendimento', trocarSenha: false }
const clientes = { clientes: [{ id: clienteId, nome: 'Cliente Inventado Busca', cpf: null, beneficio: null, cidade: null, processos: 1, situacao: 'em_andamento', ultimoContato: null }], total: 1, leads: 0, pagina: 1, paginas: 1, opcoes: { beneficios: [], cidades: [] } }
const processos = { processos: [{ id: casoId, clienteId, numero: '1234567890', autor: 'Cliente Inventado Busca', beneficio: null, fase: 'administrativa', foro: null, juiz: null, perito: null, desfecho: 'em_andamento', ajuizadoEm: null }], total: 1, doAcervo: 0, pagina: 1, paginas: 1, opcoes: { beneficios: [], foros: [], juizes: [], peritos: [] } }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function tela(perfil = 'atendimento') {
  return render(<SessaoContexto value={{ ...usuario, perfilAtivo: perfil }}><BuscaGlobal /></SessaoContexto>)
}
function buscar(termo = 'Cliente Inventado') {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: termo } })
  fireEvent.submit(screen.getByRole('search'))
}
it('consulta as duas bases por POST e abre cliente e processo sem ler exemplos', async () => {
  const fetch = vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/clientes/busca' ? clientes : processos)))
  vi.stubGlobal('fetch', fetch)
  tela('advogada')
  expect(fetch).not.toHaveBeenCalled()
  buscar('1234567890')
  expect((await screen.findByRole('link', { name: '1234567890 · Cliente Inventado Busca' })).getAttribute('href')).toBe('/casos/' + casoId)
  expect(screen.getByRole('link', { name: 'Cliente Inventado Busca' }).getAttribute('href')).toBe('/clientes/' + clienteId)
  expect(fetch).toHaveBeenCalledTimes(2)
  for (const [url, init] of fetch.mock.calls as unknown as [string, RequestInit][]) {
    expect(url).not.toContain('1234567890')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body)).busca).toBe('1234567890')
  }
})
it.each(['atendimento', 'atendimento_lider', 'documentacao'])('GGVP-162 CA2 · %s busca só clientes: a API de processos nem é chamada', async (perfil) => {
  const fetch = vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/clientes/busca' ? clientes : processos)))
  vi.stubGlobal('fetch', fetch)
  tela(perfil)
  expect(screen.getByRole('searchbox').getAttribute('placeholder')).toBe('Cliente, CPF ou telefone')
  buscar('Cliente Inventado')
  expect((await screen.findByRole('link', { name: 'Cliente Inventado Busca' })).getAttribute('href')).toBe('/clientes/' + clienteId)
  expect(screen.queryByRole('heading', { name: /Casos e processos/ })).toBeNull()
  expect(screen.queryByRole('link', { name: /1234567890/ })).toBeNull()
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/api/clientes/busca'])
})
it('sem acesso ao caso não oferece busca nem chama a API', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  tela('captador')
  expect(screen.queryByRole('searchbox')).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})
it.each([403, 500])('falha %s mostra indisponibilidade, sem resultado antigo ou exemplo', async status => {
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
it('resposta atrasada não restaura o resultado depois de apagar o campo', async () => {
  const respostas: (() => void)[] = []
  vi.stubGlobal('fetch', vi.fn((url: string) => new Promise<Response>(resolve => respostas.push(() => resolve(new Response(JSON.stringify(url.includes('clientes') ? clientes : processos)))))))
  tela()
  buscar()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } })
  await act(async () => { respostas.forEach(r => r()) })
  expect(screen.queryByRole('link')).toBeNull()
  expect(screen.queryByText('Buscando no servidor…')).toBeNull()
})
it('pagina a busca pelo servidor sem colocar o termo no endereço', async () => {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => new Response(JSON.stringify({ ...(url.includes('clientes') ? clientes : processos), pagina: Number(JSON.parse(String(init?.body)).pagina), paginas: 2, total: 51 })))
  vi.stubGlobal('fetch', fetch)
  tela()
  buscar()
  fireEvent.click(await screen.findByRole('button', { name: 'Próxima' }))
  await screen.findByText('Página 2 de 2')
  expect(JSON.parse(String(fetch.mock.calls.at(-1)?.[1]?.body)).pagina).toBe('2')
})
it('trocar o perfil ativo retira resultados que já estavam visíveis', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('clientes') ? clientes : processos))))
  const r = tela()
  buscar()
  await screen.findByRole('link', { name: 'Cliente Inventado Busca' })
  r.rerender(<SessaoContexto value={{ ...usuario, perfilAtivo: 'captador' }}><BuscaGlobal /></SessaoContexto>)
  expect(screen.queryByRole('link')).toBeNull()
})
