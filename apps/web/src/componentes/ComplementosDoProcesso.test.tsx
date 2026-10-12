import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ComplementosDoProcesso } from './ComplementosDoProcesso.tsx'
import { SessaoContexto } from '../sessao.ts'
const casoId = '20000000-0000-4000-8000-000000000002'
const peritoId = '30000000-0000-4000-8000-000000000003'
const juizo = { juizo: 'Tribunal Inventado · 0001', vara: 'Vara Inventada', juiz: 'Pessoa Julgadora Inventada', entendimentos: [], base: '2030-10-01', porBeneficio: [], tempoAteASentenca: null, processos: [] }
function tela(perfil = 'advogada') {
  render(<SessaoContexto value={{ nome: 'Pessoa Operadora Inventada', email: 'operadora@example.invalid', perfis: [perfil], perfilAtivo: perfil, trocarSenha: false }}><ComplementosDoProcesso casoId={casoId} /></SessaoContexto>)
}
function servidor(recusar = false, doLaudo = false) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return new Response(JSON.stringify(recusar ? { erro: 'Recusado no teste' } : { pericia: { peritoId }, perfil: { perito: { nome: 'Perita Inventada' } } }), { status: recusar ? 409 : 200 })
    const dados = url.endsWith('/juizo') ? juizo
      : url.endsWith('/parecer') ? { processo: { id: casoId }, laudoNovoEm: '2030-10-02', juridico: { analise: { resumo: 'Conteúdo médico inventado que não pertence ao status' } } }
      : url === '/api/peritos' ? [{ id: peritoId, nome: 'Perita Inventada', especialidade: 'Especialidade inventada', tipo: 'medica' }]
      : { pericia: { tipo: 'medica', peritoLido: 'Nome ainda não conferido', ...(doLaudo && { resultado: { noPerfil: 'aguardando-perito' } }) } }
    return new Response(JSON.stringify(dados))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('mostra o status do laudo e a estratégia indisponível sem criar conteúdo (o juízo fica no cartão "Juízo e perícia")', async () => {
  servidor()
  tela()
  expect(await screen.findByText(/Há laudo novo desde 02\/10\/2030/)).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Analisar o laudo novo' }).getAttribute('href')).toBe('/casos/' + casoId + '/laudo-novo')
  expect(screen.getByLabelText('Estratégia do processo').textContent).toContain('ainda não estão disponíveis')
  expect(screen.queryByText(/Conteúdo médico inventado/)).toBeNull()
})
it.each(['atendimento', 'documentacao', 'financeiro'])('%s vê a existência do laudo sem conteúdo nem ação jurídica', async perfil => {
  const fetch = servidor()
  tela(perfil)
  await screen.findByText(/Há laudo novo desde/)
  expect(screen.queryByRole('link', { name: 'Analisar o laudo novo' })).toBeNull()
  expect(screen.queryByLabelText('Identificação do perito')).toBeNull()
  expect(fetch.mock.calls.some(([url]) => url.endsWith('/juizo') || url.endsWith('/pericia'))).toBe(false)
})
it.each(['advogada', 'senior', 'socio'])('%s pode consultar os complementos jurídicos', async perfil => {
  servidor()
  tela(perfil)
  expect(await screen.findByLabelText('Estratégia do processo')).toBeTruthy()
})
it('confirma o perito pela API e só informa sucesso após a resposta', async () => {
  const fetch = servidor()
  tela('juridico_adm')
  fireEvent.click(await screen.findByRole('button', { name: /Perita Inventada/ }))
  expect(await screen.findByText('Perito identificado no processo.')).toBeTruthy()
  const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
  expect(post[0]).toBe('/api/processos/' + casoId + '/pericia/perito')
  expect(JSON.parse(String(post[1]?.body))).toEqual({ peritoId })
})
it('laudo que aguarda perito usa a rota específica de vinculação', async () => {
  const fetch = servidor(false, true)
  tela()
  fireEvent.click(await screen.findByRole('button', { name: /Perita Inventada/ }))
  await screen.findByText('Perito identificado no processo.')
  expect(fetch.mock.calls.some(([url, init]) => url.endsWith('/laudo/perito') && init?.method === 'POST')).toBe(true)
})
it('recusa não informa sucesso e mantém a pergunta disponível', async () => {
  servidor(true)
  tela('juridico_adm')
  fireEvent.click(await screen.findByRole('button', { name: /Perita Inventada/ }))
  expect(await screen.findByText('O servidor não confirmou a identificação do perito.')).toBeTruthy()
  expect(screen.queryByText('Perito identificado no processo.')).toBeNull()
})
it('API indisponível não vira nenhum laudo novo nem dados de exemplo', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
  tela()
  expect(await screen.findByText('A consulta de laudo novo está indisponível.')).toBeTruthy()
  expect(within(screen.getByLabelText('Laudo novo do processo')).queryByText('Nenhum laudo novo aguardando análise.')).toBeNull()
})
