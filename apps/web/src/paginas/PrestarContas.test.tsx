import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONFERENCIAS_DO_OK, type PrestacaoDoCaso } from '@ggv/contratos'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { PrestarContas } from './PrestarContas.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const AVISO = 'Olá, {cliente}! A ida ao banco está marcada para {data}.'
const PRESTACAO: PrestacaoDoCaso = {
  casoId: CASO,
  cliente: 'Pessoa Inventada (exemplo)',
  beneficio: 'bpc_loas_idoso',
  carta: { id: CASO, nome: 'carta-de-concessao.pdf' },
  percentualContrato: '30.00',
  acordo: null,
  versoes: [],
  agendamento: null,
  aviso: AVISO,
  podeEditar: true,
  podeReceber: false,
}

afterEach(() => {
  vi.unstubAllGlobals()
  entrarComo(undefined)
})

describe('Prestar contas (GGVP-92 CA5, GGVP-158 L2)', () => {
  it('a Sênior lê o texto do aviso, e o OK só habilita com as quatro conferências, que vão ao servidor', async () => {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? new Response(JSON.stringify({ ok: true, versao: 1 }), { status: 201 }) : new Response(JSON.stringify(PRESTACAO)),
    )
    vi.stubGlobal('fetch', fetch)
    entrarComo('senior')
    render(comSessao(<PrestarContas casoId={CASO} />))
    expect(await screen.findByText(AVISO)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Valor recebido (atrasados)'), { target: { value: '1000,00' } })
    fireEvent.change(screen.getByLabelText('Prazo de pagamento'), { target: { value: '2030-10-30' } })
    const botao = screen.getByRole('button', { name: 'Concluir a prestação' }) as HTMLButtonElement
    for (const rotulo of Object.values(CONFERENCIAS_DO_OK)) {
      expect([rotulo, botao.disabled]).toEqual([rotulo, true])
      fireEvent.click(screen.getByLabelText(rotulo))
    }
    expect(botao.disabled).toBe(false)
    fireEvent.click(botao)
    await screen.findByRole('status')
    const [, envio] = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(String(envio!.body))).toMatchObject({ conferiCarta: true, conferiHonorarios: true, conferiDadosBancarios: true, revisouAviso: true })
  })
})
