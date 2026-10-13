import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RecursoDoCaso } from '@ggv/contratos'
import { DecidirRecurso } from './DecidirRecurso.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const base: RecursoDoCaso = {
  casoId: CASO,
  pessoaId: '7a2b3c4d-5e6f-4a1b-9c2d-3e4f5a6b7c8d',
  cliente: 'Sérgio Nunes (exemplo)',
  beneficio: 'Auxílio-Acidente',
  sentenca: { disponibilizadaEm: '2026-10-05', texto: 'Sentença: julgo improcedente o pedido.' },
  prazo: { fim: '2026-10-20', regra: 'Recurso contra a sentença: 10 dias úteis (lado seguro, G12)' },
  chance: { porcentagem: null, casos: 0, favoraveis: 0, baseEm: null, regra: 'providos sobre julgados' },
  avaliacao: null,
  motivoIa: null,
  decisao: null,
  podeDecidir: true,
}

function servidor(get: RecursoDoCaso) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify({ ok: true }), { status: 201 }) : new Response(JSON.stringify(get)),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

describe('Decidir recurso (GGVP-100)', () => {
  it('CA4, CA8 · o prazo recursal em destaque, contado pelo sistema; sem recurso julgado no acervo, diz que não há número', async () => {
    servidor(base)
    render(<DecidirRecurso casoId={CASO} />)
    expect((await screen.findByText('20/10/2026')).tagName).toBe('STRONG')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sérgio Nunes (exemplo) · Decidir recurso')
    expect(screen.getByText('Sem dados ainda: nenhum recurso julgado de caso parecido no acervo.')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Antes de concluir' })).toBeTruthy()
  })

  it('GGVP-161 CA2 · a chance vem dos recursos julgados, com quantos casos e a data da base', async () => {
    servidor({ ...base, chance: { porcentagem: 67, casos: 3, favoraveis: 2, baseEm: '2026-10-12T15:00:00.000Z', regra: 'providos sobre julgados' } })
    render(<DecidirRecurso casoId={CASO} />)
    expect(await screen.findByText('67% · 2 de 3 recursos julgados · base de 12/10 (providos sobre julgados)')).toBeTruthy()
  })

  it('GGVP-161 CA3 · a avaliação da IA chega pronta, marcada como sugestão, com as fontes', async () => {
    const avaliacao = {
      chamadaId: '8b3c4d5e-6f7a-4b2c-8d3e-4f5a6b7c8d9e',
      sugestao: true as const,
      texto: 'Bom para recorrer: o laudo não respondeu aos quesitos.',
      fontes: [{ tipo: 'acervo' as const, referencia: 'caso-1', trecho: 'Caso parecido (exemplo): recurso provido' }],
      modelo: 'exemplo',
      geradaEm: '2026-10-12T15:00:00.000Z',
      alerta: null,
    }
    servidor({ ...base, avaliacao })
    render(<DecidirRecurso casoId={CASO} />)
    const cartao = await screen.findByRole('region', { name: 'Avaliação da IA' })
    expect(cartao.textContent).toContain('Sugestão da IA · confira')
    expect(cartao.textContent).toContain('Bom para recorrer: o laudo não respondeu aos quesitos.')
    expect(screen.getByRole('list', { name: 'Fontes da avaliação' }).textContent).toContain('Caso parecido (exemplo): recurso provido')
  })

  it('GGVP-161 CA5 · sem resposta da IA, diz o motivo e a decisão segue com a Sênior', async () => {
    servidor({ ...base, motivoIa: 'A IA não trouxe a avaliação agora: a decisão fica com a sua leitura.' })
    render(<DecidirRecurso casoId={CASO} />)
    expect(await screen.findByText('A IA não trouxe a avaliação agora: a decisão fica com a sua leitura.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Registrar' })).toBeTruthy()
  })

  it('CA3 · "Registrar" só habilita com a escolha e a justificativa; envia as duas', async () => {
    const fetch = servidor(base)
    render(<DecidirRecurso casoId={CASO} />)
    const registrar = (await screen.findByRole('button', { name: 'Registrar' })) as HTMLButtonElement
    expect(registrar.disabled).toBe(true)
    expect(screen.getByText('Escolha se vale recorrer')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Sim, recorrer' }))
    expect(registrar.disabled).toBe(true)
    expect(screen.getByText('Escreva a justificativa')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Justificativa *'), { target: { value: 'O laudo ignorou o médico assistente.' } })
    expect(registrar.disabled).toBe(false)
    fireEvent.click(registrar)
    await vi.waitFor(() => expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true))
    const [, init] = fetch.mock.calls.find(([, i]) => i?.method === 'POST')!
    expect(JSON.parse(String(init?.body))).toEqual({ decisao: 'recorrer', justificativa: 'O laudo ignorou o médico assistente.' })
  })

  it('CA3 · decidido, mostra quem decidiu e a justificativa; quem só lê não vê os botões', async () => {
    servidor({ ...base, podeDecidir: false, decisao: { decisao: 'nao_recorrer', justificativa: 'Laudo firme, sem prova nova.', por: 'Helena (exemplo)', em: '2026-10-09T13:00:00.000Z' } })
    render(<DecidirRecurso casoId={CASO} />)
    expect((await screen.findByRole('heading', { name: '✓ Não, encerrar com estudo de caso' })).textContent).toBeTruthy()
    expect(screen.getByText(/Decidido por Helena \(exemplo\) em .*Justificativa: Laudo firme, sem prova nova\./)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Registrar' })).toBeNull()
  })

  it('quem só lê, antes da decisão, vê que a decisão é da Sênior', async () => {
    servidor({ ...base, podeDecidir: false })
    render(<DecidirRecurso casoId={CASO} />)
    expect(await screen.findByText('A decisão é da Sênior e ainda não foi registrada.')).toBeTruthy()
    expect(screen.queryByRole('radio')).toBeNull()
  })
})
