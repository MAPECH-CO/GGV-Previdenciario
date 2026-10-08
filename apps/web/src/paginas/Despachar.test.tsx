import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DespacharCaso } from './Despachar.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const CARTA = '22222222-2222-4222-8222-222222222222'
const base = {
  casoId: CASO,
  cliente: 'Sebastião Cruz (exemplo)',
  beneficio: 'bpc_loas_idoso',
  indeferimento: {
    dataDecisao: '2026-10-06',
    motivoInss: 'Renda per capita acima do limite',
    carta: { id: CARTA, nome: 'carta-inss.pdf' },
    motivoEscrito: { texto: 'O INSS somou a renda do filho', por: 'Gabi', em: '2026-10-07T13:00:00.000Z' },
  },
  despacho: null,
  setores: [],
  pericias: [],
  faltam: [],
  podeDespachar: true,
  podeEncerrar: true,
}

function servidor(get: object, post: [number, unknown] = [201, { ok: true }]) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify(post[1]), { status: post[0] }) : new Response(JSON.stringify(get), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const corpoDoPost = (fetch: ReturnType<typeof servidor>, caminho: string) =>
  JSON.parse(fetch.mock.calls.find(([url, init]) => init?.method === 'POST' && String(url).endsWith(caminho))![1]!.body as string)
afterEach(() => vi.unstubAllGlobals())

describe('Despachar caso (GGVP-54)', () => {
  it('CA1 · mostra o histórico: a decisão do INSS, a carta e o motivo escrito, com quem e quando', async () => {
    servidor(base)
    render(<DespacharCaso casoId={CASO} />)
    expect((await screen.findByText(/Motivo no sistema do INSS/)).textContent).toBe('Motivo no sistema do INSS: Renda per capita acima do limite')
    expect(screen.getByRole('link', { name: 'Abrir a carta de indeferimento (carta-inss.pdf)' }).getAttribute('href')).toBe(`/api/casos/${CASO}/documentos/${CARTA}`)
    expect(screen.getByText(/Motivo com as palavras de quem viu/).textContent).toBe('Motivo com as palavras de quem viu: O INSS somou a renda do filho (Gabi em 07/10/2026)')
  })

  it('CA3 · "nada falta" segue para pedir a petição', async () => {
    const fetch = servidor(base)
    render(<DespacharCaso casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Não, nada falta'))
    fireEvent.click(screen.getByRole('button', { name: 'Despachar' }))
    expect((await screen.findByRole('status')).textContent).toBe('Despacho registrado. "Pedir a petição" foi para a fila das advogadas.')
    expect(corpoDoPost(fetch, '/despacho')).toEqual({ decisao: 'nada_falta' })
  })

  it('CA2, CA6 · marca cada setor uma vez, com o que obter; "Essa tarefa tem prazo?" Sim pede a data de entrega (ajuste de 06/10)', async () => {
    const fetch = servidor(base)
    render(<DespacharCaso casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Sim, falta'))
    fireEvent.click(screen.getByRole('button', { name: 'Despachar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Marque ao menos um setor ou a perícia')
    fireEvent.click(screen.getByLabelText('Documentação'))
    const doc = within(screen.getByRole('region', { name: 'Pedido para Documentação' }))
    fireEvent.change(doc.getByLabelText('O que a Documentação deve obter'), { target: { value: 'Laudo atualizado' } })
    fireEvent.click(doc.getByLabelText('Sim'))
    fireEvent.click(screen.getByRole('button', { name: 'Despachar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Informe a data de entrega (dd/mm/aaaa)')
    fireEvent.change(doc.getByLabelText('Data de entrega'), { target: { value: '2026-10-20' } })
    fireEvent.click(screen.getByLabelText('Atendimento'))
    const atd = within(screen.getByRole('region', { name: 'Pedido para Atendimento' }))
    fireEvent.change(atd.getByLabelText('O que o Atendimento deve obter'), { target: { value: 'Quem mora com a cliente' } })
    fireEvent.click(atd.getByLabelText('Não'))
    fireEvent.click(screen.getByLabelText('Perícia médica'))
    fireEvent.click(screen.getByRole('button', { name: 'Despachar' }))
    expect((await screen.findByRole('status')).textContent).toBe('Despacho registrado. Cada setor recebeu "Cumprir pendência".')
    expect(corpoDoPost(fetch, '/despacho')).toEqual({
      decisao: 'acionar',
      itens: [
        { setor: 'atendimento', descricao: 'Quem mora com a cliente', temPrazo: false },
        { setor: 'documentacao', descricao: 'Laudo atualizado', temPrazo: true, prazo: '20/10/2026' },
      ],
      tiposPericia: ['medica'],
    })
  })

  it('desmarcar o setor tira o pedido dele', async () => {
    servidor(base)
    render(<DespacharCaso casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Sim, falta'))
    fireEvent.click(screen.getByLabelText('Atendimento'))
    expect(screen.getByRole('region', { name: 'Pedido para Atendimento' })).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Atendimento'))
    expect(screen.queryByRole('region', { name: 'Pedido para Atendimento' })).toBeNull()
  })

  it('CA9 e GGVP-58 CA11 · despachado, mostra quem despachou, quando, e o status de cada setor', async () => {
    servidor({
      ...base,
      podeDespachar: false,
      podeEncerrar: false,
      despacho: { decisao: 'acionar', por: 'Helena', em: '2026-10-07T14:00:00.000Z' },
      setores: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          setor: 'atendimento',
          descricao: 'Quem mora com a cliente',
          prazo: null,
          situacao: 'cumprido',
          escalada: false,
          acionadoEm: '2026-10-07T14:00:00.000Z',
          historicoDoLaco: [],
          podeDecidir: false,
        },
        {
          id: '55555555-5555-4555-8555-555555555555',
          setor: 'documentacao',
          descricao: 'Laudo atualizado',
          prazo: '2026-10-20',
          situacao: 'pendente',
          escalada: true,
          acionadoEm: '2026-10-07T14:00:00.000Z',
          historicoDoLaco: [{ quando: '2026-10-08T13:00:00.000Z', canal: 'whatsapp', resultado: 'Cliente não respondeu', quem: 'Dora' }],
          podeDecidir: false,
        },
      ],
      pericias: [{ tipo: 'medica', resultado: null }],
      faltam: ['Documentação', 'Perícia'],
    })
    render(<DespacharCaso casoId={CASO} />)
    expect((await screen.findByText(/Despachado por/)).textContent).toBe('Despachado por Helena em 07/10/2026: setores acionados')
    expect(screen.getByText('Falta: Documentação, Perícia.')).toBeTruthy()
    const linhas = screen.getByRole('list', { name: 'Setores acionados' }).querySelectorAll('li')
    expect([...linhas].map((l) => l.textContent)).toEqual([
      'Atendimento · Quem mora com a cliente · sem prazo · concluído · acionado em 07/10/2026',
      'Documentação · Laudo atualizado · até 20/10/2026 · aberto · acionado em 07/10/2026 · última: 08/10/2026, WhatsApp, Cliente não respondeu · com a Sênior',
      'Jurídico administrativo · marcar a perícia médica · aguardando o resultado',
    ])
    expect(screen.queryByRole('button', { name: 'Despachar' })).toBeNull()
  })

  it('a advogada vê só a leitura enquanto a Sênior não despacha', async () => {
    servidor({ ...base, podeDespachar: false, podeEncerrar: false })
    render(<DespacharCaso casoId={CASO} />)
    expect(await screen.findByText('Esperando o despacho da Sênior.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Encerrar o caso' })).toBeNull()
  })
})

describe('Despachar caso · análise da IA (épico IA, GGVP-54 CA1, CA4)', () => {
  const CHAMADA = '33333333-3333-4333-8333-333333333333'
  const analise = {
    sugestao: {
      chamadaId: CHAMADA,
      sugestao: true,
      texto: 'O INSS somou a renda do filho que mora à parte.',
      fontes: [{ tipo: 'acervo', referencia: 'caso:x', trecho: 'Petição aprovada: a renda do filho que mora à parte não entra.' }],
      modelo: 'gpt-4.1-mini',
      geradaEm: '2026-10-07T13:00:00.000Z',
      alerta: null,
    },
    leitura: { analise: 'O INSS somou a renda do filho que mora à parte.', nadaFalta: false, itens: [{ setor: 'documentacao', descricao: 'Comprovante de residência do filho' }], pericias: ['social'] },
    motivo: null,
    aviso: null,
  }

  it('"Analisar com a IA" mostra a análise, o que sugere e as fontes; "Usar a sugestão" só preenche; o despacho leva a chamada', async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/despacho/analise')) return new Response(JSON.stringify(analise))
      return init?.method === 'POST' ? new Response(JSON.stringify({ ok: true }), { status: 201 }) : new Response(JSON.stringify(base))
    })
    vi.stubGlobal('fetch', fetch)
    render(<DespacharCaso casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Analisar com a IA' }))
    expect(await screen.findByText('Sugestão da IA · quem despacha é você (G4)')).toBeTruthy()
    expect(screen.getByText('Sugere: Documentação: Comprovante de residência do filho · Avaliação social')).toBeTruthy()
    expect(screen.getByText(/Petição aprovada: a renda do filho/)).toBeTruthy()
    const posts = () => fetch.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url]) => String(url).replace(/.*\/casos\/[^/]+/, ''))
    expect(posts()).toEqual(['/despacho/analise'])

    fireEvent.click(screen.getByRole('button', { name: 'Usar a sugestão' }))
    expect((screen.getByLabelText('O que a Documentação deve obter') as HTMLInputElement).value).toBe('Comprovante de residência do filho')
    expect((screen.getByLabelText('Avaliação social') as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Despachar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Responda "Essa tarefa tem prazo?"')

    fireEvent.click(within(screen.getByRole('region', { name: 'Pedido para Documentação' })).getByLabelText('Não'))
    fireEvent.click(screen.getByRole('button', { name: 'Despachar' }))
    await screen.findByText('Despacho registrado. Cada setor recebeu "Cumprir pendência".')
    const corpo = JSON.parse(fetch.mock.calls.find(([url, init]) => init?.method === 'POST' && String(url).endsWith('/despacho'))![1]!.body as string)
    expect([corpo.decisao, corpo.chamadaIaId, corpo.tiposPericia]).toEqual(['acionar', CHAMADA, ['social']])
  })

  it('sem a IA, mostra o motivo e a Sênior despacha pela leitura', async () => {
    servidor(base, [200, { sugestao: null, leitura: null, motivo: 'A IA não respondeu agora: despache pela sua leitura.', aviso: null }])
    render(<DespacharCaso casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Analisar com a IA' }))
    expect(await screen.findByText('A IA não respondeu agora: despache pela sua leitura.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Usar a sugestão' })).toBeNull()
  })
})
