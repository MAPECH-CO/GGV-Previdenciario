import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { textoDosEstudos } from '../componentes/estudos.ts'
import { Estudos } from './Estudos.tsx'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const estudo = {
  materia: 'BPC idoso, renda per capita',
  vara: '2ª Vara do JEF',
  tese: 'O benefício mínimo do marido não entra na renda.',
  resumo: 'O juiz considerou a renda do filho.',
  motivo: 'Faltou provar que o filho mora em outra casa.',
  aprendizado: 'Juntar o comprovante de residência do filho na inicial.',
  chance: 'maior',
  novoProcesso: true,
  oQueRefazer: 'Novo requerimento com o comprovante.',
}
const lista = {
  estudos: [
    { casoId: A, cliente: 'Rosa Antunes (exemplo)', beneficio: 'bpc_loas_idoso', resultado: 'Improcedente (o juiz negou o pedido)', geradoEm: '2026-10-07T20:00:00.000Z', modelo: 'gpt-4.1-mini', estudo, aRevisar: true, revisao: null },
    {
      casoId: B,
      cliente: 'Paulo Mendes (exemplo)',
      beneficio: 'auxilio_incapacidade_temporaria',
      resultado: 'Improcedente (o juiz negou o pedido)',
      geradoEm: '2026-10-06T20:00:00.000Z',
      modelo: 'gpt-4.1-mini',
      estudo: { ...estudo, chance: 'menor', novoProcesso: false, oQueRefazer: null, motivo: 'O laudo não mostrava incapacidade no período.' },
      aRevisar: false,
      revisao: null,
    },
  ],
  podeRevisar: true,
}

function servidor(get: object) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify({ ok: true }), { status: 201 }) : new Response(JSON.stringify(get)),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Estudos de caso (GGVP-19)', () => {
  it('CA5 · separa por benefício e pela chance que o caso tinha, com motivo e aprendizado; novo processo espera a Sênior, que decide aqui', async () => {
    const fetch = servidor(lista)
    render(<Estudos />)
    const bpc = await screen.findByRole('region', { name: 'BPC/LOAS Idoso' })
    const rosa = within(within(bpc).getByRole('region', { name: 'BPC/LOAS Idoso · Tínhamos mais chance' })).getByRole('article', { name: 'Estudo de Rosa Antunes (exemplo)' })
    expect(within(rosa).getByText(/Faltou provar que o filho mora em outra casa/)).toBeTruthy()
    expect(within(rosa).getByText(/Juntar o comprovante de residência do filho/)).toBeTruthy()
    expect(within(rosa).getByText('A IA indica novo processo · espera a revisão da Sênior')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Auxílio por Incapacidade Temporária · Tínhamos menos chance' })).toBeTruthy()
    fireEvent.click(within(rosa).getByRole('button', { name: 'Vamos entrar com novo processo' }))
    expect((await screen.findByRole('status')).textContent).toContain('vamos entrar com novo processo')
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect([String(post[0]), JSON.parse(post[1]!.body as string)]).toEqual([`/api/casos/${A}/estudo/revisao`, { novoProcesso: true }])
  })

  it('quem não é Sênior vê os estudos, sem decidir; sem estudos, diz que a IA faz um por processo perdido', async () => {
    servidor({ ...lista, podeRevisar: false })
    const { unmount } = render(<Estudos />)
    await screen.findByRole('article', { name: 'Estudo de Rosa Antunes (exemplo)' })
    expect(screen.queryByRole('button', { name: 'Vamos entrar com novo processo' })).toBeNull()
    unmount()
    servidor({ estudos: [], podeRevisar: true })
    render(<Estudos />)
    expect(await screen.findByText('Nenhum estudo ainda: a IA faz um estudo para cada processo perdido.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Baixar os estudos' })).toBeNull()
  })

  it('"Baixar os estudos" gera um arquivo de texto com os estudos, na ordem da tela', async () => {
    servidor(lista)
    const criar = vi.fn((_b: Blob) => 'blob:estudos')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: criar, revokeObjectURL: vi.fn() }))
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<Estudos />)
    fireEvent.click(await screen.findByRole('button', { name: 'Baixar os estudos' }))
    expect(clique).toHaveBeenCalled()
    const texto = await criar.mock.calls[0][0].text()
    expect(texto).toBe(textoDosEstudos(lista.estudos as never))
    for (const trecho of ['== BPC/LOAS Idoso ==', '-- Tínhamos mais chance --', 'Aprendizado: Juntar o comprovante', 'Novo processo: sim. O que refazer: Novo requerimento', '-- Tínhamos menos chance --'])
      expect(texto).toContain(trecho)
  })
})
