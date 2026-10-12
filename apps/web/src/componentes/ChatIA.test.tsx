import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { ChatIA } from './ChatIA.tsx'

vi.mock('../dados/chat.ts', async (original) => ({ ...(await original<typeof import('../dados/chat.ts')>()), transcreverFala: vi.fn() }))
const { transcreverFala } = await import('../dados/chat.ts')

const parada = vi.fn()
class GravadorFalso {
  /** O último gravador criado, para o teste que simula o navegador parando o gravador. */
  static ultimo: GravadorFalso | null = null
  constructor() {
    GravadorFalso.ultimo = this
  }
  state: 'inactive' | 'recording' = 'inactive'
  mimeType = 'audio/webm'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(['fala'], { type: 'audio/webm' }) })
    this.onstop?.()
  }
}
const microfone = (getUserMedia: () => Promise<unknown>) => Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(getUserMedia) } })

beforeEach(() => {
  entrarComo()
  vi.useFakeTimers({ shouldAdvanceTime: true })
  microfone(async () => ({ getTracks: () => [{ stop: parada }] }))
  vi.stubGlobal('MediaRecorder', GravadorFalso)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  parada.mockReset()
  vi.mocked(transcreverFala).mockReset()
})

const abrir = () => render(comSessao(<ChatIA exemplo="Ex." sugestoes={[]} onEnviar={() => true} />))
const caixa = () => screen.getByLabelText('✦ Pergunte ou peça') as HTMLTextAreaElement
async function gravar() {
  fireEvent.click(screen.getByRole('button', { name: 'Gravar áudio' }))
  await act(async () => {})
}

describe('12/10 · gravar áudio de verdade', () => {
  it('mostra que grava (tempo correndo) e o Pronto põe a fala na caixa, somada ao que já estava', async () => {
    vi.mocked(transcreverFala).mockResolvedValue('o que falta no caso da Maria')
    abrir()
    fireEvent.change(caixa(), { target: { value: 'Oi.' } })
    await gravar()
    expect(screen.getByRole('group', { name: 'Gravação' }).textContent).toContain('Gravando')
    await act(async () => vi.advanceTimersByTime(3100))
    expect(screen.getByText('0:03')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Pronto' }))
    fireEvent.click(screen.getByRole('button', { name: 'Pronto' }))
    await act(async () => {})
    expect(caixa().value).toBe('Oi. o que falta no caso da Maria')
    expect(parada).toHaveBeenCalled()
    expect(screen.queryByRole('group', { name: 'Gravação' })).toBeNull()
  })

  it('Descartar e Esc jogam a fala fora sem transcrever', async () => {
    abrir()
    await gravar()
    fireEvent.click(screen.getByRole('button', { name: 'Descartar a gravação' }))
    await act(async () => {})
    await gravar()
    fireEvent.keyDown(screen.getByRole('group', { name: 'Gravação' }), { key: 'Escape' })
    await act(async () => {})
    expect(transcreverFala).not.toHaveBeenCalled()
    expect(caixa().value).toBe('')
  })

  it('para sozinho em 2 minutos e transcreve', async () => {
    vi.mocked(transcreverFala).mockResolvedValue('fala longa')
    abrir()
    await gravar()
    await act(async () => vi.advanceTimersByTime(120_200))
    await act(async () => {})
    expect(caixa().value).toBe('fala longa')
  })

  it('fala vazia avisa e deixa a caixa como estava', async () => {
    vi.mocked(transcreverFala).mockResolvedValue('')
    abrir()
    await gravar()
    await act(async () => vi.advanceTimersByTime(2000))
    fireEvent.click(screen.getByRole('button', { name: 'Pronto' }))
    await act(async () => {})
    expect(screen.getByRole('status').textContent).toBe('Não deu para entender a fala: grave de novo, mais perto do microfone, ou digite a pergunta.')
    expect(caixa().value).toBe('')
  })

  it('Pronto antes de 1 segundo não manda nada à IA e avisa', async () => {
    abrir()
    await gravar()
    fireEvent.click(screen.getByRole('button', { name: 'Pronto' }))
    await act(async () => {})
    expect(transcreverFala).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toBe('Não deu para entender a fala: grave de novo, mais perto do microfone, ou digite a pergunta.')
  })

  it('fechar o chat gravando não manda o áudio, mesmo quando o navegador para o gravador ao soltar o microfone', async () => {
    // Pela especificação, parar todas as faixas faz o MediaRecorder parar sozinho e chamar o onstop.
    microfone(async () => ({ getTracks: () => [{ stop: () => GravadorFalso.ultimo?.state === 'recording' && GravadorFalso.ultimo.stop() }] }))
    const { unmount } = abrir()
    await gravar()
    await act(async () => vi.advanceTimersByTime(3000))
    unmount()
    await act(async () => {})
    expect(transcreverFala).not.toHaveBeenCalled()
  })

  it('dois cliques em "Gravar áudio" enquanto o navegador pede o microfone abrem um microfone só', async () => {
    let liberar: (v: unknown) => void = () => {}
    microfone(() => new Promise((r) => (liberar = r)))
    abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Gravar áudio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gravar áudio' }))
    await act(async () => liberar({ getTracks: () => [{ stop: parada }] }))
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)
  })

  it('sem microfone (negado ou ausente) avisa', async () => {
    microfone(async () => Promise.reject(new Error('negado')))
    abrir()
    await gravar()
    expect(screen.getByRole('status').textContent).toBe('Não deu para usar o microfone: libere o acesso no navegador ou digite a pergunta.')
  })

  it('fechar o chat com a gravação aberta solta o microfone', async () => {
    const { unmount } = abrir()
    await gravar()
    unmount()
    expect(parada).toHaveBeenCalled()
  })
})
