// GGVP-133: a entrevista de uma ficha do servidor grava com o microfone de verdade e mostra o texto ao vivo da OpenAI.
// O microfone, o texto ao vivo e o servidor são de mentira: aqui se confere a tela.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Gravacao } from '../dados/tipos.ts'

const ID = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
const microfone = { pausar: vi.fn(), retomar: vi.fn(), parar: vi.fn(async () => {}), stream: {} as MediaStream }
let aoTerParte: (parte: { audio: Blob; inicio: number }) => void = () => {}
const PARTE = { audio: new Blob(['áudio'], { type: 'audio/webm' }), inicio: 0 }

vi.mock('../dados/audio.ts', () => ({
  abrirMicrofone: vi.fn(async (_segundos: () => number, cadaParte: typeof aoTerParte) => {
    aoTerParte = cadaParte
    microfone.parar.mockImplementation(async () => aoTerParte(PARTE))
    return microfone
  }),
  ouvirAoVivo: vi.fn(async (_stream: MediaStream, _chave: string, aoMudar: (falas: { id: string; texto: string; final: boolean }[]) => void) => {
    aoMudar([{ id: 'i1', texto: 'Bom dia, dona Josefa, vamos começar.', final: true }])
    return () => {}
  }),
}))

const chave = vi.fn(async (): Promise<{ chave: string; expiraEm: string; modelo: string } | { erro: string }> => ({ chave: 'ek_temporaria', expiraEm: '', modelo: 'gpt-4o-transcribe' }))
vi.mock('../dados/entrevista.ts', async (original) => {
  const real = await original<typeof import('../dados/entrevista.ts')>()
  const g = (extra: Partial<Gravacao>): Gravacao => ({
    id: `gravacao-${ID}`,
    fichaId: 'josefa-exemplo',
    agendamentoId: 'josefa-entrevista',
    data: '2026-10-05',
    titulo: 'Entrevista com a advogada',
    canal: 'presencial',
    participantes: ['Dra. Paula', 'Josefa Exemplo'],
    duracao: 0,
    origem: 'portal',
    estado: 'gravando',
    acoes: [],
    transcricao: 'transcrevendo',
    trechos: [],
    extraidas: [],
    documentos: [],
    soJuridico: true,
    marcas: [],
    ...extra,
  })
  return {
    ...real,
    iniciarGravacao: vi.fn(async () => g({ avisoEm: '2026-10-05T17:32:00.000Z' })),
    registrarAcao: vi.fn(async (_id: string, acao: string) => g({ estado: acao === 'pausou' ? 'pausada' : 'gravando' })),
    enviarParteDoAudio: vi.fn(async () => g({})),
    pedirChaveAoVivo: vi.fn(() => chave()),
    encerrarGravacao: vi.fn(async () => ({ gravacao: g({ estado: 'encerrada', duracao: 60 }) })),
    transcrever: vi.fn(async () =>
      g({
        estado: 'encerrada',
        duracao: 60,
        transcricao: 'pronta',
        alertaDaIa: 'saída repete instrução suspeita',
        trechos: [{ aos: 1, quem: 'Dra. Paula', papel: 'advogada', texto: 'Bom dia, dona Josefa.', original: 'Bom dia, dona Josefa.' }],
      }),
    ),
  }
})

const entrevista = await import('../dados/entrevista.ts')
const { configurarExemplo, zerarExemplo } = await import('../dados/servidor.ts')
const { EntrevistaAoVivo } = await import('./EntrevistaAoVivo.tsx')

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0, servidor: true })
  zerarExemplo()
})
afterEach(() => {
  configurarExemplo({ servidor: false })
  vi.clearAllMocks()
})

const botao = (nome: string) => screen.getByRole('button', { name: nome })
async function comecar() {
  render(<EntrevistaAoVivo agendamentoId="josefa-entrevista" passo={5} />)
  await screen.findByRole('heading', { level: 1, name: 'Entrevista com Josefa Exemplo' })
  fireEvent.click(botao('Gravar'))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Avisei o cliente que a conversa será gravada' }))
  fireEvent.click(botao('Começar a gravar'))
  await screen.findByText(/● Gravando/)
}

describe('GGVP-133 · entrevista com o microfone de verdade', () => {
  it('CA4 · o texto ao vivo vem da OpenAI, não a conversa de exemplo; pausar pausa o microfone; ao encerrar, o áudio sobe antes e a transcrição final vale', async () => {
    await comecar()
    expect((await screen.findByRole('list', { name: 'Falas ao vivo' })).textContent).toBe('Bom dia, dona Josefa, vamos começar.')
    expect(screen.queryByRole('list', { name: 'Falas' })).toBeNull()
    expect(screen.getByText(/O que vale no caso é o texto final/)).toBeTruthy()

    fireEvent.click(botao('Pausar'))
    expect(microfone.pausar).toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Retomar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Encerrar e gerar resumo' }))

    await waitFor(() => expect(entrevista.transcrever).toHaveBeenCalled())
    const enviou = vi.mocked(entrevista.enviarParteDoAudio)
    const encerrou = vi.mocked(entrevista.encerrarGravacao)
    expect(enviou).toHaveBeenCalledWith(`gravacao-${ID}`, PARTE)
    expect(enviou.mock.invocationCallOrder[0]).toBeLessThan(encerrou.mock.invocationCallOrder[0])
    expect(encerrou.mock.calls[0][1]).toMatchObject({ online: true })
    // CA7: o alerta do motor aparece antes de a pessoa usar o texto.
    expect((await screen.findByRole('alert')).textContent).toContain('Atenção: saída repete instrução suspeita')
    expect(screen.getByRole('list', { name: 'Falas' }).textContent).toContain('Bom dia, dona Josefa.')
  })

  it('CA4 · sem a chave do serviço, a gravação segue e a tela diz que o texto sai ao encerrar', async () => {
    chave.mockResolvedValueOnce({ erro: 'O texto ao vivo não está disponível agora: a transcrição sai quando a gravação terminar.' })
    await comecar()
    expect(await screen.findByText('O texto ao vivo não está disponível agora: a transcrição sai quando a gravação terminar.')).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Falas' })).toBeNull()
  })
})
