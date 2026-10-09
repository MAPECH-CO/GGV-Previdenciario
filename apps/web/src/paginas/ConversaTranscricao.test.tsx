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
    transcreverConversa: vi.fn((id: string, opcoes?: { falhar?: boolean }) => real.transcreverConversa(id, opcoes)),
  }
})

const conversa = await import('../dados/conversa.ts')
const audio = await import('../dados/audio.ts')
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
    // O servidor falso das telas transcreve com a conversa de exemplo (o de verdade, com a chave, transcreve o áudio); o
    // teste espera ela terminar (a máquina lenta pede folga).
    expect(await screen.findByText('Transcrição pronta (D5.02): o texto está nas transcrições do card.', undefined, { timeout: 15000 })).toBeTruthy()
  }, 30000)

  it('sem microfone, o áudio gravado fora sobe nesta conversa e vai para a transcrição; sem a chave do serviço, a tela diz o motivo, nenhuma fala de exemplo', async () => {
    vi.mocked(audio.abrirMicrofone).mockResolvedValueOnce({ erro: 'nenhum microfone foi encontrado neste computador' })
    // O servidor de verdade, sem a chave, não transcreve o arquivo com a conversa de exemplo: falha com o motivo (GGVP-133).
    vi.mocked(conversa.transcreverConversa).mockImplementationOnce(async (id) => {
      const r = (await conversa.obterConversa(id))!
      return { ...r, gravacao: { ...r.gravacao!, transcricao: 'falhou' as const, motivoDaFalha: 'a transcrição está desligada (falta a chave do serviço)', trechos: [] } }
    })
    const c = await conversa.abrirConversa('maria-exemplo', { canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real' })
    render(comSessao(<Conversa conversaId={c.id} passo={5} />))
    await screen.findByRole('heading', { level: 1, name: 'Maria Exemplo · Registrar conversa' })
    fireEvent.click(botao('Gravar'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Avisei que a conversa será gravada' }))
    fireEvent.click(botao('Começar a gravar'))
    expect(await screen.findByRole('heading', { name: 'Sem microfone: nenhum microfone foi encontrado neste computador' }, { timeout: 15000 })).toBeTruthy()
    expect(document.body.textContent).not.toContain('Mudei de casa')
    const arquivo = new File(['OggS'], 'gravador.ogg', { type: 'audio/ogg' })
    fireEvent.change(await screen.findByLabelText('Subir o áudio gravado fora', undefined, { timeout: 15000 }), { target: { files: [arquivo] } })
    await waitFor(() => expect(conversa.finalizarConversa).toHaveBeenCalled())
    expect(conversa.enviarParteDaConversa).toHaveBeenCalledWith(c.id, { audio: arquivo, inicio: 0 })
    expect(vi.mocked(conversa.enviarParteDaConversa).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(conversa.finalizarConversa).mock.invocationCallOrder[0])
    expect(
      await screen.findByText('A transcrição falhou: a transcrição está desligada (falta a chave do serviço). O áudio está guardado; nada se perdeu.', undefined, { timeout: 15000 }),
    ).toBeTruthy()
    expect(screen.queryByText('Transcrição pronta (D5.02): o texto está nas transcrições do card.')).toBeNull()
    expect(screen.queryByRole('list', { name: 'Falas' })).toBeNull()
    expect(document.body.textContent).not.toContain('Mudei de casa')
  }, 30000)

  it('CA4 · na ligação gravada agora não há texto ao vivo: o texto sai ao terminar', async () => {
    await gravar('ligacao')
    expect(await screen.findByText('Gravando: o texto sai quando a conversa terminar.')).toBeTruthy()
    expect(conversa.pedirChaveAoVivoDaConversa).not.toHaveBeenCalled()
  })
})
