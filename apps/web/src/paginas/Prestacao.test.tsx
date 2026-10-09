import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IdaAoBanco } from './IdaAoBanco.tsx'
import { LevarAoBanco } from './LevarAoBanco.tsx'
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
  formaPagamento: 'pix',
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
  podeConfirmar: false,
  encerrado: false,
  equipe: [{ id: '33333333-3333-4333-8333-333333333333', nome: 'Ana (exemplo)' }],
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
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Escolha', 'Pix', 'Transferência bancária', 'Boleto', 'Dinheiro'])
    fireEvent.change(screen.getByLabelText('Prazo de pagamento'), { target: { value: '2026-10-30' } })
    // GGVP-109 CA3: sem a conferência marcada, o botão fica desabilitado.
    expect((screen.getByRole('button', { name: 'Concluir a prestação' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Conferi os valores com a carta de concessão'))
    fireEvent.click(screen.getByRole('button', { name: 'Concluir a prestação' }))
    expect((await screen.findByRole('status')).textContent).toContain('O Financeiro recebe e, depois, avisa o cliente')
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

  it('GGVP-98 CA3 · "Receber e lançar" só com "Valores conferem com o comprovante"', async () => {
    const fetch = servidor({ ...prestacao, versoes: [versao1], podeEditar: false, podeReceber: true })
    render(<ReceberPrestacao casoId={CASO} />)
    const lancar = (await screen.findByRole('button', { name: 'Receber e lançar' })) as HTMLButtonElement
    expect(lancar.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Valores conferem com o comprovante'))
    fireEvent.click(lancar)
    expect((await screen.findByRole('status')).textContent).toContain('avise o cliente e marque a ida ao banco')
    const envio = fetch.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(envio?.[1]?.body))).toEqual({ resultado: 'recebido', valoresConferem: true })
  })

  it('CA9 · divergência pede o motivo', async () => {
    servidor({ ...prestacao, versoes: [versao1], podeEditar: false, podeReceber: true })
    render(<ReceberPrestacao casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Divergência, devolver à advogada' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar divergência' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva qual é a divergência')
  })
})

describe('Avisar e agendar a ida ao banco (GGVP-44 e GGVP-98, Financeiro)', () => {
  it('GGVP-98 CA6 · quem leva o cliente é obrigatório e vem do Atendimento', async () => {
    servidor(banco)
    render(<IdaAoBanco casoId={CASO} />)
    const campo = (await screen.findByLabelText('Quem do Atendimento leva o cliente')) as HTMLSelectElement
    expect([...campo.options].map((o) => o.textContent)).toEqual(['Escolha', 'Ana (exemplo)'])
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '2026-10-15' } })
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('Agência ou local'), { target: { value: 'Caixa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Agendar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escolha quem do Atendimento acompanha o cliente')
  })

  it('GGVP-98 CA9 · depois do aviso, "Confirmar recebimento" fecha o caso', async () => {
    const agendamento = { id: '11111111-1111-4111-8111-111111111111', data: '15/10/2026', hora: '10:00', local: 'Caixa', acompanhante: 'Ana' }
    const fetch = servidor({ ...banco, agendamento, podeConfirmar: true })
    render(<IdaAoBanco casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar recebimento' }))
    expect((await screen.findByRole('status')).textContent).toBe('Recebimento confirmado. Caso encerrado.')
    expect(fetch.mock.calls.some(([url, init]) => String(url).endsWith('/banco/confirmacao') && init?.method === 'POST')).toBe(true)
  })

  it('CA10 · data, hora e local são obrigatórios', async () => {
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

describe('Levar ao banco (GGVP-98, Atendimento)', () => {
  const visita = {
    casoId: CASO,
    cliente: 'Vera Lúcia (exemplo)',
    data: '15/10/2026',
    hora: '10:00',
    local: 'Caixa, agência Centro',
    acompanhante: 'Ana (exemplo)',
    oQueLevar: ['Documento oficial com foto do cliente (RG ou CNH)', 'CPF do cliente'],
  }

  it('mostra a visita marcada pelo Financeiro e o que levar, sem nenhum valor', async () => {
    servidor(visita)
    render(<LevarAoBanco casoId={CASO} />)
    expect((await screen.findByLabelText('Ida ao banco')).textContent).toBe('Marcada pelo Financeiro15/10/2026 às 10:00Caixa, agência CentroQuem leva: Ana (exemplo)')
    expect(screen.getByLabelText('O que levar').textContent).toContain('CPF do cliente')
    expect(document.body.textContent).not.toContain('R$')
  })

  it('"Levei o cliente ao banco" registra e avisa que o Financeiro confirma', async () => {
    const fetch = servidor(visita, [201, { ok: true }])
    render(<LevarAoBanco casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Levei o cliente ao banco' }))
    expect((await screen.findByRole('status')).textContent).toBe('Registrado. O Financeiro foi avisado e confirma o recebimento.')
    const envio = fetch.mock.calls.find(([, init]) => init?.method === 'POST')
    expect([String(envio?.[0]).endsWith('/banco/levar'), JSON.parse(String(envio?.[1]?.body))]).toEqual([true, { resultado: 'levado' }])
  })

  it('"Não deu" pede o motivo e volta ao Financeiro remarcar', async () => {
    const fetch = servidor(visita, [201, { ok: true }])
    render(<LevarAoBanco casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Não deu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: não deu' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva por que não deu')
    expect(fetch).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('Por que não deu'), { target: { value: 'Agência fechada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: não deu' }))
    expect((await screen.findByRole('status')).textContent).toBe('Registrado. A ida ao banco voltou para o Financeiro remarcar.')
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toEqual({ resultado: 'nao_deu', motivo: 'Agência fechada' })
  })

  it('sem ida marcada, mostra o aviso do servidor', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ erro: 'Não há ida ao banco marcada para levar neste caso.' }), { status: 409 })))
    render(<LevarAoBanco casoId={CASO} />)
    expect((await screen.findByRole('alert')).textContent).toBe('Não há ida ao banco marcada para levar neste caso.')
  })
})
