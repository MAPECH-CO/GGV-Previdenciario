import { fireEvent, render, screen, within } from '@testing-library/react'
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

const LACO = [{ quando: '2026-10-06T13:00:00.000Z', canal: 'telefone', resultado: 'Não atendeu', quem: 'Ana' }]
const emCumprimento = {
  situacao: 'em_cumprimento',
  podeDistribuir: false,
  faltam: ['Atendimento'],
  peca: null,
  itens: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      setor: 'documentacao',
      descricao: 'Laudo',
      provaEsperada: null,
      prazoInterno: '2026-10-20',
      situacao: 'cumprido',
      motivo: null,
      prova: 'laudo.pdf',
      tentativas: 1,
      limite: 3,
      escalada: false,
      acionadoEm: '2026-10-05T15:00:00.000Z',
      historicoDoLaco: [],
      podeDecidir: false,
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      setor: 'atendimento',
      descricao: 'CTPS',
      provaEsperada: null,
      prazoInterno: '2026-10-20',
      situacao: 'pendente',
      motivo: null,
      prova: null,
      tentativas: 3,
      limite: 3,
      escalada: true,
      acionadoEm: '2026-10-05T15:00:00.000Z',
      historicoDoLaco: LACO,
      podeDecidir: false,
    },
  ],
}

const SEM_SUGESTAO = { sugestao: null, leitura: null, motivo: 'A IA não respondeu agora: analise pela sua leitura.', aviso: null }

/** A sugestão da IA chega sozinha ao abrir (sugestão pronta, 07/10): o POST dela responde à parte. */
function servidor(get: object, post: [number, unknown] = [201, { ok: true }], sugestao: object = SEM_SUGESTAO) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) =>
    String(url).endsWith('/exigencia-juiz/sugestao')
      ? new Response(JSON.stringify(sugestao))
      : init?.method === 'POST'
        ? new Response(JSON.stringify(post[1]), { status: post[0] })
        : new Response(JSON.stringify(get), { status: 200 }),
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
    expect(fetch.mock.calls.filter(([url, init]) => init?.method === 'POST' && String(url).endsWith('/exigencia-juiz'))).toEqual([])
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
    const post = fetch.mock.calls.find(([url, init]) => init?.method === 'POST' && String(url).endsWith('/exigencia-juiz'))!
    expect(JSON.parse(post[1]!.body as string)).toMatchObject({ decisao: 'cumprir', itens: [{ setor: 'documentacao', prazoInterno: '20/10/2026' }] })
  })

  it('GGVP-83 CA3, CA10 e GGVP-68 CA14 · em cumprimento, mostra o status de cada setor, o acionamento, a última tentativa e quem falta', async () => {
    servidor({ ...exigenciaDoJuiz, ...emCumprimento })
    render(<AnalisarExigenciaJuiz casoId={CASO} />)
    expect((await screen.findByText(/Falta: Atendimento/)).textContent).toBe('Falta: Atendimento.')
    expect(screen.getByText(/Atendimento · CTPS/).textContent).toBe(
      'Atendimento · CTPS · até 20/10/2026 · Pendente · acionado em 05/10/2026 · última: 06/10/2026, Telefone, Não atendeu · tentativas 3 de 3 · com a Sênior',
    )
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Devolver ao setor' })).toBeNull()
  })

  it('GGVP-94 CA8, CA9, CA10 · a Sênior vê o laço do item que subiu e o devolve ao setor com o que fazer', async () => {
    const fetch = servidor(
      { ...exigenciaDoJuiz, ...emCumprimento, itens: emCumprimento.itens.map((i) => (i.escalada ? { ...i, podeDecidir: true } : i)) },
      [201, { ok: true, proximoLembrete: '2026-10-09' }],
    )
    render(<AnalisarExigenciaJuiz casoId={CASO} />)
    const laco = await screen.findByLabelText('Laço de Atendimento')
    expect(within(laco).getAllByRole('listitem').map((l) => l.textContent)).toEqual(['06/10/2026 · Telefone · Não atendeu · Ana'])
    const devolver = within(laco).getByRole('button', { name: 'Devolver ao setor' }) as HTMLButtonElement
    expect(devolver.disabled).toBe(true)
    fireEvent.change(within(laco).getByLabelText('O que o setor deve fazer'), { target: { value: 'Pedir a CTPS digital pelo app' } })
    fireEvent.click(devolver)
    expect((await screen.findByRole('status')).textContent).toBe('Decisão registrada. A tarefa voltou ao setor, com o próximo lembrete em 09/10/2026.')
    const [url, init] = fetch.mock.calls.find(([, i]) => i?.method === 'POST')!
    expect([String(url), JSON.parse(init!.body as string)]).toEqual([
      `/api/casos/${CASO}/exigencia-juiz/itens/33333333-3333-4333-8333-333333333333/decisao`,
      { oQueFazer: 'Pedir a CTPS digital pelo app' },
    ])
  })

  it('GGVP-68 CA5 · protocolada a manifestação, o item cumprido mostra a peça que o cumpriu', async () => {
    servidor({ ...exigenciaDoJuiz, ...emCumprimento, situacao: 'cumprida', faltam: [], peca: { versao: 2, protocoladaEm: '2026-10-08T14:00:00.000Z' } })
    render(<AnalisarExigenciaJuiz casoId={CASO} />)
    expect((await screen.findByText(/Documentação · Laudo/)).textContent).toContain('· na manifestação (versão 2) protocolada em 08/10/2026')
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

  it('GGVP-94 CA6, CA11 · o próximo lembrete com o que ele diz', async () => {
    const lembrete = { gatilho: 'Sem retorno desde o acionamento', destinatario: 'Documentação', canal: 'Central de tarefas', modelo: 'Cumprir exigência do juiz' }
    servidor({ ...setor, itens: setor.itens.map((i) => ({ ...i, lembrete })) })
    render(<CumprirExigenciaJuiz casoId={CASO} />)
    expect((await screen.findByText(/Próximo lembrete em/)).textContent).toBe(
      'Próximo lembrete em 07/10/2026 · para Documentação · pela Central de tarefas · “Cumprir exigência do juiz” · sem retorno desde o acionamento',
    )
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

describe('Exigência do juiz · sugestão da IA (épico IA, GGVP-79 CA3)', () => {
  const CHAMADA = '66666666-6666-4666-8666-666666666666'
  const resposta = {
    sugestao: { chamadaId: CHAMADA, sugestao: true, texto: 'O juiz mandou juntar laudo em 15 dias úteis.', fontes: [{ tipo: 'publicacao', referencia: 'publicacao:x' }], modelo: 'gpt-4.1-mini', geradaEm: '2026-10-07T13:00:00.000Z', alerta: null },
    leitura: { resumo: 'O juiz mandou juntar laudo em 15 dias úteis.', ciencia: false, itens: [{ setor: 'atendimento', descricao: 'Pedir o laudo ao cliente', provaEsperada: 'Laudo recente', tipoDocumento: 'laudo' }], pericias: [] },
    motivo: null,
    aviso: 'Sem referência na casa: nada parecido no acervo; a IA usou só o caso.',
  }

  it('ao abrir, a sugestão aparece pronta e preenche o formulário sem o prazo interno; a decisão leva a chamada', async () => {
    const fetch = servidor(exigenciaDoJuiz, undefined, resposta)
    render(<AnalisarExigenciaJuiz casoId={CASO} />)
    expect(await screen.findByText('Sugestão da IA · quem decide é você (G5)')).toBeTruthy()
    expect(screen.getByText('Sugere: Atendimento: Pedir o laudo ao cliente (prova: Laudo recente)')).toBeTruthy()
    expect(screen.getByText(resposta.aviso)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Sugerir com a IA|Usar a sugestão/ })).toBeNull()
    expect((screen.getByLabelText('Precisa cumprir') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('O que cumprir') as HTMLInputElement).value).toBe('Pedir o laudo ao cliente')
    expect((screen.getByLabelText('Setor') as HTMLSelectElement).value).toBe('atendimento')
    expect((screen.getByLabelText('Prazo interno') as HTMLInputElement).value).toBe('')
    // Bloco 5d (GGVP-125): o tipo do documento que a IA sugeriu já vem escolhido.
    expect((screen.getByLabelText(/^Tipo do documento/) as HTMLSelectElement).value).toBe('laudo')
    fireEvent.change(screen.getByLabelText('Prazo interno'), { target: { value: '2026-10-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    await screen.findByText('Tarefas criadas. Cada setor recebeu "Cumprir exigência do juiz".')
    const post = fetch.mock.calls.find(([url, init]) => init?.method === 'POST' && String(url).endsWith('/exigencia-juiz'))!
    const corpo = JSON.parse(post[1]!.body as string)
    expect([corpo.decisao, corpo.chamadaIaId, corpo.itens[0].prazoInterno, corpo.itens[0].tipoDocumento]).toEqual(['cumprir', CHAMADA, '20/10/2026', 'laudo'])
  })

  it('GGVP-125, bloco 5d · o tipo que a IA sugere fora do catálogo das telas não entra', async () => {
    const fora = { ...resposta, leitura: { ...resposta.leitura, itens: [{ ...resposta.leitura.itens[0], tipoDocumento: 'inventado' }] } }
    servidor(exigenciaDoJuiz, undefined, fora)
    render(<AnalisarExigenciaJuiz casoId={CASO} />)
    expect((await screen.findByLabelText(/^Tipo do documento/) as HTMLSelectElement).value).toBe('')
  })
})
