import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CumprirExigenciaJuiz } from './CumprirExigenciaJuiz.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const ITEM = '22222222-2222-4222-8222-222222222222'
const item = (extra = {}) => ({
  id: ITEM,
  descricao: 'Quem mora com a cliente',
  provaEsperada: null,
  prazoInterno: null,
  situacao: 'pendente',
  motivo: null,
  prova: null,
  informacao: null,
  proximoLembrete: null,
  limite: 3,
  escalada: false,
  tentativas: [],
  ...extra,
})
const pendencia = (setor: string, extra = {}) => ({
  origem: 'despacho',
  casoId: CASO,
  cliente: 'Sebastião Cruz (exemplo)',
  setor,
  pedidoPor: 'Helena (exemplo)',
  prazoProcessual: null,
  itens: [item(extra)],
})

function servidor(get: object, post: [number, unknown] = [201, { ok: true }]) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify(post[1]), { status: post[0] }) : new Response(JSON.stringify(get), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

describe('Cumprir pendência do despacho (GGVP-58)', () => {
  it('CA5, CA13 · "Cumprir pendência", quem pediu, sem prazo de entrega quando não foi dado e sem prazo do processo', async () => {
    const fetch = servidor(pendencia('atendimento'))
    render(<CumprirExigenciaJuiz casoId={CASO} origem="despacho" />)
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Cumprir pendência')
    expect(screen.getByText(/pedido por Helena/)).toBeTruthy()
    expect(screen.getByText('Sem prazo de entrega')).toBeTruthy()
    expect(screen.queryByText(/prazo do processo/)).toBeNull()
    expect(String(fetch.mock.calls[0][0])).toBe(`/api/casos/${CASO}/pendencias/setor`)
  })

  it('CA1, CA7 · o Atendimento sobe com a informação escrita; sem ela, nem documento, não sobe', async () => {
    const fetch = servidor(pendencia('atendimento'))
    render(<CumprirExigenciaJuiz casoId={CASO} origem="despacho" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Consegui, subir no card' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva a informação que conseguiu com o cliente ou anexe um documento (PDF ou imagem, até 25 MB).')
    fireEvent.change(screen.getByLabelText('O que conseguiu com o cliente'), { target: { value: 'Mora com o filho e a nora' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consegui, subir no card' }))
    expect((await screen.findByRole('status')).textContent).toBe('Subiu no card. O item está concluído.')
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect([String(post[0]), (post[1]!.body as FormData).get('informacao')]).toEqual([`/api/casos/${CASO}/pendencias/itens/${ITEM}/prova`, 'Mora com o filho e a nora'])
  })

  it('CA2, CA5 · a Documentação sobe com o documento, e o prazo de entrega aparece quando a Sênior deu um', async () => {
    servidor(pendencia('documentacao', { descricao: 'Laudo atualizado', prazoInterno: '2026-10-20' }))
    render(<CumprirExigenciaJuiz casoId={CASO} origem="despacho" />)
    expect((await screen.findByText(/Entregar até/)).textContent).toBe('Entregar até 20/10/2026')
    expect(screen.queryByLabelText('O que conseguiu com o cliente')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar documento e concluir' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Anexe o documento do item (PDF ou imagem, até 25 MB).')
  })

  it('CA7 · subido no card, mostra a informação como a prova', async () => {
    servidor(pendencia('atendimento', { situacao: 'cumprido', informacao: 'Mora com o filho e a nora' }))
    render(<CumprirExigenciaJuiz casoId={CASO} origem="despacho" />)
    expect((await screen.findByText(/^Cumprido/)).textContent).toBe('Cumprido · Mora com o filho e a nora')
  })
})
