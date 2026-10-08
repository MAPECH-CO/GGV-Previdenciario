import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Peticao } from './Peticao.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const LAUDO = '33333333-3333-4333-8333-333333333333'
const base = {
  casoId: CASO,
  cliente: 'Vicente Prado (exemplo)',
  beneficio: 'bpc_loas_idoso',
  faltam: [],
  carta: { id: '22222222-2222-4222-8222-222222222222', nome: 'carta.pdf' },
  documentos: [{ id: LAUDO, nome: 'laudo.pdf' }],
  pedido: null,
  versoes: [],
  atual: null,
  podePedir: true,
  podeEditar: false,
  podeAprovar: false,
  pacote: null,
  travas: [],
  tribunais: [],
  protocolo: null,
  podeProtocolar: false,
}

function servidor(get: object, post: [number, unknown] = [201, { ok: true }]) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify(post[1]), { status: post[0] }) : new Response(JSON.stringify(get), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

describe('Pedir a petição (GGVP-63)', () => {
  it('épico IA · "Escrever a versão 1 com a IA" preenche a caixa, mostra as fontes e o aviso; o pedido leva a chamada', async () => {
    const CHAMADA = '44444444-4444-4444-8444-444444444444'
    const sugestao = { chamadaId: CHAMADA, sugestao: true, texto: 'EXCELENTÍSSIMO SENHOR JUIZ... [completar: valor da causa]', fontes: [{ tipo: 'documento', referencia: `documento:${LAUDO}`, trecho: 'laudo.pdf' }], modelo: 'gpt-4.1-mini', geradaEm: '2026-10-07T20:00:00.000Z', alerta: null }
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return new Response(JSON.stringify(base))
      if (String(url).endsWith('/peticao/minuta')) return new Response(JSON.stringify({ sugestao, motivo: null, aviso: 'Sem referência na casa: o acervo ainda não tem casos para consultar.' }))
      return new Response(JSON.stringify({ ok: true }), { status: 201 })
    })
    vi.stubGlobal('fetch', fetch)
    render(<Peticao casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Escrever a versão 1 com a IA' }))
    expect(await screen.findByText(/Minuta da IA · revise antes de pedir/)).toBeTruthy()
    expect((screen.getByLabelText('Texto da petição (versão 1)') as HTMLTextAreaElement).value).toBe(sugestao.texto)
    expect(screen.getByText(/Fontes usadas: laudo\.pdf/)).toBeTruthy()
    expect(screen.getByText('Sem referência na casa: o acervo ainda não tem casos para consultar.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pedir a petição' }))
    expect((await screen.findByRole('status')).textContent).toBe('Petição pedida. A versão 1 foi para a conferência.')
    const envio = fetch.mock.calls.find(([url]) => String(url).endsWith('/peticao/pedido'))!
    expect(JSON.parse(String(envio[1]!.body))).toMatchObject({ texto: sugestao.texto, chamadaIaId: CHAMADA })
  })

  it('CA1 · com setor pendente, o pedido fica bloqueado e diz quem falta', async () => {
    servidor({ ...base, faltam: ['Documentação'] })
    render(<Peticao casoId={CASO} />)
    expect((await screen.findByText(/Bloqueado até/)).textContent).toBe('Bloqueado até todos os setores subirem o card. Falta: Documentação.')
    expect((screen.getByRole('button', { name: 'Pedir a petição' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('CA6, CA9 · o texto é obrigatório; o pedido leva as instruções, as opções e os citados na ordem, com o que falta', async () => {
    const fetch = servidor(base)
    render(<Peticao casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pedir a petição' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva ou cole o texto da petição (versão 1)')
    fireEvent.change(screen.getByLabelText('Instruções (opcional)'), { target: { value: 'Concessão desde a DER' } })
    fireEvent.click(screen.getByLabelText('Pedir tutela de urgência'))
    fireEvent.click(screen.getByLabelText('laudo.pdf'))
    fireEvent.change(screen.getByLabelText('Falta algum documento? Escreva o nome'), { target: { value: 'CNIS atualizado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Incluir o que falta' }))
    expect([...screen.getByRole('list', { name: 'Ordem no pacote' }).querySelectorAll('li')].map((l) => l.textContent)).toEqual(['laudo.pdf', 'CNIS atualizado · falta'])
    fireEvent.change(screen.getByLabelText('Texto da petição (versão 1)'), { target: { value: 'Excelentíssimo Senhor Juiz...' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pedir a petição' }))
    expect((await screen.findByRole('status')).textContent).toBe('Petição pedida. A versão 1 foi para a conferência.')
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1]!.body as string)).toEqual({
      instrucoes: 'Concessão desde a DER',
      opcoes: { tutelaUrgencia: true, precedentes: false, anexarCitados: true },
      citados: [{ documentoId: LAUDO }, { nome: 'CNIS atualizado' }],
      texto: 'Excelentíssimo Senhor Juiz...',
    })
  })

  it('pedida, mostra quem pediu, as opções, os citados com a carta sempre e a versão atual', async () => {
    servidor({
      ...base,
      podePedir: false,
      pedido: {
        por: 'Gabi',
        em: '2026-10-07T13:00:00.000Z',
        instrucoes: 'Concessão desde a DER',
        opcoes: { tutelaUrgencia: true, precedentes: false, anexarCitados: true },
        citados: [
          { documentoId: LAUDO, nome: 'laudo.pdf', pedidoADocumentacao: false },
          { documentoId: null, nome: 'CNIS atualizado', pedidoADocumentacao: false },
        ],
      },
      versoes: [{ numero: 1, por: 'Gabi', em: '2026-10-07T13:00:00.000Z', oQueMudou: null, hash: 'abc', aprovadaPor: null, aprovadaEm: null }],
      atual: { numero: 1, texto: 'Excelentíssimo Senhor Juiz...', diferenca: null },
    })
    render(<Peticao casoId={CASO} />)
    expect((await screen.findByText(/Pedido por/)).textContent).toBe('Pedido por Gabi em 07/10/2026')
    expect(screen.getByText(/Opções:/).textContent).toBe('Opções: Pedir tutela de urgência, Anexar os documentos citados')
    expect([...screen.getByRole('list', { name: 'Citados' }).querySelectorAll('li')].map((l) => l.textContent)).toEqual([
      'carta.pdf · carta de indeferimento, entra sempre (Tema 350)',
      'laudo.pdf',
      'CNIS atualizado · falta',
    ])
    expect(screen.getByText('Excelentíssimo Senhor Juiz...')).toBeTruthy()
  })
})

describe('Conferir a petição (GGVP-67)', () => {
  const pedida = {
    ...base,
    podePedir: false,
    podeEditar: true,
    podeAprovar: true,
    pedido: { por: 'Gabi', em: '2026-10-07T13:00:00.000Z', instrucoes: '', opcoes: { tutelaUrgencia: false, precedentes: false, anexarCitados: true }, citados: [] },
    versoes: [
      { numero: 1, por: 'Gabi', em: '2026-10-07T13:00:00.000Z', oQueMudou: null, hash: 'aaa', aprovadaPor: null, aprovadaEm: null },
      { numero: 2, por: 'Gabi', em: '2026-10-07T14:00:00.000Z', oQueMudou: 'Incluí a tutela', hash: 'bbb', aprovadaPor: null, aprovadaEm: null },
    ],
    atual: {
      numero: 2,
      texto: 'Dos fatos\nDa tutela de urgência\nDo direito',
      diferenca: [
        { tipo: 'igual', texto: 'Dos fatos' },
        { tipo: 'incluido', texto: 'Da tutela de urgência' },
        { tipo: 'igual', texto: 'Do direito' },
        { tipo: 'removido', texto: 'Do pedido' },
      ],
    },
  }

  it('CA3, CA4 · mostra a versão inteira e destaca o que entrou e o que saiu desde a anterior', async () => {
    servidor(pedida)
    render(<Peticao casoId={CASO} />)
    const mudou = await screen.findByRole('region', { name: 'O que mudou' })
    expect(mudou.querySelector('ins')!.textContent).toBe('Da tutela de urgência')
    expect(mudou.querySelector('del')!.textContent).toBe('Do pedido')
    expect(screen.getByText('Versão 2 · Gabi em 07/10/2026 · Incluí a tutela')).toBeTruthy()
  })

  it('CA2, CA5, CA9 · "Aprovar" só habilita com as três marcações e aprova a última versão', async () => {
    const fetch = servidor(pedida)
    render(<Peticao casoId={CASO} />)
    const aprovar = (await screen.findByRole('button', { name: 'Aprovar e enviar ao protocolo' })) as HTMLButtonElement
    fireEvent.click(screen.getByLabelText('Li a petição na íntegra'))
    fireEvent.click(screen.getByLabelText('Fundamentos, pedidos e valores conferem com o caso'))
    expect(aprovar.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Nada contradiz o requisito do benefício (G18)'))
    expect(aprovar.disabled).toBe(false)
    fireEvent.click(aprovar)
    expect((await screen.findByRole('status')).textContent).toBe('Versão 2 aprovada. O pacote foi para o protocolo.')
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect([String(post[0]), JSON.parse(post[1]!.body as string)]).toEqual([
      `/api/casos/${CASO}/peticao/versoes/2/aprovacao`,
      { liNaIntegra: true, conferem: true, nadaContradiz: true },
    ])
  })

  it('CA1, CA10 · "Editar eu mesma" pede o que mudou e salva a versão seguinte', async () => {
    const fetch = servidor(pedida, [201, { ok: true, numero: 3 }])
    render(<Peticao casoId={CASO} />)
    fireEvent.click(await screen.findByText('Não está boa? Pedir outra versão à IA ou editar eu mesma'))
    fireEvent.change(screen.getByLabelText('Texto da nova versão'), { target: { value: 'Dos fatos\nDo direito\nDo valor da causa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova versão' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva o que mudou nesta versão')
    fireEvent.change(screen.getByLabelText('O que mudou nesta versão'), { target: { value: 'Valor da causa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova versão' }))
    expect((await screen.findByRole('status')).textContent).toBe('Versão 3 salva. Ela precisa de nova conferência.')
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1]!.body as string)).toEqual({ texto: 'Dos fatos\nDo direito\nDo valor da causa', oQueMudou: 'Valor da causa' })
  })

  it('épico IA · "Pedir outra versão à IA" exige o que mudar, preenche a caixa marcada e a versão salva leva a chamada', async () => {
    const CHAMADA = '55555555-5555-4555-8555-555555555555'
    const V3 = 'Dos fatos\nDa tutela de urgência\nDo direito'
    const sugestao = { chamadaId: CHAMADA, sugestao: true, texto: V3, fontes: [], modelo: 'gpt-4.1-mini', geradaEm: '2026-10-07T13:00:00.000Z', alerta: null }
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/versoes/sugestao')) return new Response(JSON.stringify({ sugestao, motivo: null, aviso: null }))
      return init?.method === 'POST' ? new Response(JSON.stringify({ ok: true, numero: 3 }), { status: 201 }) : new Response(JSON.stringify(pedida))
    })
    vi.stubGlobal('fetch', fetch)
    render(<Peticao casoId={CASO} />)
    fireEvent.click(await screen.findByText('Não está boa? Pedir outra versão à IA ou editar eu mesma'))
    fireEvent.click(screen.getByRole('button', { name: 'Pedir outra versão à IA' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva o que mudar')
    fireEvent.change(screen.getByLabelText('O que mudar'), { target: { value: 'Incluir a tutela' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pedir outra versão à IA' }))
    expect(await screen.findByText('Versão da IA · revise antes de salvar; você aprova o conteúdo (G6)')).toBeTruthy()
    expect((screen.getByLabelText('Texto da nova versão') as HTMLTextAreaElement).value).toBe(V3)
    expect((screen.getByLabelText('O que mudou nesta versão') as HTMLInputElement).value).toBe('Incluir a tutela')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova versão' }))
    expect((await screen.findByRole('status')).textContent).toBe('Versão 3 salva. Ela precisa de nova conferência.')
    const post = fetch.mock.calls.find(([url, init]) => init?.method === 'POST' && String(url).endsWith('/peticao/versoes'))!
    expect(JSON.parse(post[1]!.body as string)).toEqual({ texto: V3, oQueMudou: 'Incluir a tutela', chamadaIaId: CHAMADA })
  })
})

describe('Pacote, travas e protocolo (GGVP-71)', () => {
  const PECA = '44444444-4444-4444-8444-444444444444'
  const travaOk = (chave: string, nome: string, evidencia: string) => ({ chave, nome, criterio: `Critério de ${nome}`, ok: true, evidencia })
  const aprovada = {
    ...base,
    podePedir: false,
    podeProtocolar: true,
    documentos: [{ id: LAUDO, nome: 'laudo.pdf' }],
    pedido: {
      por: 'Gabi',
      em: '2026-10-07T13:00:00.000Z',
      instrucoes: '',
      opcoes: { tutelaUrgencia: false, precedentes: false, anexarCitados: true },
      citados: [
        { documentoId: LAUDO, nome: 'laudo.pdf', pedidoADocumentacao: false },
        { documentoId: null, nome: 'CNIS atualizado', pedidoADocumentacao: false },
      ],
    },
    versoes: [{ numero: 1, por: 'Gabi', em: '2026-10-07T13:00:00.000Z', oQueMudou: null, hash: 'abcdef1234567890', aprovadaPor: 'Gabi', aprovadaEm: '2026-10-07T14:00:00.000Z' }],
    atual: { numero: 1, texto: 'Excelentíssimo...', diferenca: null },
    pacote: [
      { documentoId: PECA, nome: 'peticao-inicial-v1.pdf', papel: 'peticao' },
      { documentoId: LAUDO, nome: 'laudo.pdf', papel: 'citado' },
    ],
    travas: [
      travaOk('tema350', 'Tema 350', 'No pacote: carta.pdf'),
      travaOk('cpf', 'CPF conferido', 'Na petição: 613.748.259-64 · no cadastro: 613.748.259-64'),
      { chave: 'pacote', nome: 'Pacote completo', criterio: 'Critério', ok: false, evidencia: 'Falta: CNIS atualizado' },
    ],
    tribunais: [{ nome: 'Justiça Federal', site: 'https://exemplo.jus.br', tamanhoMaximoMb: 10 }],
  }
  const completo = { ...aprovada, travas: [...aprovada.travas.slice(0, 2), travaOk('pacote', 'Pacote completo', '3 arquivos em PDF')], pedido: { ...aprovada.pedido, citados: aprovada.pedido.citados.slice(0, 1) } }

  it('CA2, CA3, CA6, CA11 · o pacote para baixar, as travas com a evidência; com uma falhando, o protocolo fica bloqueado e diz qual', async () => {
    servidor(aprovada)
    render(<Peticao casoId={CASO} />)
    expect((await screen.findByRole('link', { name: 'peticao-inicial-v1.pdf' })).getAttribute('href')).toBe(`/api/casos/${CASO}/documentos/${PECA}`)
    expect(screen.getByText('Evidência: Falta: CNIS atualizado')).toBeTruthy()
    expect(screen.getByText('Trava falhando: Pacote completo. O protocolo fica bloqueado.')).toBeTruthy()
    const tribunal = screen.getByRole('link', { name: 'Abrir o site do tribunal' })
    expect([tribunal.getAttribute('href'), tribunal.getAttribute('target')]).toEqual(['https://exemplo.jus.br', '_blank'])
    expect((screen.getByRole('button', { name: 'Protocolar no tribunal' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('CA13 · o documento que falta: subir, ou pedir à Documentação', async () => {
    const fetch = servidor(aprovada)
    render(<Peticao casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pedir à Documentação' }))
    expect((await screen.findByRole('status')).textContent).toBe('CNIS atualizado: pedido à Documentação, que recebeu "Cumprir pendência".')
    fireEvent.change(screen.getByLabelText('Subir o documento'), { target: { files: [new File(['%PDF'], 'cnis.pdf', { type: 'application/pdf' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Usar no pacote' }))
    expect((await screen.findByText('CNIS atualizado: no pacote. O pacote foi gerado de novo.')).getAttribute('role')).toBe('status')
    const urls = fetch.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url]) => String(url))
    expect(urls).toEqual([`/api/casos/${CASO}/peticao/citados/1/pedido`, `/api/casos/${CASO}/peticao/citados/1/documento`])
  })

  it('CA5, CA6 · "Protocolar no tribunal" só habilita com as travas conferidas, o número do processo, a data e o comprovante', async () => {
    const fetch = servidor(completo)
    render(<Peticao casoId={CASO} />)
    const botao = (await screen.findByRole('button', { name: 'Protocolar no tribunal' })) as HTMLButtonElement
    fireEvent.change(screen.getByLabelText('Número do processo (CNJ)'), { target: { value: '00012349620264036301' } })
    fireEvent.change(screen.getByLabelText('Comprovante do protocolo'), { target: { files: [new File(['%PDF'], 'comprovante.pdf', { type: 'application/pdf' })] } })
    expect(botao.disabled).toBe(true)
    for (const t of ['Tema 350', 'CPF conferido', 'Pacote completo']) fireEvent.click(screen.getByLabelText(`Conferi ${t} pela evidência`))
    expect([botao.disabled, (screen.getByLabelText('Número do processo (CNJ)') as HTMLInputElement).value]).toEqual([false, '0001234-96.2026.4.03.6301'])
    fireEvent.click(botao)
    expect((await screen.findByRole('status')).textContent).toBe('Petição protocolada. O processo entrou na vigília.')
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    const corpo = post[1]!.body as FormData
    expect([String(post[0]), corpo.get('tribunal'), corpo.get('conferiPacote'), (corpo.get('arquivo') as File).name]).toEqual([
      `/api/casos/${CASO}/peticao/protocolo`,
      'Justiça Federal',
      'true',
      'comprovante.pdf',
    ])
  })

  it('CA4, CA10 · protocolada, mostra quando, onde, o processo, a versão e quem protocolou', async () => {
    servidor({ ...completo, podeProtocolar: false, protocolo: { em: '2026-10-06T15:00:00.000Z', numero: '00012349620264036301', tribunal: 'Justiça Federal', por: 'Gabi', versao: 1 } })
    render(<Peticao casoId={CASO} />)
    expect((await screen.findByText(/no tribunal/)).textContent).toBe('Em 06/10/2026 no tribunal Justiça Federal · processo 0001234-96.2026.4.03.6301 · versão 1 · por Gabi')
    expect(screen.queryByRole('button', { name: 'Protocolar no tribunal' })).toBeNull()
  })
})

