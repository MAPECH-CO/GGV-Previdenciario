import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PrestarContas } from './PrestarContas.tsx'
import { IdaAoBanco } from './IdaAoBanco.tsx'
const id = '11111111-1111-4111-8111-111111111111'
const prestacao = {
  casoId: id, cliente: 'Pessoa Inventada Teste', beneficio: 'bpc_loas_idoso', carta: { id, nome: 'Carta fictícia.pdf' }, percentualContrato: '25.00', agendamento: null, podeEditar: true, podeReceber: false,
  versoes: [{ versao: 1, valorRecebido: '1000.00', percentual: '25.00', honorarios: '250.00', repasse: '750.00', formaPagamento: 'pix', prazoPagamento: '2030-10-30', por: 'Advogada Fictícia', em: '2030-10-01T12:00:00Z', recebidaPor: null, recebidaEm: null, divergencia: null }],
}
const banco = { casoId: id, cliente: 'Pessoa Inventada Teste', agendamento: { id, data: '30/10/2030', hora: '10:00', local: 'Agência Fictícia', acompanhante: 'Acompanhante Fictício' }, equipe: [], mensagem: 'Texto inventado aprovado para a ida ao banco.', modeloCadastrado: true, okAdvogada: true, avisos: [], podeAgendar: false, podeConfirmar: false, encerrado: false }
function servidor(dados: unknown, falha = false) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify(init?.method === 'POST' ? falha ? { erro: 'Registro recusado no teste.' } : { ok: true } : dados), { status: init?.method === 'POST' && falha ? 409 : 200 }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('carrega a última versão editável e mostra fontes sem inventar entrada ou parcelas', async () => {
  servidor(prestacao)
  render(<PrestarContas casoId={id} />)
  expect((await screen.findByLabelText('Valor recebido (atrasados)') as HTMLInputElement).value).toBe('1.000,00')
  expect((screen.getByLabelText('Prazo de pagamento') as HTMLInputElement).value).toBe('2030-10-30')
  expect(screen.getByLabelText('Contrato e fonte dos valores').textContent).toContain('versão 1, registrada por Advogada Fictícia')
  for (const rotulo of ['Entrada do contrato', 'Parcelas do contrato', 'Parte na Caixa']) {
    const campo = screen.getByLabelText(rotulo) as HTMLInputElement
    expect(campo.disabled).toBe(true)
    expect(campo.value).toBe('')
  }
  fireEvent.change(screen.getByLabelText('Valor recebido (atrasados)'), { target: { value: '2.000,00' } })
  expect(screen.getByLabelText('Valores calculados').textContent).toContain('Honorários R$ 500,00 · repasse ao cliente R$ 1.500,00')
})
it('a visão somente de consulta não oferece OK nem edição da prestação', async () => {
  servidor({ ...prestacao, podeEditar: false })
  render(<PrestarContas casoId={id} />)
  await screen.findByLabelText('Contrato e fonte dos valores')
  expect(screen.queryByLabelText('Valor recebido (atrasados)')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Registrar nova versão' })).toBeNull()
})
it('só registra ligação declarada e nunca chama envio de WhatsApp indisponível', async () => {
  const fetch = servidor(banco)
  render(<IdaAoBanco casoId={id} />)
  const botao = await screen.findByRole('button', { name: 'Registrar ligação feita' }) as HTMLButtonElement
  expect(botao.disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Enviar complemento pelo Chatwoot' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(botao)
  expect(fetch.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(0)
  fireEvent.click(screen.getByLabelText('Liguei para o cliente e expliquei a ida ao banco com este texto'))
  fireEvent.click(botao)
  expect(await screen.findByText('Ligação registrada. O aviso por telefone ficou no histórico do caso.')).toBeTruthy()
  const posts = fetch.mock.calls.filter(([, i]) => i?.method === 'POST')
  expect(posts).toHaveLength(1)
  expect(posts[0][0]).toBe('/api/casos/' + id + '/banco/envio')
  expect(JSON.parse(String(posts[0][1]?.body))).toEqual({ canal: 'telefone' })
})
it('registro recusado não aparece como ligação registrada', async () => {
  servidor(banco, true)
  render(<IdaAoBanco casoId={id} />)
  fireEvent.click(await screen.findByLabelText('Liguei para o cliente e expliquei a ida ao banco com este texto'))
  fireEvent.click(screen.getByRole('button', { name: 'Registrar ligação feita' }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Registro recusado no teste.')
  expect(screen.queryByText('Ligação registrada. O aviso por telefone ficou no histórico do caso.')).toBeNull()
})

it('editar um valor exige conferir novamente antes do OK', async () => {
  servidor(prestacao)
  render(<PrestarContas casoId={id} />)
  fireEvent.click(await screen.findByLabelText('Conferi os valores com a carta de concessão'))
  expect((screen.getByRole('button', { name: 'Registrar nova versão' }) as HTMLButtonElement).disabled).toBe(false)
  fireEvent.change(screen.getByLabelText('Honorários do contrato (%)'), { target: { value: '20' } })
  expect((screen.getByLabelText('Conferi os valores com a carta de concessão') as HTMLInputElement).checked).toBe(false)
  expect((screen.getByRole('button', { name: 'Registrar nova versão' }) as HTMLButtonElement).disabled).toBe(true)
})
