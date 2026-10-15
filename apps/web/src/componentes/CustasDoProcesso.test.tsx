import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustasDoProcesso as Custas } from '@ggv/contratos'
import { configurarExemplo } from '../dados/servidor.ts'
import { CustasDoProcesso } from './CustasDoProcesso.tsx'

const CASO = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
const UBER = '11111111-1111-4111-8111-111111111111'
const COPIAS = '22222222-2222-4222-8222-222222222222'
const COMISSAO = '33333333-3333-4333-8333-333333333333'

function custas(extra: Partial<Custas> = {}): Custas {
  return {
    casoId: CASO,
    cliente: 'Cliente Inventada',
    beneficio: 'BPC/LOAS idoso',
    origem: 'justica',
    totais: { ganhos: '1500.00', custos: '310.10', lucro: '1189.90', esperando: '45.90' },
    lancamentos: [
      { id: UBER, data: '2026-10-05', descricao: 'Uber para levar o cliente à perícia', lancadoPor: 'Helena', valor: '45.90', situacao: 'esperando', motivo: null },
      { id: COPIAS, data: '2026-10-04', descricao: 'Cópias do processo', lancadoPor: 'Júlia', valor: '10.10', situacao: 'aprovado', motivo: null },
      { id: COMISSAO, data: '2026-10-01', descricao: 'Comissão de captação', lancadoPor: 'Helena', valor: '300.00', situacao: 'recusado', motivo: 'Comprovante ilegível' },
    ],
    podeLancar: true,
    podeAprovar: false,
    ...extra,
  }
}

/** O servidor de mentira: o GET devolve as custas; o POST responde com `post` (ou erro). */
function servidor(dados: Custas | null, post: { status: number; corpo: object } = { status: 201, corpo: { situacao: 'esperando' } }) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? new Response(JSON.stringify(post.corpo), { status: post.status })
      : dados
        ? new Response(JSON.stringify(dados))
        : new Response(JSON.stringify({ erro: 'Sem permissão para esta ação.' }), { status: 403 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const posts = (fetch: ReturnType<typeof servidor>) => fetch.mock.calls.filter(([, init]) => init?.method === 'POST')
const linha = (texto: string) => screen.getByText(texto).closest('tr')!

beforeEach(() => configurarExemplo({ agora: () => new Date(2026, 9, 9, 10, 0) }))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('GGVP-157 · card "Custas do processo"', () => {
  it('CA1 · os quatro totais, a etiqueta de acesso e cada lançamento com data, descrição, quem lançou, valor, comprovante e situação', async () => {
    servidor(custas({ podeLancar: false }))
    render(<CustasDoProcesso casoId={CASO} />)
    const card = await screen.findByRole('region', { name: 'Custas do processo' })
    expect(within(card).getByText('Cliente Inventada · BPC/LOAS idoso · Justiça')).toBeTruthy()
    expect(within(card).getByText('Só sócios, Financeiro e Sênior')).toBeTruthy()
    const total = (rotulo: string) => [...card.querySelectorAll('dt')].find((dt) => dt.textContent === rotulo)?.nextElementSibling?.textContent
    expect([total('Ganhos (honorários)'), total('Custos aprovados'), total('Lucro do processo'), total('Esperando o Financeiro')]).toEqual(['R$ 1.500,00', 'R$ 310,10', 'R$ 1.189,90', 'R$ 45,90'])

    const uber = within(linha('Uber para levar o cliente à perícia'))
    expect(['05/10/2026', 'Helena', 'R$ 45,90', 'Esperando o Financeiro'].every((t) => uber.getByText(t))).toBe(true)
    expect(uber.getByRole('link', { name: /Abrir o comprovante/ }).getAttribute('href')).toBe(`/api/casos/${CASO}/custas/${UBER}/comprovante`)
    expect(within(linha('Cópias do processo')).getByText('Aprovado')).toBeTruthy()
    const recusada = within(linha('Comissão de captação'))
    expect([recusada.getByText('Recusado'), recusada.getByText('Motivo: Comprovante ilegível')].every(Boolean)).toBe(true)

    // O sócio só lê: sem "Lançar custo" nem aprovar.
    expect(screen.queryByRole('button', { name: 'Enviar ao Financeiro' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Aprovar' })).toBeNull()
    expect(within(card).getByText(/Só conta no lucro depois que o Financeiro aprova\. O custo não entra na prestação de contas do cliente\./)).toBeTruthy()
  })

  it('CA4 · lucro negativo aparece com o sinal', async () => {
    servidor(custas({ totais: { ganhos: '0.00', custos: '80.00', lucro: '-80.00', esperando: '0.00' } }))
    render(<CustasDoProcesso casoId={CASO} />)
    expect((await screen.findByText('Lucro do processo')).nextElementSibling?.textContent).toBe('R$ -80,00')
  })

  it('CA2 · sem comprovante não envia, e o erro de cada campo aparece embaixo dele', async () => {
    const fetch = servidor(custas())
    render(<CustasDoProcesso casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar ao Financeiro' }))
    expect(screen.getByText('Descreva o gasto.')).toBeTruthy()
    expect(screen.getByText(/Valor inválido/)).toBeTruthy()
    expect(screen.getByText('Anexe o comprovante (foto ou PDF) para enviar.')).toBeTruthy()
    expect(screen.getByLabelText('Descrição').getAttribute('aria-invalid')).toBe('true')
    expect(posts(fetch)).toHaveLength(0)
  })

  it('CA2 · com data, descrição, valor e o comprovante, envia ao Financeiro e mostra o card de novo', async () => {
    const fetch = servidor(custas())
    render(<CustasDoProcesso casoId={CASO} />)
    expect((await screen.findByLabelText('Data')).getAttribute('value')).toBe('09/10/2026')
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Táxi até o INSS' } })
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '32,50' } })
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '08102026' } })
    const foto = new File(['foto'], 'recibo.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText(/Anexar comprovante/), { target: { files: [foto] } })
    expect(screen.getByText('recibo.jpg')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ao Financeiro' }))

    expect(await screen.findByText('Enviado ao Financeiro. Conta no lucro depois que ele aprovar.')).toBeTruthy()
    const [url, init] = posts(fetch)[0]
    const corpo = init!.body as FormData
    expect([url, corpo.get('descricao'), corpo.get('valor'), corpo.get('data'), (corpo.get('arquivo') as File).name]).toEqual([`/api/casos/${CASO}/custas`, 'Táxi até o INSS', '32,50', '08/10/2026', 'recibo.jpg'])
    expect(fetch.mock.calls.filter(([, i]) => !i?.method || i.method === 'GET')).toHaveLength(2)
    expect((screen.getByLabelText('Descrição') as HTMLInputElement).value).toBe('')
  })

  it('o erro do servidor aparece no card', async () => {
    servidor(custas(), { status: 400, corpo: { erro: 'A data do gasto não pode ser depois de hoje.' } })
    render(<CustasDoProcesso casoId={CASO} />)
    fireEvent.change(await screen.findByLabelText('Descrição'), { target: { value: 'Táxi' } })
    fireEvent.change(screen.getByLabelText('Valor (R$)'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText(/Anexar comprovante/), { target: { files: [new File(['%PDF'], 'recibo.pdf', { type: 'application/pdf' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar ao Financeiro' }))
    expect((await screen.findByRole('alert')).textContent).toBe('A data do gasto não pode ser depois de hoje.')
  })

  it('CA7 · o servidor recusa (outro perfil): o card não aparece', async () => {
    const fetch = servidor(null)
    const { container } = render(<CustasDoProcesso casoId={CASO} />)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    await vi.waitFor(() => expect(container.textContent).toBe(''))
    expect(screen.queryByText(/R\$/)).toBeNull()
  })
})
