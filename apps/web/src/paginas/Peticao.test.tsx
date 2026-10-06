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
      atual: { numero: 1, texto: 'Excelentíssimo Senhor Juiz...' },
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
