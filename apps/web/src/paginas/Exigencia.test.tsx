import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CumprirExigencia } from './CumprirExigencia.tsx'
import { TratarExigencia } from './TratarExigencia.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const ITEM = '11111111-1111-4111-8111-111111111111'
const base = {
  casoId: CASO,
  exigenciaId: '22222222-2222-4222-8222-222222222222',
  cliente: 'Teresa Dias (exemplo)',
  beneficio: 'bpc_loas_idoso',
  texto: 'Apresentar CadÚnico.',
  data: '2026-10-02',
  diasInss: null,
  prazo: null,
  regraPrazo: null,
  feriadosCadastrados: false,
  pede: null,
  situacao: 'aberta',
  vencida: false,
  itens: [],
  pericias: [],
  card: null,
  podeDecidir: true,
  podeCumprir: false,
  podeDecidirVencida: false,
}
const comCard = {
  ...base,
  pede: 'documentos',
  diasInss: 30,
  prazo: '2026-11-02',
  regraPrazo: 'Dias corridos (Lei 9.784, art. 66)',
  podeDecidir: false,
  podeCumprir: true,
  itens: [{ id: ITEM, descricao: 'CadÚnico', situacao: 'pendente', motivo: null, prova: null }],
  card: { prazoEntrega: '2026-10-20', proximoLembrete: '2026-10-07', tentativas: 1, limite: 3, escalada: false, cobrancas: [] },
}

/** GET devolve `get` (com a prévia do prazo quando há ?dias=); POST devolve `post`. */
function servidor(get: object, post: [number, unknown] = [201, { ok: true }]) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return new Response(JSON.stringify(post[1]), { status: post[0] })
    const dias = new URL(url, 'http://x').searchParams.get('dias')
    return new Response(JSON.stringify(dias ? { ...get, diasInss: Number(dias), prazo: '2026-11-02', regraPrazo: 'Lei 9.784' } : get), { status: 200 })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

describe('Tratar exigência do INSS (GGVP-39)', () => {
  it('CA7 · mostra o texto e, com os dias, o prazo contado pelo servidor', async () => {
    servidor(base)
    render(<TratarExigencia casoId={CASO} />)
    expect(await screen.findByText('Apresentar CadÚnico.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Prazo que o INSS deu (dias)'), { target: { value: '30a' } })
    expect((await screen.findByText(/Prazo do INSS: 02\/11\/2026/)).textContent).toContain('30 dias')
    expect(screen.getByText(/Feriados não cadastrados/)).toBeTruthy()
  })

  it('CA8 · documentos sem item não envia; perícia pede o tipo', async () => {
    const fetch = servidor(base)
    render(<TratarExigencia casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Documentos'))
    fireEvent.change(screen.getByLabelText('Prazo que o INSS deu (dias)'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar a tarefa' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Informe ao menos um documento pedido')
    fireEvent.click(screen.getByLabelText('Perícia'))
    fireEvent.click(screen.getByRole('button', { name: 'Criar a tarefa' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escolha o tipo: perícia médica ou avaliação social')
    expect(fetch.mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true)
  })

  it('CA1 · documentos com itens e prazo de entrega: envia e avisa que a Documentação recebeu', async () => {
    const fetch = servidor(base)
    render(<TratarExigencia casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Documentos'))
    fireEvent.change(screen.getByLabelText('Prazo que o INSS deu (dias)'), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText('Documentos pedidos (um por linha)'), { target: { value: 'CadÚnico\nRenda' } })
    fireEvent.change(screen.getByLabelText('Prazo de entrega da Documentação'), { target: { value: '2026-10-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar a tarefa' }))
    expect((await screen.findByRole('status')).textContent).toContain('A Documentação recebeu o card')
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1]!.body as string)).toMatchObject({ pede: 'documentos', itens: ['CadÚnico', 'Renda'], prazoEntrega: '20/10/2026' })
  })

  it('CA14 · a Sênior vê dilação ou perda na exigência vencida', async () => {
    servidor({ ...comCard, vencida: true, podeCumprir: false, podeDecidirVencida: true })
    render(<TratarExigencia casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Registrar a perda'))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva o que aconteceu')
  })
})

describe('Cumprir exigência do INSS (GGVP-39, Documentação)', () => {
  it('CA11 e CA13 · itens com status; "Anexar e responder" travado com item pendente', async () => {
    servidor(comCard)
    render(<CumprirExigencia casoId={CASO} />)
    expect((await screen.findByText('CadÚnico')).parentElement!.textContent).toContain('Pendente')
    expect((screen.getByRole('button', { name: 'Anexar e responder' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Cobranças: 1 de 3/)).toBeTruthy()
  })

  it('CA12 · cobrança sem canal não envia', async () => {
    servidor(comCard)
    render(<CumprirExigencia casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar cobrança' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escolha o canal da cobrança')
  })

  it('CA4 · com tudo cumprido, responde com data e comprovante e avisa a volta à vigília', async () => {
    servidor({ ...comCard, itens: [{ ...comCard.itens[0], situacao: 'cumprido', prova: 'cad.pdf' }] }, [201, { ok: true, aberto: 'vigilia' }])
    render(<CumprirExigencia casoId={CASO} />)
    const botao = await screen.findByRole('button', { name: 'Anexar e responder' })
    fireEvent.click(botao)
    expect((await screen.findByRole('alert')).textContent).toBe('Anexe o comprovante da resposta no portal (PDF ou imagem, até 25 MB).')
    fireEvent.change(screen.getByLabelText('Comprovante da resposta'), { target: { files: [new File(['%PDF'], 'r.pdf', { type: 'application/pdf' })] } })
    fireEvent.click(botao)
    expect((await screen.findByRole('status')).textContent).toContain('voltou para a vigília')
  })
})
