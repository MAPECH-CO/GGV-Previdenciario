import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CasoParaLiberacao } from '@ggv/contratos'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { AjustarCaso } from './AjustarCaso.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const PESSOA = '7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
const devolvido: CasoParaLiberacao = {
  casoId: CASO,
  pessoaId: PESSOA,
  cliente: 'Benedito Alves (exemplo)',
  beneficio: 'bpc_loas_deficiente',
  checklist: { cadastrado: true, completo: true, faltam: [] },
  kitAssinado: true,
  travaDoParecer: null,
  esperandoConferencia: false,
  ajuste: { motivo: 'Falta a procuração assinada', prazo: '2026-10-10', reprovadoPor: 'Helena (exemplo)', reprovadoEm: '2026-10-08T15:00:00.000Z' },
  podeLiberar: true,
}

function servidor(caso: CasoParaLiberacao, liberacao: [number, unknown] = [201, { ok: true }]) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify(liberacao[1]), { status: liberacao[0] }) : new Response(JSON.stringify(caso)),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => vi.unstubAllGlobals())

describe('Ajustar o caso devolvido pela Sênior (GGVP-127)', () => {
  it('GGVP-162 CA5 · para corrigir, o Atendimento vai à ficha do cliente; quem abre o processo, à página dele', async () => {
    servidor(devolvido)
    entrarComo('atendimento')
    render(comSessao(<AjustarCaso casoId={CASO} />))
    expect((await screen.findByRole('link', { name: 'ficha do cliente' })).getAttribute('href')).toBe(`/clientes/${PESSOA}`)
    expect(screen.queryByRole('link', { name: 'página do processo' })).toBeNull()
    cleanup()
    entrarComo('senior')
    render(comSessao(<AjustarCaso casoId={CASO} />))
    expect((await screen.findByRole('link', { name: 'página do processo' })).getAttribute('href')).toBe(`/casos/${CASO}`)
    cleanup()
    entrarComo(undefined)
  })

  it('CA1 · mostra o motivo, o prazo e quem devolveu', async () => {
    servidor(devolvido)
    render(<AjustarCaso casoId={CASO} />)
    const pedido = await screen.findByRole('region', { name: 'O que a Sênior pediu' })
    expect(pedido.textContent).toContain('Falta a procuração assinada')
    expect(pedido.textContent).toContain('Prazo do ajuste: 10/10/2026')
    expect(pedido.textContent).toContain('Devolvido por Helena (exemplo)')
    // GGVP-120 CA11: o benefício pelo nome do catálogo, não pelo código.
    expect(screen.getByText('Benedito Alves (exemplo) · BPC/LOAS Deficiente')).toBeTruthy()
  })

  it('CA2 · liberar de novo pede as duas conferências e manda ao servidor; a tela confirma a volta à fila da Sênior', async () => {
    const fetch = servidor(devolvido)
    render(<AjustarCaso casoId={CASO} />)
    const botao = (await screen.findByRole('button', { name: 'Liberar de novo' })) as HTMLButtonElement
    expect(botao.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi o checklist' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Conferi as assinaturas/ }))
    fireEvent.click(botao)
    expect(await screen.findByRole('status')).toHaveProperty('textContent', '✓ Liberado de novo. O caso voltou para a fila da Sênior, que confere outra vez, sem o OK anterior.')
    const [url, init] = fetch.mock.calls.at(-1)!
    expect([url, init?.method, JSON.parse(String(init?.body))]).toEqual([`/api/casos/${CASO}/liberacao`, 'POST', { conferiChecklist: true, conferiAssinaturas: true }])
  })

  it('CA4 · com o checklist ou o parecer travando, não libera e diz o que falta; a recusa do servidor aparece', async () => {
    servidor({ ...devolvido, checklist: { cadastrado: true, completo: false, faltam: ['cnis'] } }, [409, { erro: 'Checklist incompleto (G1): faltam cnis.' }])
    render(<AjustarCaso casoId={CASO} />)
    expect(await screen.findByText('Faltam: cnis')).toBeTruthy()
    expect(screen.getByText('Checklist incompleto (G1): faltam cnis.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Liberar de novo' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('quem não é do setor do ajuste vê só para leitura', async () => {
    servidor({ ...devolvido, podeLiberar: false })
    render(<AjustarCaso casoId={CASO} />)
    expect(await screen.findByText('Só leitura: quem ajusta e libera de novo é o Atendimento')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Liberar de novo' })).toBeNull()
  })
})
