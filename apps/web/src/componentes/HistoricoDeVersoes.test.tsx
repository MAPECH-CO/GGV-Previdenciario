import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { abrirConversa, conferirConversa, finalizarConversa, gravarConversa, transcreverConversa } from '../dados/conversa.ts'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { HistoricoDeVersoes } from './HistoricoDeVersoes.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 14, 32), latencia: 0 })
  zerarExemplo()
  window.localStorage.clear()
  entrarComo()
})

async function conversaConferida() {
  const c = await abrirConversa('maria-exemplo', { canal: 'presencial', comQuem: 'cliente', modo: 'tempo-real' })
  await gravarConversa(c.id, { avisei: true })
  await finalizarConversa(c.id, { aos: 116 })
  const { conversa } = await transcreverConversa(c.id)
  const doAtendimento = conversa.analise!.mudancas.filter((m) => m.campo !== 'fato')
  await conferirConversa(c.id, { decisoes: doAtendimento.map((m) => ({ id: m.id, decisao: 'confirmada' as const })), pendencia: { surgiu: false } })
  // O fato novo, quem confirma é o Jurídico: a advogada na sessão.
  entrarComo('advogada')
  await conferirConversa(c.id, { decisoes: [{ id: conversa.analise!.mudancas.find((m) => m.campo === 'fato')!.id, decisao: 'confirmada' }] })
  entrarComo()
}

describe('Histórico do processo · versões dos campos (GGVP-84, CA2)', () => {
  it('cada versão com quem e quando, da mais recente à mais antiga; sem "Voltar" para quem não é Sênior', async () => {
    await conversaConferida()
    render(comSessao(<HistoricoDeVersoes ficha={(await obterFicha('maria-exemplo'))!} aoFechar={() => {}} />))
    const endereco = await screen.findByRole('region', { name: 'Ficha · endereço' })
    expect(within(endereco).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '07/10/2026 14:32 · Ana (exemplo) · em vigorRua Exemplo das Acácias, 45',
      '07/10/2026 14:32 · Valor de antes da conversa—',
    ])
    expect(screen.getByRole('region', { name: 'Processo · data da perícia do INSS' }).textContent).toContain('16/10/2026')
    expect(screen.getByRole('region', { name: 'Processo · fato novo' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Voltar/ })).toBeNull()
    expect(screen.getByText(/a Sênior pode voltar a versão/)).toBeTruthy()
  })

  it('a Sênior volta o telefone para a versão de antes; a volta vira versão nova e a ficha muda', async () => {
    await conversaConferida()
    entrarComo('senior')
    render(comSessao(<HistoricoDeVersoes ficha={(await obterFicha('maria-exemplo'))!} aoFechar={() => {}} />))
    const telefone = await screen.findByRole('region', { name: 'Ficha · telefone de contato' })
    // Fato novo e documento citado somam ao caso: sem "Voltar".
    expect(within(screen.getByRole('region', { name: 'Processo · documento citado' })).queryByRole('button')).toBeNull()
    fireEvent.click(within(telefone).getByRole('button', { name: 'Voltar telefone de contato para a versão de 07/10/2026 14:32' }))
    await within(telefone).findByText('07/10/2026 14:32 · Dra. Renata (exemplo) · em vigor')
    expect(within(telefone).getAllByRole('listitem')).toHaveLength(3)
    expect((await obterFicha('maria-exemplo'))!.telefone).toBe('11900000004')
  })

  it('GGVP-138 · a API recusa: a janela diz por quê, sem erro solto', async () => {
    const ficha = (await obterFicha('maria-exemplo'))!
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ erro: 'Ficha não encontrada.' }), { status: 404 })))
    render(comSessao(<HistoricoDeVersoes ficha={ficha} aoFechar={() => {}} />))
    expect((await screen.findByRole('alert')).textContent).toBe('Ficha não encontrada.')
    vi.unstubAllGlobals()
  })
})
