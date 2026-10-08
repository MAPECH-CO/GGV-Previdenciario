import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RelatorioDaImportacao } from '@ggv/contratos'
import { Importar } from './Importar.tsx'

// Planilha inventada: nenhum dado real.
const PLANILHA = 'nome;cpf;beneficio\nAna Teste;11144477735;bpc_loas_idoso\nD4vi;123;'
const CONFERIDO = 'a'.repeat(64)
const RELATORIO: RelatorioDaImportacao = {
  conferido: CONFERIDO,
  clientes: { novos: 1, jaCadastrados: 0 },
  processos: { novos: 1, jaCadastrados: 0 },
  linhas: [{ linha: 2, nome: 'Ana Teste', cliente: 'novo', processo: 'novo', beneficio: 'bpc_loas_idoso', fase: 'administrativa' }],
  erros: [{ linha: 3, motivo: 'nome inválido; CPF inválido.' }],
  colunasIgnoradas: [],
}

function servidor(relatorio: RelatorioDaImportacao = RELATORIO) {
  const fetch = vi.fn(async (url: string, _init?: RequestInit) =>
    url === '/api/importacao/simulacao'
      ? new Response(JSON.stringify(relatorio), { status: 200 })
      : new Response(JSON.stringify({ clientes: { novos: 1, jaCadastrados: 0 }, processos: { novos: 1, jaCadastrados: 0 }, linhasComErro: 1 }), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const pedidos = (fetch: ReturnType<typeof servidor>) => fetch.mock.calls.map(([url, init]) => [url, JSON.parse(String(init?.body))])
const escolher = (conteudo: BlobPart) => fireEvent.change(screen.getByLabelText('Planilha (CSV)'), { target: { files: [new File([conteudo], 'clientes.csv', { type: 'text/csv' })] } })
afterEach(() => vi.unstubAllGlobals())

describe('GGVP-146 parte 2 · importar a planilha do escritório', () => {
  it('simula e mostra o relatório; só grava depois de conferir, com a marca do relatório', async () => {
    const fetch = servidor()
    render(<Importar />)
    const simular = screen.getByRole('button', { name: 'Simular a importação' })
    expect(simular).toHaveProperty('disabled', true)
    escolher(PLANILHA)
    await waitFor(() => expect(simular).toHaveProperty('disabled', false))
    fireEvent.click(simular)

    const relatorio = await screen.findByRole('region', { name: 'Relatório da simulação · clientes.csv' })
    expect(relatorio.textContent).toContain('Clientes: 1 novo · 0 já cadastrados (pelo CPF, não duplicam)')
    expect(within(relatorio).getByRole('list', { name: 'Linhas com erro' }).textContent).toBe('Linha 3: nome inválido; CPF inválido.')
    expect(within(relatorio).getByRole('list', { name: 'O que cada linha vira' }).textContent).toBe(
      'Linha 2 · Ana Teste · cliente novo · processo novo: BPC/LOAS Idoso, administrativa',
    )
    expect(pedidos(fetch)).toEqual([['/api/importacao/simulacao', { arquivo: PLANILHA }]])

    const gravar = within(relatorio).getByRole('button', { name: 'Gravar no portal' })
    expect(gravar).toHaveProperty('disabled', true)
    fireEvent.click(within(relatorio).getByRole('checkbox', { name: 'Conferi o relatório: gravar 1 cliente novo e 1 processo novo; a linha com erro fica de fora' }))
    fireEvent.click(gravar)
    expect((await screen.findByRole('status')).textContent).toBe('✓ Gravados: 1 cliente novo e 1 processo novo. A linha com erro ficou de fora.')
    expect(pedidos(fetch)[1]).toEqual(['/api/importacao', { arquivo: PLANILHA, conferido: CONFERIDO, confirmo: true }])
  })

  it('a planilha do Excel em português (Windows-1252) chega com os acentos', async () => {
    const fetch = servidor()
    render(<Importar />)
    // "José" em Windows-1252: o "é" é o byte 0xE9.
    escolher(new Uint8Array([...new TextEncoder().encode('nome;cpf\nJos'), 0xe9, ...new TextEncoder().encode(' Teste;11144477735')]))
    const simular = screen.getByRole('button', { name: 'Simular a importação' })
    await waitFor(() => expect(simular).toHaveProperty('disabled', false))
    fireEvent.click(simular)
    await screen.findByRole('region', { name: /Relatório da simulação/ })
    expect(pedidos(fetch)[0][1].arquivo).toBe('nome;cpf\nJosé Teste;11144477735')
  })

  it('sem nada novo, não oferece gravar', async () => {
    servidor({ ...RELATORIO, clientes: { novos: 0, jaCadastrados: 1 }, processos: { novos: 0, jaCadastrados: 1 }, erros: [] })
    render(<Importar />)
    escolher(PLANILHA)
    const simular = screen.getByRole('button', { name: 'Simular a importação' })
    await waitFor(() => expect(simular).toHaveProperty('disabled', false))
    fireEvent.click(simular)
    const relatorio = await screen.findByRole('region', { name: /Relatório da simulação/ })
    expect(relatorio.textContent).toContain('Nada a gravar: nenhum cliente ou processo novo.')
    expect(within(relatorio).queryByRole('button', { name: 'Gravar no portal' })).toBeNull()
  })
})
