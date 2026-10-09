import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ConferenciaDoAcervo } from '@ggv/contratos'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConferirAcervo } from './ConferirAcervo.tsx'

const A = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const B = '7a2d3b9f-4c5e-4d6f-9a71-829304b5c6d7'
const lote: ConferenciaDoAcervo = {
  pendentes: [
    { id: A, numeroCnj: '00045123320194036301', beneficio: 'bpc_loas_deficiente', desfechoLido: 'improcedente', fonte: 'lote', ficha: null },
    { id: B, numeroCnj: '00077819020204036301', beneficio: null, desfechoLido: 'procedente_parcial', fonte: 'lote', ficha: null },
  ],
  conferidos: 3,
}

/** GET devolve o lote; cada POST devolve o lote sem o processo conferido. */
function servidor(inicial: ConferenciaDoAcervo) {
  let atual = inicial
  const chamada = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const id = url.split('/')[4]
      atual = { pendentes: atual.pendentes.filter((p) => p.id !== id), conferidos: atual.conferidos + 1 }
    }
    return new Response(JSON.stringify(atual), { status: 200 })
  })
  vi.stubGlobal('fetch', chamada)
  return chamada
}
const corpoDoPost = (chamada: ReturnType<typeof servidor>) => {
  const post = chamada.mock.calls.find(([, init]) => init?.method === 'POST')
  return post ? [post[0], JSON.parse(String(post[1]?.body))] : null
}
const processo = async (numero: string) =>
  within(await screen.findByRole('list', { name: 'Desfechos para conferir' }))
    .getAllByRole('listitem')
    .find((li) => li.textContent?.includes(numero))!
afterEach(() => vi.unstubAllGlobals())

describe('Conferir desfechos do lote (GGVP-55)', () => {
  it('CA7 · cada processo com o desfecho lido; "Confere" manda o mesmo desfecho, e a lista volta do servidor', async () => {
    const chamada = servidor(lote)
    render(<ConferirAcervo />)
    const primeiro = await processo('0004512-33.2019.4.03.6301')
    expect(primeiro.textContent).toContain('BPC/LOAS Deficiente')
    expect(primeiro.textContent).toContain('Desfecho lido: Improcedente')
    fireEvent.click(within(primeiro).getByRole('button', { name: 'Confere' }))
    expect((await screen.findByRole('status')).textContent).toBe('Desfecho conferido.')
    expect(corpoDoPost(chamada)).toEqual([`/api/acervo/processos/${A}/conferencia`, { desfecho: 'improcedente' }])
    expect(screen.getByText(/Esperando conferência: 1 · Já conferidos: 4/)).toBeTruthy()
  })

  it('CA7 · "Corrigir" pede o desfecho correto pela lista; sem escolher, a mensagem do contrato e nada vai ao servidor', async () => {
    const chamada = servidor(lote)
    render(<ConferirAcervo />)
    const segundo = await processo('0007781-90.2020.4.03.6301')
    fireEvent.click(within(segundo).getByRole('button', { name: 'Corrigir' }))
    fireEvent.click(within(segundo).getByRole('button', { name: 'Salvar a correção' }))
    expect(within(segundo).getByRole('alert').textContent).toBe('Escolha o desfecho')
    expect(corpoDoPost(chamada)).toBeNull()
    fireEvent.change(within(segundo).getByLabelText('Desfecho correto'), { target: { value: 'acordo' } })
    fireEvent.click(within(segundo).getByRole('button', { name: 'Salvar a correção' }))
    expect((await screen.findByRole('status')).textContent).toBe('Desfecho corrigido para Acordo.')
    expect(corpoDoPost(chamada)).toEqual([`/api/acervo/processos/${B}/conferencia`, { desfecho: 'acordo' }])
  })

  it('sem processo esperando, diz que não há nenhum', async () => {
    servidor({ pendentes: [], conferidos: 3 })
    render(<ConferirAcervo />)
    expect(await screen.findByText('Nenhum desfecho esperando conferência.')).toBeTruthy()
  })
})

describe('GGVP-41 · a ficha e a tese do desfecho do portal', () => {
  const C = '8b3e4c0a-5d6f-4e70-8b82-930415c6d7e8'
  const D = '9c4f5d1b-6e70-4f81-9c93-a41526d7e8f9'
  const FICHA = { materia: 'BPC/LOAS da pessoa com deficiência', vara: null, tese: 'Impedimento de longo prazo com renda acima de 1/4', resumo: 'O juiz concedeu pela perícia.', licao: 'Juntar o estudo social.' }
  const comPortal: ConferenciaDoAcervo = {
    pendentes: [
      { id: C, numeroCnj: null, beneficio: 'bpc_loas_deficiente', desfechoLido: 'procedente_parcial', fonte: 'portal', ficha: FICHA },
      { id: D, numeroCnj: null, beneficio: 'aposentadoria_pcd', desfechoLido: 'deferido', fonte: 'portal', ficha: null },
    ],
    conferidos: 3,
  }

  it('CA7 · a ficha da IA aparece; a Sênior corrige a tese e confere, e a tese vai junto', async () => {
    const chamada = servidor(comPortal)
    render(<ConferirAcervo />)
    const portal = await processo('Procedente em parte')
    expect(portal.textContent).toContain('Processo do portal')
    const ficha = within(portal).getByLabelText('Ficha do desfecho').textContent
    for (const t of [FICHA.materia, 'não identificada', FICHA.resumo, FICHA.licao]) expect(ficha).toContain(t)
    const tese = within(portal).getByLabelText('Tese') as HTMLInputElement
    expect(tese.value).toBe(FICHA.tese)
    fireEvent.change(tese, { target: { value: 'Renda per capita com gastos' } })
    fireEvent.click(within(portal).getByRole('button', { name: 'Confere' }))
    expect((await screen.findByRole('status')).textContent).toBe('Desfecho conferido.')
    expect(corpoDoPost(chamada)).toEqual([`/api/acervo/processos/${C}/conferencia`, { desfecho: 'procedente_parcial', tese: 'Renda per capita com gastos' }])
  })

  it('CA11 · sem a ficha, diz que a IA ainda não leu e deixa conferir; o ganho no INSS aparece como "Deferido no INSS"', async () => {
    const chamada = servidor(comPortal)
    render(<ConferirAcervo />)
    const semFicha = await processo('Deferido no INSS')
    expect(semFicha.textContent).toContain('A IA ainda não leu este desfecho')
    expect(within(semFicha).queryByLabelText('Ficha do desfecho')).toBeNull()
    fireEvent.click(within(semFicha).getByRole('button', { name: 'Confere' }))
    await screen.findByRole('status')
    expect(corpoDoPost(chamada)).toEqual([`/api/acervo/processos/${D}/conferencia`, { desfecho: 'deferido', tese: '' }])
  })
})
