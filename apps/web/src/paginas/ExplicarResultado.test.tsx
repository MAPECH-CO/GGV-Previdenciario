import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ResultadoParaExplicar } from '@ggv/contratos'
import { ExplicarResultado } from './ExplicarResultado.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const base: ResultadoParaExplicar = { casoId: CASO, cliente: 'Paulo Mendes (exemplo)', resumo: null, contatos: [], podeAprovar: true, podeRegistrar: false, encerrado: false }
const RESUMO = { texto: 'O juiz não viu prova da incapacidade no período pedido.', aprovadoPor: 'Gabi (exemplo)', aprovadoEm: '2026-10-07T18:00:00.000Z', quemFala: 'atendimento' as const }

function servidor(get: ResultadoParaExplicar) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify({ ok: true }), { status: 201 }) : new Response(JSON.stringify(get)),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())
const corpoDo = (fetch: ReturnType<typeof servidor>, fim: string) =>
  JSON.parse(String(fetch.mock.calls.find(([url, init]) => String(url).endsWith(fim) && init?.method === 'POST')?.[1]?.body))

describe('Explicar o resultado (GGVP-22)', () => {
  it('épico IA · ao abrir, o rascunho da IA já está na caixa, com o selo, e a aprovação leva a chamada', async () => {
    const CHAMADA = '55555555-5555-4555-8555-555555555555'
    const sugestao = { chamadaId: CHAMADA, sugestao: true, texto: 'O juiz entendeu que faltou prova da incapacidade.', fontes: [], modelo: 'gpt-4.1-mini', geradaEm: '2026-10-07T20:00:00.000Z', alerta: null }
    const fetch = vi.fn(async (url: string, init?: RequestInit) =>
      init?.method !== 'POST'
        ? new Response(JSON.stringify(base))
        : String(url).endsWith('/resultado/sugestao')
          ? new Response(JSON.stringify({ sugestao, motivo: null }))
          : new Response(JSON.stringify({ ok: true }), { status: 201 }),
    )
    vi.stubGlobal('fetch', fetch)
    render(<ExplicarResultado casoId={CASO} />)
    expect(await screen.findByText('Rascunho da IA · complete e confira antes de aprovar')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sugerir o resumo com a IA' })).toBeNull()
    expect((screen.getByLabelText('O que dizer ao cliente') as HTMLTextAreaElement).value).toBe(sugestao.texto)
    fireEvent.click(screen.getByLabelText('O Atendimento, no padrão'))
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar o resumo' }))
    expect((await screen.findByRole('status')).textContent).toBe('Resumo aprovado. O Atendimento vai explicar ao cliente.')
    expect(corpoDo(fetch, '/resultado/resumo')).toEqual({ texto: sugestao.texto, quemFala: 'atendimento', chamadaIaId: CHAMADA })
  })

  it('CA3, CA5 · o Jurídico escreve, escolhe quem fala e aprova; sem escolher, não envia', async () => {
    const fetch = servidor(base)
    render(<ExplicarResultado casoId={CASO} />)
    fireEvent.change(await screen.findByLabelText('O que dizer ao cliente'), { target: { value: RESUMO.texto } })
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar o resumo' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escolha quem fala com o cliente')
    fireEvent.click(screen.getByLabelText('Eu ligo (caso complexo)'))
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar o resumo' }))
    expect((await screen.findByRole('status')).textContent).toBe('Resumo aprovado. A explicação ficou com você.')
    expect(corpoDo(fetch, '/resultado/resumo')).toEqual({ texto: RESUMO.texto, quemFala: 'advogada' })
  })

  it('CA6 · com "[completar]" no texto, mostra o motivo e não envia', async () => {
    const fetch = servidor(base)
    render(<ExplicarResultado casoId={CASO} />)
    fireEvent.change(await screen.findByLabelText('O que dizer ao cliente'), { target: { value: `${RESUMO.texto} [completar: o motivo da decisão]` } })
    fireEvent.click(screen.getByLabelText('O Atendimento, no padrão'))
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar o resumo' }))
    expect((await screen.findByRole('alert')).textContent).toBe('O texto ainda tem [completar]: preencha antes de aprovar.')
    expect(fetch.mock.calls.filter(([url, init]) => init?.method === 'POST' && String(url).endsWith('/resultado/resumo'))).toEqual([])
  })

  it('CA3, CA4 · quem fala vê o resumo com quem aprovou; "Expliquei" pede o que foi dito', async () => {
    const fetch = servidor({ ...base, resumo: RESUMO, podeAprovar: false, podeRegistrar: true })
    render(<ExplicarResultado casoId={CASO} />)
    expect((await screen.findByText(/Aprovado pelo Jurídico: Gabi \(exemplo\)/)).textContent).toContain('fala com o cliente: o Atendimento')
    fireEvent.click(screen.getByRole('button', { name: 'Expliquei ao cliente' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva o que foi explicado ao cliente')
    fireEvent.click(screen.getByRole('button', { name: 'Sem contato, tentar de novo' }))
    expect((await screen.findByRole('status')).textContent).toBe('Tentativa registrada. A tarefa continua aberta.')
    expect(corpoDo(fetch, '/resultado/contato')).toEqual({ resultado: 'sem_contato', canal: 'telefone' })
  })

  it('CA2 · encerrado, mostra "Perdemos: estudo registrado" e os contatos', async () => {
    servidor({ ...base, resumo: RESUMO, podeAprovar: false, encerrado: true, contatos: [{ quando: '2026-10-08T13:00:00.000Z', canal: 'whatsapp', explicado: 'Expliquei a sentença.', quem: 'Ana (exemplo)' }] })
    render(<ExplicarResultado casoId={CASO} />)
    expect(await screen.findByText('Perdemos: estudo registrado')).toBeTruthy()
    expect(screen.getByLabelText('Contatos').textContent).toContain('WhatsApp · Ana (exemplo) · Expliquei a sentença.')
  })
})
