import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnalisarExigenciaJuiz } from './AnalisarExigenciaJuiz.tsx'
import { CumprirExigenciaJuiz } from './CumprirExigenciaJuiz.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const exigenciaDoJuiz = {
  casoId: CASO,
  cliente: 'Otávio Lima (exemplo)',
  publicacaoId: '11111111-1111-4111-8111-111111111111',
  texto: 'Intime-se a parte autora para juntar laudo.',
  disponibilizadaEm: '2026-10-05',
  prazo: { inicio: '2026-10-07', fim: '2026-10-27', regra: 'Lei 11.419', versao: 1 },
  situacao: 'a_analisar',
  itens: [],
  pericias: [],
  faltam: [],
  podeDistribuir: true,
  vencida: false,
  podeDecidirVencida: false,
}

function servidor(get: object, post: [number, unknown] = [201, { ok: true }]) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify(post[1]), { status: post[0] }) : new Response(JSON.stringify(get), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

describe('Analisar a exigência do juiz (GGVP-79)', () => {
  it('CA5 · mostra o texto e o prazo com a regra', async () => {
    servidor(exigenciaDoJuiz)
    render(<AnalisarExigenciaJuiz casoId={CASO} />)
    expect(await screen.findByText('Intime-se a parte autora para juntar laudo.')).toBeTruthy()
    expect(screen.getByText(/Prazo do processo: 07\/10\/2026 a 27\/10\/2026/)).toBeTruthy()
  })

  it('CA1, CA7 · precisa cumprir abre um item; sem setor, não envia; o prazo interno tem o processual como máximo', async () => {
    const fetch = servidor(exigenciaDoJuiz)
    render(<AnalisarExigenciaJuiz casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Precisa cumprir'))
    expect((screen.getByLabelText('Prazo interno') as HTMLInputElement).max).toBe('2026-10-27')
    fireEvent.change(screen.getByLabelText('O que cumprir'), { target: { value: 'Trazer laudo' } })
    fireEvent.change(screen.getByLabelText('Prazo interno'), { target: { value: '2026-10-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escolha o setor de cada item')
    expect(fetch.mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true)
  })

  it('CA13 · inclui e remove itens; com setor, envia', async () => {
    const fetch = servidor(exigenciaDoJuiz)
    render(<AnalisarExigenciaJuiz casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Precisa cumprir'))
    fireEvent.click(screen.getByRole('button', { name: 'Incluir item' }))
    expect(screen.getAllByLabelText('Setor')).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover item' })[1])
    fireEvent.change(screen.getByLabelText('Setor'), { target: { value: 'documentacao' } })
    fireEvent.change(screen.getByLabelText('O que cumprir'), { target: { value: 'Trazer laudo' } })
    fireEvent.change(screen.getByLabelText('Prazo interno'), { target: { value: '2026-10-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect((await screen.findByRole('status')).textContent).toContain('Cumprir exigência do juiz')
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1]!.body as string)).toMatchObject({ decisao: 'cumprir', itens: [{ setor: 'documentacao', prazoInterno: '20/10/2026' }] })
  })

  it('GGVP-83 CA3, CA10 · em cumprimento, mostra o status de cada setor e quem falta; sem formulário', async () => {
    servidor({
      ...exigenciaDoJuiz,
      situacao: 'em_cumprimento',
      podeDistribuir: false,
      faltam: ['Atendimento'],
      itens: [
        { id: '22222222-2222-4222-8222-222222222222', setor: 'documentacao', descricao: 'Laudo', provaEsperada: null, prazoInterno: '2026-10-20', situacao: 'cumprido', prova: 'laudo.pdf', tentativas: 1, limite: 3, escalada: false },
        { id: '33333333-3333-4333-8333-333333333333', setor: 'atendimento', descricao: 'CTPS', provaEsperada: null, prazoInterno: '2026-10-20', situacao: 'pendente', prova: null, tentativas: 3, limite: 3, escalada: true },
      ],
    })
    render(<AnalisarExigenciaJuiz casoId={CASO} />)
    expect((await screen.findByText(/Falta: Atendimento/)).textContent).toBe('Falta: Atendimento.')
    expect(screen.getByText(/Atendimento · CTPS/).textContent).toContain('com a Sênior')
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull()
  })
})

describe('Perícia pedida pelo juiz (GGVP-79 CA8)', () => {
  it('aparece entre os setores acionados, com quem marca: o Jurídico administrativo', async () => {
    servidor({ ...exigenciaDoJuiz, situacao: 'em_cumprimento', podeDistribuir: false, faltam: ['Perícia'], pericias: [{ tipo: 'medica', resultado: null }] })
    render(<AnalisarExigenciaJuiz casoId={CASO} />)
    expect((await screen.findByText(/Jurídico administrativo · marcar/)).textContent).toBe('Jurídico administrativo · marcar a perícia médica · aguardando o resultado')
  })

  it('no formulário, avisa que a marcação vai para o Jurídico administrativo', async () => {
    servidor(exigenciaDoJuiz)
    render(<AnalisarExigenciaJuiz casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Precisa cumprir'))
    expect(screen.getByText(/Quem marca é o Jurídico administrativo/)).toBeTruthy()
  })
})

describe('Cumprir a exigência do juiz (GGVP-83)', () => {
  const ITEM_ID = '22222222-2222-4222-8222-222222222222'
  const setor = {
    origem: 'juizo',
    casoId: CASO,
    cliente: 'Otávio Lima (exemplo)',
    setor: 'documentacao',
    pedidoPor: 'Gabi (exemplo)',
    prazoProcessual: '2026-10-27',
    itens: [
      { id: ITEM_ID, descricao: 'Trazer laudo', provaEsperada: 'Laudo com data', prazoInterno: '2026-10-20', situacao: 'pendente', motivo: null, prova: null, informacao: null, proximoLembrete: '2026-10-07', limite: 3, escalada: false, tentativas: [] },
    ],
  }

  it('CA4, CA13 · mostra o pedido, quem pediu, o prazo interno e o processual, e a contagem de tentativas', async () => {
    servidor(setor)
    render(<CumprirExigenciaJuiz casoId={CASO} />)
    expect((await screen.findByText(/Entregar até/)).textContent).toContain('prazo do processo: 27/10/2026')
    expect(screen.getByText(/pedido por Gabi/)).toBeTruthy()
    expect(screen.getByText(/Registrar cobrança ao cliente \(0 de 3/)).toBeTruthy()
    expect(screen.getByText('Documento que comprova: Laudo com data')).toBeTruthy()
  })

  it('CA5 · cobrança sem canal não envia; CA6 · enviar sem o documento não envia', async () => {
    const fetch = servidor(setor)
    render(<CumprirExigenciaJuiz casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar cobrança' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escolha o canal da tentativa')
    fireEvent.click(screen.getByRole('button', { name: 'Enviar documento e concluir' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Anexe o documento do item (PDF ou imagem, até 25 MB).')
    expect(fetch.mock.calls.every(([, init]) => init?.method !== 'POST')).toBe(true)
  })

  it('CA6 · com o documento, conclui o item', async () => {
    servidor(setor)
    render(<CumprirExigenciaJuiz casoId={CASO} />)
    fireEvent.change(await screen.findByLabelText('Documento'), { target: { files: [new File(['%PDF'], 'laudo.pdf', { type: 'application/pdf' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar documento e concluir' }))
    expect((await screen.findByRole('status')).textContent).toBe('Documento enviado. O item está cumprido.')
  })
})
