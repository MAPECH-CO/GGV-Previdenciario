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
          { documentoId: LAUDO, nome: 'laudo.pdf' },
          { documentoId: null, nome: 'CNIS atualizado' },
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
    fireEvent.click(await screen.findByText('Não está boa? Editar eu mesma'))
    fireEvent.change(screen.getByLabelText('Texto da nova versão'), { target: { value: 'Dos fatos\nDo direito\nDo valor da causa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova versão' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva o que mudou nesta versão')
    fireEvent.change(screen.getByLabelText('O que mudou nesta versão'), { target: { value: 'Valor da causa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova versão' }))
    expect((await screen.findByRole('status')).textContent).toBe('Versão 3 salva. Ela precisa de nova conferência.')
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1]!.body as string)).toEqual({ texto: 'Dos fatos\nDo direito\nDo valor da causa', oQueMudou: 'Valor da causa' })
  })
})

