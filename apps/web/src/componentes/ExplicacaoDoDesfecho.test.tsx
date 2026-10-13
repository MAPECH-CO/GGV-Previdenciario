import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ExplicacaoDoDesfecho } from './ExplicacaoDoDesfecho.tsx'
const casoId = '11111111-1111-4111-8111-111111111111'
const base = { casoId, cliente: 'Pessoa Inventada Teste', contatos: [], podeAprovar: false, podeRegistrar: true, encerrado: false }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('não busca nem oferece explicação antes do desfecho', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render(<ExplicacaoDoDesfecho casoId={casoId} desfecho={null} />)
  expect(fetch).not.toHaveBeenCalled()
  expect(screen.queryByRole('link')).toBeNull()
})
it('abre o resumo aprovado que veio do servidor', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...base, resumo: { texto: 'Texto inventado aprovado.', aprovadoPor: 'Advogada Fictícia', aprovadoEm: '2030-10-10', quemFala: 'atendimento' } }))))
  render(<ExplicacaoDoDesfecho casoId={casoId} desfecho="improcedente" />)
  expect((await screen.findByRole('link')).getAttribute('href')).toBe('/casos/' + casoId + '/resultado')
})
it('sem aprovação não oferece o texto', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...base, resumo: null }))))
  render(<ExplicacaoDoDesfecho casoId={casoId} desfecho="deferido" />)
  expect(await screen.findByText('A explicação aguarda o texto aprovado pelo Jurídico.')).toBeTruthy()
  expect(screen.queryByRole('link')).toBeNull()
})
it('uma falha não vira explicação fictícia', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ erro: 'Indisponível' }), { status: 503 })))
  render(<ExplicacaoDoDesfecho casoId={casoId} desfecho="deferido" />)
  expect(await screen.findByText('A explicação do resultado ainda não está disponível.')).toBeTruthy()
  expect(screen.queryByRole('link')).toBeNull()
})
