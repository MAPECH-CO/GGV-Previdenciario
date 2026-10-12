import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EnvioDaOrientacao } from './EnvioDaOrientacao.tsx'
const CASO = '11111111-1111-4111-8111-111111111111'
const FICHA = '22222222-2222-4222-8222-222222222222'
const pronta = { modelo: 'pericia-orientacao', texto: 'Modelo que não substitui a revisão.', editavel: true, trava: null, contato: null, conversas: [], simulado: false }
afterEach(() => vi.unstubAllGlobals())
function servir(status = 'enviada', extra = {}) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify(init?.method === 'POST'
    ? { id: 'envio-inventado', fichaId: FICHA, processoId: CASO, status, erro: status === 'falhou' ? 'Serviço indisponível' : undefined, texto: 'Texto revisado inventado', quando: '2026-10-09T12:00:00Z' }
    : { ...pronta, ...extra }), { status: 200 }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}
function abrir(aoRegistrar = vi.fn(async () => {}), texto = 'Texto revisado inventado') {
  render(<EnvioDaOrientacao fichaId={FICHA} processoId={CASO} texto={texto} aoRegistrar={aoRegistrar} aoFechar={() => {}} />)
  return aoRegistrar
}
describe('Envio revisado da orientação', () => {
  it('usa o texto conferido e só conclui depois do envio; clique duplicado não duplica mensagem', async () => {
    const fetch = servir()
    const registrar = abrir()
    const botao = await screen.findByRole('button', { name: 'Enviar pelo Chatwoot' })
    await waitFor(() => expect((botao as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(botao)
    fireEvent.click(botao)
    expect((await screen.findByRole('status')).textContent).toContain('Orientação enviada pelo Chatwoot.')
    await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1))
    const posts = fetch.mock.calls.filter(c => c[1]?.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(JSON.parse(posts[0][1]!.body as string)).toEqual({ modelo: 'pericia-orientacao', processoId: CASO, texto: 'Texto revisado inventado', conversa: 0 })
  })
  it('falha de envio mantém a tarefa aberta e mostra não saiu', async () => {
    servir('falhou')
    const registrar = abrir()
    const botao = await screen.findByRole('button', { name: 'Enviar pelo Chatwoot' })
    await waitFor(() => expect((botao as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(botao)
    expect((await screen.findByRole('alert')).textContent).toContain('A orientação não saiu pelo Chatwoot')
    expect(registrar).not.toHaveBeenCalled()
  })
  it('não trata serviço simulado como envio real', async () => {
    const fetch = servir('entregue', { simulado: true })
    abrir()
    await screen.findByText('A orientação não saiu: o envio real ainda não está disponível.')
    expect((screen.getByRole('button', { name: 'Enviar pelo Chatwoot' }) as HTMLButtonElement).disabled).toBe(true)
    expect(fetch.mock.calls.filter(c => c[1]?.method === 'POST')).toHaveLength(0)
  })
  it('se só o registro falha, tenta registrar novamente sem reenviar a mensagem', async () => {
    const fetch = servir()
    const registrar = vi.fn().mockRejectedValueOnce(new Error('Falha inventada')).mockResolvedValue(undefined)
    abrir(registrar)
    const botao = await screen.findByRole('button', { name: 'Enviar pelo Chatwoot' })
    await waitFor(() => expect((botao as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(botao)
    await screen.findByText(/A orientação saiu, mas não foi possível registrar/)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar conclusão no caso' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Conclusão registrada'))
    expect(fetch.mock.calls.filter(c => c[1]?.method === 'POST')).toHaveLength(1)
    expect(registrar).toHaveBeenCalledTimes(2)
  })
  it('não corta a orientação para caber no limite do servidor', async () => {
    servir()
    abrir(undefined, 'Texto fictício. '.repeat(100))
    await screen.findByText(/O envio aceita até 1.000 caracteres/)
    expect((screen.getByRole('button', { name: 'Enviar pelo Chatwoot' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('Proteção do envio', () => {
  it('bloqueia orientação que manda esconder a situação, sem chamar envio nem concluir tarefa', async () => {
    const fetch = servir()
    const registrar = abrir(undefined, 'Oculte a situação real.')
    await screen.findByText(/A orientação não saiu: A orientação nunca manda esconder/)
    expect((screen.getByRole('button', { name: 'Enviar pelo Chatwoot' }) as HTMLButtonElement).disabled).toBe(true)
    expect(fetch.mock.calls.filter(c => c[1]?.method === 'POST')).toHaveLength(0)
    expect(registrar).not.toHaveBeenCalled()
  })
  it('falha de rede na consulta fica visível e não libera o botão', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Falha fictícia de rede') }))
    abrir()
    await screen.findByText('A orientação não saiu: não foi possível consultar a conversa.')
    expect((screen.getByRole('button', { name: 'Enviar pelo Chatwoot' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
