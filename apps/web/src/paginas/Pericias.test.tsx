import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { Pericias } from './Pericias.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const DO_JUIZ = '11111111-1111-4111-8111-111111111111'
const DO_INSS = '22222222-2222-4222-8222-222222222222'
const CHAMADA = '33333333-3333-4333-8333-333333333333'
const base = {
  casoId: CASO,
  cliente: 'Sebastião Cruz (exemplo)',
  pericias: [
    { id: DO_JUIZ, tipo: 'medica', judicial: true, origem: 'determinada pelo juiz', resultado: null, aprovada: null },
    { id: DO_INSS, tipo: 'social', judicial: false, origem: 'pedida no INSS', resultado: null, aprovada: null },
  ],
  podeAprovar: true,
}
const recomendacao = (judicial: boolean) => ({
  sugestao: { chamadaId: CHAMADA, sugestao: true, texto: '{}', fontes: [], modelo: 'gpt-4.1-mini', geradaEm: '2026-10-08T03:00:00.000Z', alerta: null },
  recomendacao: {
    oQueLevar: ['Relatório do médico assistente', 'Receitas dos últimos 6 meses'],
    pontosFortes: ['Parecer suficiente'],
    pontosFracos: ['Falta exame de imagem'],
    quesitos: judicial ? ['O autor consegue ficar em pé por uma hora?', 'A limitação é permanente?'] : [],
    assistenteTecnico: judicial ? { indicar: true, porque: 'Laudos conflitantes.' } : null,
  },
  motivo: null,
})

const CHANCE = { casos: 4, favoraveis: 3, porcentagem: 75, baseEm: '2026-10-07T15:00:00.000Z', regra: 'mesmo benefício', cor: 'verde', sugereNaoPegar: false, faltaSaber: ['o perito'], fatores: null, motivoIa: null }

function servidor(get: object) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).endsWith(`/casos/${CASO}/chance`)) return new Response(JSON.stringify(CHANCE))
    if (String(url).endsWith(`/pericias/${DO_JUIZ}/recomendacao/sugestao`)) return new Response(JSON.stringify(recomendacao(true)))
    if (String(url).endsWith(`/pericias/${DO_INSS}/recomendacao/sugestao`)) return new Response(JSON.stringify(recomendacao(false)))
    return init?.method === 'POST' ? new Response(JSON.stringify({ ok: true }), { status: 201 }) : new Response(JSON.stringify(get))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => {
  vi.unstubAllGlobals()
  entrarComo()
})

describe('Perícias do caso (GGVP-38)', () => {
  it('GGVP-151 CA2 · com a recomendação aberta, a advogada vê a chance do caso, com os casos e a data da base; com tudo decidido, não', async () => {
    entrarComo('advogada')
    servidor(base)
    const { unmount } = render(comSessao(<Pericias casoId={CASO} />))
    expect(await screen.findByText('75% · 3 de 4 casos · base de 07/10')).toBeTruthy()
    unmount()
    const decididas = { ...base, pericias: base.pericias.map((p) => ({ ...p, resultado: 'favoravel' })) }
    const fetch = servidor(decididas)
    render(comSessao(<Pericias casoId={CASO} />))
    await screen.findAllByText('Resultado: favorável.')
    expect(screen.queryByRole('region', { name: 'Chance de êxito' })).toBeNull()
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/chance'))).toBe(false)
  })

  it('ao abrir, a recomendação de cada perícia já está no formulário; a do juiz traz quesitos e assistente técnico; a advogada edita e aprova', async () => {
    const fetch = servidor(base)
    render(<Pericias casoId={CASO} />)
    const juiz = await screen.findByRole('form', { name: 'Recomendação: Perícia médica' })
    await within(juiz).findByText('Recomendação da IA · confira, mude o que quiser e aprove')
    expect((within(juiz).getByLabelText('O que levar (um por linha)') as HTMLTextAreaElement).value).toBe('Relatório do médico assistente\nReceitas dos últimos 6 meses')
    expect((within(juiz).getByLabelText('Quesitos ao perito (um por linha; apague o que não quiser)') as HTMLTextAreaElement).value).toContain('A limitação é permanente?')
    expect((within(juiz).getByLabelText('Sim') as HTMLInputElement).checked).toBe(true)
    const inss = screen.getByRole('form', { name: 'Recomendação: Avaliação social' })
    await within(inss).findByText(/Pontos fortes/)
    expect(within(inss).queryByLabelText(/Quesitos/)).toBeNull()

    fireEvent.change(within(juiz).getByLabelText('Quesitos ao perito (um por linha; apague o que não quiser)'), { target: { value: 'A limitação é permanente?' } })
    fireEvent.click(within(juiz).getByLabelText('Não'))
    fireEvent.click(within(juiz).getByRole('button', { name: 'Aprovar a recomendação' }))
    expect((await screen.findByRole('status')).textContent).toBe('Recomendação aprovada: perícia médica.')
    const post = fetch.mock.calls.find(([url, init]) => init?.method === 'POST' && String(url).endsWith(`/pericias/${DO_JUIZ}/recomendacao`))!
    expect(JSON.parse(post[1]!.body as string)).toEqual({
      oQueLevar: ['Relatório do médico assistente', 'Receitas dos últimos 6 meses'],
      quesitos: ['A limitação é permanente?'],
      assistenteTecnico: false,
      chamadaIaId: CHAMADA,
    })
  })

  it('sem nada em "O que levar", não envia; quem não aprova vê sem o botão; a aprovada aparece para leitura', async () => {
    const fetch = servidor({ ...base, pericias: [base.pericias[1]] })
    const { unmount } = render(<Pericias casoId={CASO} />)
    const inss = await screen.findByRole('form', { name: 'Recomendação: Avaliação social' })
    await within(inss).findByText(/Pontos fortes/)
    fireEvent.change(within(inss).getByLabelText('O que levar (um por linha)'), { target: { value: '  ' } })
    fireEvent.click(within(inss).getByRole('button', { name: 'Aprovar a recomendação' }))
    expect((await within(inss).findByRole('alert')).textContent).toBe('Deixe ao menos um item em "O que levar"')
    expect(fetch.mock.calls.filter(([url, init]) => init?.method === 'POST' && String(url).endsWith('/recomendacao'))).toEqual([])
    unmount()
    servidor({
      ...base,
      podeAprovar: false,
      pericias: [{ ...base.pericias[0], aprovada: { oQueLevar: ['Relatório do médico assistente'], quesitos: ['A limitação é permanente?'], assistenteTecnico: false, por: 'Gabi', em: '2026-10-08T03:00:00.000Z' } }],
    })
    render(<Pericias casoId={CASO} />)
    expect(await screen.findByText('Recomendação aprovada por Gabi em 08/10/2026.')).toBeTruthy()
    expect(screen.getByText('A limitação é permanente?')).toBeTruthy()
    expect(screen.getByText('Assistente técnico: não indicar.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Aprovar a recomendação' })).toBeNull()
  })
})
