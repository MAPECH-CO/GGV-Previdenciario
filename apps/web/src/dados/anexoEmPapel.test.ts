import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { anexarPapel } from './anexoEmPapel.ts'
import { configurarExemplo, gravar, zerarExemplo } from './servidor.ts'
import { bancoInventado, CASO_FICTICIO, fichaInventada, ID_FICTICIO } from './caminhoMaria.fixture.ts'
vi.mock('../regras/arquivos.ts', async original => ({ ...await original<typeof import('../regras/arquivos.ts')>(), hashDoConteudo: async () => 'a'.repeat(64) }))
const arquivo = () => { const f = new File(['conteúdo inventado'], 'contrato-teste.pdf', { type: 'application/pdf' }); Object.defineProperty(f, 'arrayBuffer', { value: async () => new ArrayBuffer(1) }); return f }
beforeEach(() => { configurarExemplo({ servidor: true, latencia: 0 }); zerarExemplo(); gravar(bancoInventado()) })
afterEach(() => { configurarExemplo({ servidor: false }); zerarExemplo(); vi.unstubAllGlobals() })

describe('anexar papel com conteúdo', () => {
  it('GGVP-158 E11 · o contrato assinado vai pela rota do contrato, em FormData, numa chamada só', async () => {
    const ficha = fichaInventada()
    ficha.processos = [{ id: CASO_FICTICIO, beneficio: 'aposentadoria-idade', etapa: 'Contrato' }]
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ arquivo: { nome: 'Contrato assinado - teste (papel).pdf' }, ficha })))
    vi.stubGlobal('fetch', fetch)
    await anexarPapel(ID_FICTICIO, arquivo(), 'contrato', CASO_FICTICIO)
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0]
    expect(url.endsWith(`/processos/${CASO_FICTICIO}/contrato/digitalizacao`)).toBe(true)
    expect((init as RequestInit).body).toBeInstanceOf(FormData)
    expect(((init as RequestInit).body as FormData).get('arquivo')).toBeInstanceOf(File)
  })
  it('a ficha de atendimento usa as duas rotas da pasta e só conclui depois da resposta de conteúdo', async () => {
    const ficha = fichaInventada()
    const fetch = vi.fn(async (url: string, _init?: RequestInit) => new Response(JSON.stringify(url.endsWith('/conteudo') ? { documentoId: CASO_FICTICIO } : { ficha })))
    vi.stubGlobal('fetch', fetch)
    await anexarPapel(ID_FICTICIO, arquivo(), 'ficha-atendimento')
    expect(fetch.mock.calls.map(([u]) => u.slice(u.indexOf('/api/')))).toEqual([`/api/fichas/${ID_FICTICIO}/arquivos`, `/api/fichas/${ID_FICTICIO}/arquivos/conteudo`])
    const envio = fetch.mock.calls[1]
    expect((envio[1] as RequestInit).body).toBeInstanceOf(FormData)
    expect(((envio[1] as RequestInit).body as FormData).get('arquivo')).toBeInstanceOf(File)
  })
  it('não declara sucesso se o conteúdo falhar depois dos metadados', async () => {
    const ficha = fichaInventada()
    vi.stubGlobal('fetch', vi.fn(async (url: string, _init?: RequestInit) => new Response(JSON.stringify(url.endsWith('/conteudo') ? { erro: 'Não guardou' } : url.endsWith('/arquivos') ? { ficha } : ficha), { status: url.endsWith('/conteudo') ? 503 : 200 })))
    await expect(anexarPapel(ID_FICTICIO, arquivo(), 'ficha-atendimento')).rejects.toThrow('Não guardou')
  })
  it('o contrato sem caso e o erro da rota do contrato não viram sucesso', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ erro: 'Imprima o kit antes.' }), { status: 400 }))
    vi.stubGlobal('fetch', fetch)
    await expect(anexarPapel(ID_FICTICIO, arquivo(), 'contrato')).rejects.toThrow('não tem caso')
    expect(fetch).not.toHaveBeenCalled()
    await expect(anexarPapel(ID_FICTICIO, arquivo(), 'contrato', CASO_FICTICIO)).rejects.toThrow('Imprima o kit antes.')
  })
  it('rejeita arquivo vazio ou formato fora da lista antes de chamar a API', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await expect(anexarPapel(ID_FICTICIO, new File([], 'vazio.pdf'), 'contrato', CASO_FICTICIO)).rejects.toThrow('vazio')
    await expect(anexarPapel(ID_FICTICIO, new File(['teste'], 'teste.exe'), 'contrato', CASO_FICTICIO)).rejects.toThrow('Só PDF')
    expect(fetch).not.toHaveBeenCalled()
  })
})
