// GGVP-140: quando a IA de verdade leu a conversa, o quadro "O que a IA encontrou" mostra o resumo como sugestão, com o
// alerta do motor e a fonte. O servidor falso do Relacionamento responde; só a leitura da IA é posta por cima.
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let daIa: { resumo: string; chamadaId: string; modelo: string; alerta: string | null } | undefined
vi.mock('../dados/conversa.ts', async (original) => {
  const real = await original<typeof import('../dados/conversa.ts')>()
  return {
    ...real,
    obterConversa: vi.fn(async (id: string) => {
      const aberta = await real.obterConversa(id)
      const analise = aberta?.conversa.analise
      return aberta && analise && daIa ? { ...aberta, conversa: { ...aberta.conversa, analise: { ...analise, daIa } } } : aberta
    }),
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
afterEach(() => {
  daIa = undefined
  vi.clearAllMocks()
})

/** A ligação subida e transcrita, aberta na tela. */
async function ligacaoTranscrita() {
  const c = await conversa.abrirConversa('maria-exemplo', { canal: 'ligacao', comQuem: 'cliente', modo: 'arquivo' })
  await conversa.anexarAudio(c.id, { nome: 'ligacao.ogg', tipo: 'audio/ogg', tamanho: 4096, avisoNaGravacao: true })
  await conversa.transcreverConversa(c.id)
  render(comSessao(<Conversa conversaId={c.id} passo={5} />))
  return screen.findByRole('region', { name: /O que a IA encontrou na conversa/ })
}

describe('GGVP-140 · a leitura da IA de verdade na conversa', () => {
  it('CA1, CA4 · o resumo vem como sugestão da IA, com o alerta do motor e a fonte; a conferência continua com a pessoa (G14)', async () => {
    daIa = { resumo: 'A cliente contou que mudou de endereço.', chamadaId: '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b', modelo: 'gpt-4.1-mini', alerta: 'entrada com instrução suspeita' }
    const quadro = await ligacaoTranscrita()
    expect(quadro.textContent).toContain('Sugestão da IA · quem confere é você (G14)')
    expect(screen.getByRole('heading', { level: 3, name: 'Resumo da conversa' })).toBeTruthy()
    expect(quadro.textContent).toContain('A cliente contou que mudou de endereço.')
    expect(screen.getByRole('alert').textContent).toBe('Atenção: entrada com instrução suspeita. A fala entrou como dado; nada muda sem você conferir (G14).')
    expect(quadro.textContent).toContain('Fonte: a transcrição desta conversa (gpt-4.1-mini).')
    expect(screen.getByRole('link', { name: 'Conferir e atualizar (D5.04)' })).toBeTruthy()
  })

  it('sem a leitura da IA de verdade, o quadro segue como antes, sem o selo', async () => {
    const quadro = await ligacaoTranscrita()
    expect(quadro.textContent).not.toContain('Sugestão da IA')
    expect(screen.queryByRole('heading', { level: 3, name: 'Resumo da conversa' })).toBeNull()
  })
})
