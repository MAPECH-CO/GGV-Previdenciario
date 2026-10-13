import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JusticaDoCaso } from './JusticaDoCaso.tsx'
const CASO = '11111111-1111-4111-8111-111111111111'
const juizo = {
  juizo: 'TRF fictício', vara: 'Vara Inventada', juiz: 'Juiz Inventado', base: '2026-10-09',
  entendimentos: [], porBeneficio: [{ beneficio: 'teste', nome: 'Benefício fictício', procedentes: 1, decididos: 2, texto: '50% · 1 de 2' }],
  tempoAteASentenca: { meses: 8, processos: 2 },
  processos: [{ numeroCnj: 'processo-ficticio-a', desfecho: 'procedente' }, { numeroCnj: 'processo-ficticio-b', desfecho: 'improcedente' }],
}
const pericia = (registradaPor = 'Sistema') => ({
  pericia: { tipo: 'medica', marcacao: { origem: 'juizo', registradaPor, data: '2026-10-20', hora: '10:30', local: 'Local Inventado' } },
  perfil: {
    perito: { nome: 'Perito Inventado', especialidade: 'Área fictícia', onde: 'Local Inventado',
      laudos: [{ caso: 'caso-a', data: '2026-10-08' }, { caso: 'caso-a', data: '2026-10-09' }] },
    jurimetria: { taxa: 50, favoraveis: 1, laudos: 2, diasAteOLaudo: 12 }, observou: [], perguntou: ['Pergunta fictícia do acervo'], pediu: [],
  },
})
afterEach(() => vi.unstubAllGlobals())
function servir(pe: object = pericia(), status = 200) {
  const fetch = vi.fn(async (url: string) => new Response(JSON.stringify(status === 200 ? url.endsWith('/juizo') ? juizo : pe : { erro: 'Consulta indisponível.' }), { status }))
  vi.stubGlobal('fetch', fetch)
  return fetch
}
describe('Juízo e perícia do servidor', () => {
  it('consulta as rotas reais e abre os números com casos e data da base', async () => {
    const fetch = servir()
    render(<JusticaDoCaso processoId={CASO} veJurimetria />)
    fireEvent.click(await screen.findByRole('button', { name: /Vara Inventada.*2 casos · base de 09\/10/ }))
    expect(screen.getByRole('region', { name: 'Jurimetria do juízo' }).textContent).toContain('50% · 1 de 2 · 2 casos · base de 09/10')
    fireEvent.click(screen.getByRole('button', { name: /Perito Inventado.*1 caso · base de 09\/10/ }))
    expect(screen.getByRole('region', { name: 'Perfil e jurimetria do perito' }).textContent).toContain('Pergunta fictícia do acervo')
    expect(fetch.mock.calls.map(c => c[0])).toEqual([`/api/processos/${CASO}/pericia`, `/api/casos/${CASO}/juizo`])
  })
  it('sem acesso à jurimetria, não consulta a rota antiga que também devolve perfil', async () => {
    const fetch = servir()
    render(<JusticaDoCaso processoId={CASO} veJurimetria={false} />)
    await waitFor(() => expect(fetch).not.toHaveBeenCalled())
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText('Pergunta fictícia do acervo')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(fetch.mock.calls).toHaveLength(0)
  })
  it('não chama de automática a data registrada por uma pessoa', async () => {
    servir(pericia('Pessoa fictícia'))
    render(<JusticaDoCaso processoId={CASO} veJurimetria />)
    await screen.findByRole('button', { name: /Vara Inventada/ })
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('falha da API não vira jurimetria de exemplo', async () => {
    servir({}, 503)
    render(<JusticaDoCaso processoId={CASO} veJurimetria />)
    expect((await screen.findAllByRole('alert')).map(x => x.textContent).join(' ')).toContain('indisponível')
    expect(screen.queryByRole('button')).toBeNull()
    expect(document.body.textContent).not.toContain('%')
  })
})

describe('Origem e base da perícia', () => {
  it('mostra a marcação automática com data e orientação para quem pode consultar a rota', async () => {
    servir()
    render(<JusticaDoCaso processoId={CASO} veJurimetria />)
    const aviso = await screen.findByRole('status')
    expect(aviso.textContent).toContain('O sistema marcou a perícia em 20/10/2026, às 10:30, a partir da publicação')
    expect(aviso.textContent).toContain('chegar 30 minutos antes')
  })
  it('na fase administrativa, consulta só a perícia, sem erro por falta de juízo', async () => {
    const fetch = servir(pericia('Pessoa fictícia'))
    render(<JusticaDoCaso processoId={CASO} veJurimetria judicial={false} />)
    await screen.findByRole('button', { name: /Perito Inventado/ })
    expect(fetch.mock.calls.map(c => c[0])).toEqual([`/api/processos/${CASO}/pericia`])
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('perfil sem laudos não exibe taxa nem data inventada', async () => {
    const pe = pericia()
    pe.perfil.perito.laudos = []
    servir(pe)
    render(<JusticaDoCaso processoId={CASO} veJurimetria />)
    fireEvent.click(await screen.findByRole('button', { name: /Perito Inventado.*0 casos · base ainda indisponível/ }))
    expect(screen.getByRole('region', { name: 'Perfil e jurimetria do perito' }).textContent).toContain('Nenhum laudo no acervo')
    expect(screen.getByRole('region', { name: 'Perfil e jurimetria do perito' }).textContent).not.toContain('%')
  })
})
