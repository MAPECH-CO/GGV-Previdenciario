import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IdaAoBanco } from './IdaAoBanco.tsx'
import { PrestarContas } from './PrestarContas.tsx'
import { ReceberPrestacao } from './ReceberPrestacao.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const prestacao = {
  casoId: CASO,
  cliente: 'Vera Lúcia (exemplo)',
  beneficio: 'bpc_loas_idoso',
  carta: { id: '11111111-1111-4111-8111-111111111111', nome: 'Carta de concessão.pdf' },
  percentualContrato: '30.00',
  versoes: [],
  agendamento: null,
  podeEditar: true,
  podeReceber: false,
}
const versao1 = {
  versao: 1,
  valorRecebido: '12345.67',
  percentual: '30.00',
  honorarios: '3703.70',
  repasse: '8641.97',
  formaPagamento: 'Pix',
  prazoPagamento: '2026-10-30',
  por: 'Gabi',
  em: '2026-10-05T15:00:00.000Z',
  recebidaPor: null,
  recebidaEm: null,
  divergencia: null,
}
const banco = {
  casoId: CASO,
  cliente: 'Vera Lúcia (exemplo)',
  agendamento: null,
  mensagem: null,
  modeloCadastrado: true,
  okAdvogada: true,
  avisos: [],
  podeAgendar: true,
}

function servidor(get: object, post: [number, unknown] = [201, { ok: true, versao: 1 }]) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify(post[1]), { status: post[0] }) : new Response(JSON.stringify(get), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

describe('Prestar contas (GGVP-44)', () => {
  it('CA4, CA5 · mostra a carta, traz o percentual do contrato e a prévia calculada pelo sistema', async () => {
    servidor(prestacao)
    render(<PrestarContas casoId={CASO} />)
    expect(await screen.findByText('Carta de concessão.pdf')).toBeTruthy()
    expect((screen.getByLabelText('Honorários do contrato (%)') as HTMLInputElement).value).toBe('30,00')
    fireEvent.change(screen.getByLabelText('Valor recebido (atrasados)'), { target: { value: '12.345,67' } })
    expect(screen.getByLabelText('Valores calculados').textContent).toBe('Honorários R$ 3.703,70 · repasse ao cliente R$ 8.641,97 (calculado pelo sistema)')
  })

  it('CA5 · sem a conferência com a carta, não conclui', async () => {
    const fetch = servidor(prestacao)
    render(<PrestarContas casoId={CASO} />)
    fireEvent.change(await screen.findByLabelText('Valor recebido (atrasados)'), { target: { value: '1.000,00' } })
    fireEvent.change(screen.getByLabelText('Forma de pagamento'), { target: { value: 'Pix' } })
    fireEvent.change(screen.getByLabelText('Prazo de pagamento'), { target: { value: '2026-10-30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Concluir a prestação' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Marque "Conferi os valores com a carta de concessão"')
    fireEvent.click(screen.getByLabelText('Conferi os valores com a carta de concessão'))
    fireEvent.click(screen.getByRole('button', { name: 'Concluir a prestação' }))
    expect((await screen.findByRole('status')).textContent).toContain('O Financeiro recebeu e o Atendimento vai agendar')
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true)
  })

  it('CA6 · com versão concluída, mostra as versões e alterar gera nova', async () => {
    servidor({ ...prestacao, versoes: [versao1] })
    render(<PrestarContas casoId={CASO} />)
    expect((await screen.findByText(/Versão 1 · recebido R\$ 12\.345,67/)).textContent).toContain('Gabi')
    expect(screen.getByRole('button', { name: 'Registrar nova versão' })).toBeTruthy()
  })
})

describe('Receber a prestação (GGVP-44, Financeiro)', () => {
  it('CA8 · vê valores, forma e prazo, a versão e o agendamento', async () => {
    servidor({ ...prestacao, versoes: [versao1], podeEditar: false, podeReceber: true, agendamento: { quando: '2026-10-15T13:00:00.000Z', local: 'Caixa', acompanhante: 'Ana' } })
    render(<ReceberPrestacao casoId={CASO} />)
    expect(await screen.findByText('Repasse ao cliente: R$ 8.641,97')).toBeTruthy()
    expect(screen.getByText(/Forma de pagamento: Pix · prazo 30\/10\/2026/)).toBeTruthy()
    expect(screen.getByText(/Caixa · acompanha: Ana/)).toBeTruthy()
  })

  it('CA9 · divergência pede o motivo', async () => {
    servidor({ ...prestacao, versoes: [versao1], podeEditar: false, podeReceber: true })
    render(<ReceberPrestacao casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Divergência' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar divergência' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva qual é a divergência')
  })
})

describe('Agendar ida ao banco (GGVP-44, Atendimento)', () => {
  it('CA10 · os quatro campos são obrigatórios', async () => {
    const fetch = servidor(banco)
    render(<IdaAoBanco casoId={CASO} />)
    fireEvent.change(await screen.findByLabelText('Data'), { target: { value: '2026-10-15' } })
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '10:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agendar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Informe a agência ou o local')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('CA3, CA11 · mostra a mensagem do modelo para revisar; sem o OK da advogada, não registra o envio (G8)', async () => {
    servidor({ ...banco, okAdvogada: false, agendamento: { id: '11111111-1111-4111-8111-111111111111', data: '15/10/2026', hora: '10:00', local: 'Caixa', acompanhante: 'Ana' }, mensagem: 'Olá, Vera!' })
    render(<IdaAoBanco casoId={CASO} />)
    expect((await screen.findByLabelText('Mensagem')).textContent).toBe('Olá, Vera!')
    expect((screen.getByRole('button', { name: 'Revisei e enviei' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/só sai depois do OK da advogada/)).toBeTruthy()
  })
})
