import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalcularTempo } from './CalcularTempo.tsx'
import { obterCalculo, registrarCalculo } from '../dados/calculo.ts'
import { configurarExemplo, gravar, zerarExemplo } from '../dados/servidor.ts'
import { bancoInventado, ENTREVISTA_FICTICIA, fichaInventada, ID_FICTICIO } from '../dados/caminhoMaria.fixture.ts'

beforeEach(() => { configurarExemplo({ servidor: true, latencia: 0 }); zerarExemplo(); gravar(bancoInventado([{ ...fichaInventada(), nome: 'Cópia inventada antiga' }])) })
afterEach(() => { configurarExemplo({ servidor: false }); zerarExemplo(); vi.unstubAllGlobals() })
describe('cálculo com ficha real', () => {
  it('busca a ficha atual e não apresenta vínculos de exemplo nem a conclusão antiga', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(fichaInventada())))
    vi.stubGlobal('fetch', fetch)
    const dados = await obterCalculo(ENTREVISTA_FICTICIA)
    expect(dados?.cnis).toBeUndefined()
    expect(fetch.mock.calls[0]).toEqual(['/api/fichas/' + ID_FICTICIO, expect.anything()])
    render(<CalcularTempo agendamentoId={ENTREVISTA_FICTICIA} />)
    expect(await screen.findByRole('heading', { name: /Pessoa Inventada no Teste/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Digitar vínculos do CNIS' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Concluir' })).toBeNull()
    expect(screen.queryByText(/Exemplo Comércio/)).toBeNull()
  })
  it('falha da API aparece sem reaproveitar a cópia antiga', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    render(<CalcularTempo agendamentoId={ENTREVISTA_FICTICIA} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível carregar')
    expect(screen.queryByText(/Cópia inventada antiga/)).toBeNull()
  })
  it('bloqueia também o adaptador antigo antes de enviar totais sem os vínculos', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await expect(registrarCalculo(ENTREVISTA_FICTICIA, { tempo: { anos: 1, meses: 0, dias: 0 }, pontos: 55, regra: 'Transição por pontos (EC 103, art. 15)', podeAposentar: true, conferi: true })).rejects.toThrow('Salvar vínculos e carência')
    expect(fetch).not.toHaveBeenCalled()
  })
})
