// GGVP-133, parte 3: a conversa do Relacionamento grava com o microfone de verdade; no escritório, o texto ao vivo vem
// da OpenAI. O microfone e o texto ao vivo são de mentira; o resto vai ao servidor falso do Relacionamento.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const microfone = { pausar: vi.fn(), retomar: vi.fn(), parar: vi.fn(async () => {}), stream: {} as MediaStream }
const PARTE = { audio: new Blob(['áudio'], { type: 'audio/webm' }), inicio: 0 }

vi.mock('../dados/audio.ts', () => ({
  abrirMicrofone: vi.fn(async (_segundos: () => number, aoTerParte: (parte: typeof PARTE) => void) => {
    microfone.parar.mockImplementation(async () => aoTerParte(PARTE))
    return microfone
  }),
  ouvirAoVivo: vi.fn(async (_stream: MediaStream, _chave: string, aoMudar: (falas: { id: string; texto: string; final: boolean }[]) => void) => {
    aoMudar([{ id: 'i1', texto: 'Bom dia, dona Maria.', final: true }])
    return () => {}
  }),
}))

vi.mock('../dados/conversa.ts', async (original) => {
  const real = await original<typeof import('../dados/conversa.ts')>()
  return {
    ...real,
    enviarParteDaConversa: vi.fn(async () => ({})),
    pedirChaveAoVivoDaConversa: vi.fn(async () => ({ chave: 'ek_temporaria', expiraEm: '', modelo: 'gpt-4o-transcribe' })),
    finalizarConversa: vi.fn((id: string, fim: { aos: number }) => real.finalizarConversa(id, fim)),
  }
})

const conversa = await import('../dados/conversa.ts')
const { comSessao, entrarComo } = await import('../dados/sessaoDeTeste.tsx')
const { configurarExemplo, zerarExemplo } = await import('../dados/servidor.ts')
const { Conversa } = await import('./Conversa.tsx')

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 14, 32), latencia: 0 })
  zerarExemplo()
  window.localStorage.clear()
  entrarComo()
})
afterEach(() => vi.clearAllMocks())

const botao = (nome: string) => screen.getByRole('button', { name: nome })
async function gravar(canal: 'presencial' | 'ligacao') {
  const c = await conversa.abrirConversa('maria-exemplo', { canal, comQuem: 'cliente', modo: 'tempo-real' })
  render(comSessao(<Conversa conversaId={c.id} passo={5} />))
  await screen.findByRole('heading', { level: 1, name: 'Maria Exemplo · Registrar conversa' })
  fireEvent.click(botao('Gravar'))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Avisei que a conversa será gravada' }))
  fireEvent.click(botao('Começar a gravar'))
  await screen.findByText(/● Gravando/)
  return c
}

describe('GGVP-133 · conversa do Relacionamento com o microfone de verdade', () => {
  it('CA4 · no escritório, o texto ao vivo vem da OpenAI, não a conversa de exemplo; pausar pausa o microfone; ao finalizar, o áudio sobe antes', async () => {
    const c = await gravar('presencial')
    expect((await screen.findByRole('list', { name: 'Falas ao vivo' })).textContent).toBe('Bom dia, dona Maria.')
    expect(screen.queryByRole('list', { name: 'Falas' })).toBeNull()
    fireEvent.click(botao('Pausar'))
    expect(microfone.pausar).toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Retomar' }))
    await screen.findByText(/● Gravando/)
    const finalizar = (await screen.findByRole('button', { name: 'Finalizar conversa' })) as HTMLButtonElement
    await waitFor(() => expect(finalizar.disabled).toBe(false))
    fireEvent.click(finalizar)
    await waitFor(() => expect(conversa.finalizarConversa).toHaveBeenCalled())
    const enviou = vi.mocked(conversa.enviarParteDaConversa)
    expect(enviou).toHaveBeenCalledWith(c.id, PARTE)
    expect(enviou.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(conversa.finalizarConversa).mock.invocationCallOrder[0])
    // Sem a chave no servidor falso, a transcrição é a de exemplo; o teste espera ela terminar.
    expect(await screen.findByText('Transcrição pronta (D5.02): o texto está nas transcrições do card.')).toBeTruthy()
  })

  it('CA4 · na ligação gravada agora não há texto ao vivo: o texto sai ao terminar', async () => {
    await gravar('ligacao')
    expect(await screen.findByText('Gravando: o texto sai quando a conversa terminar.')).toBeTruthy()
    expect(conversa.pedirChaveAoVivoDaConversa).not.toHaveBeenCalled()
  })
})
