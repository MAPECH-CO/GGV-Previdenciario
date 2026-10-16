import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MSG_ESCOLHA_O_PROCESSO, NovoCusto } from './NovoCusto.tsx'

const CASO = '7a2d3c4b-5e6f-4a70-9b8c-1d2e3f4a5b6c'
const MARIA = { casoId: CASO, cliente: 'Maria Souza (exemplo)', beneficio: 'BPC/LOAS Deficiente', fase: 'Administrativa' }

function servidor() {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith('/api/custas/processos')) return new Response(JSON.stringify(url.includes('maria') ? [MARIA] : []), { status: 200 })
    if (url === `/api/casos/${CASO}/custas` && init?.method === 'POST') return new Response(JSON.stringify({ situacao: 'aprovado' }), { status: 201 })
    return new Response('{}', { status: 404 })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => vi.unstubAllGlobals())

describe('Novo custo (Pedro, 16/10)', () => {
  it('acha o processo pelo nome, escolhe um, preenche e lança: o custo vai ao processo escolhido', async () => {
    const fetch = servidor()
    const aoLancar = vi.fn()
    render(<NovoCusto podeAprovar aoFechar={() => {}} aoLancar={aoLancar} />)
    fireEvent.change(screen.getByRole('searchbox', { name: /Buscar o processo/ }), { target: { value: 'maria' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Maria Souza (exemplo) · BPC/LOAS Deficiente · Administrativa' }))
    expect(screen.getByRole('button', { name: 'Trocar' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Uber para a perícia' } })
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '14,90' } })
    fireEvent.change(screen.getByLabelText(/Anexar comprovante/), { target: { files: [new File(['x'], 'recibo.jpg', { type: 'image/jpeg' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Lançar (já entra aprovado)' }))
    await waitFor(() => expect(aoLancar).toHaveBeenCalledWith('Maria Souza (exemplo): Custo lançado e já aprovado.'))
    const envio = fetch.mock.calls.find(([url]) => url === `/api/casos/${CASO}/custas`)
    expect(envio?.[1]?.method).toBe('POST')
  })

  it('sem escolher o processo, não envia e pede a escolha; busca sem achado diz que não achou', async () => {
    const fetch = servidor()
    render(<NovoCusto podeAprovar={false} aoFechar={() => {}} aoLancar={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ao Financeiro' }))
    expect((await screen.findByRole('alert')).textContent).toBe(MSG_ESCOLHA_O_PROCESSO)
    fireEvent.change(screen.getByRole('searchbox', { name: /Buscar o processo/ }), { target: { value: 'ninguém' } })
    expect(await screen.findByText('Nenhum processo com esse nome, CPF ou telefone.')).toBeTruthy()
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/custas') && !String(url).includes('processos'))).toBe(false)
  })
})
