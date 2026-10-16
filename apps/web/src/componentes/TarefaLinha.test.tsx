import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Tarefa } from '../dados/tipos.ts'
import { TarefaLinha } from './TarefaLinha.tsx'

const tarefa: Tarefa = {
  id: 't1',
  codigo: 'DP.03',
  cliente: { id: 'maria', nome: 'Maria das Graças Oliveira' },
  acao: 'Cobrar documento',
  detalhe: 'Auxílio por incapacidade temporária · perícia 02/10',
  prazo: 'vence hoje',
  urgente: true,
  href: '/casos/maria-1/cobranca',
}

const desenhar = (t: Tarefa) =>
  render(
    <ul>
      <TarefaLinha tarefa={t} />
    </ul>,
  )

describe('TarefaLinha', () => {
  it('mostra cliente, ação, detalhe e prazo; o código do passo do BPMN não aparece (11/10)', () => {
    desenhar(tarefa)
    expect(screen.queryByText('DP.03')).toBeNull()
    expect(screen.getByText('Maria das Graças Oliveira')).toBeTruthy()
    expect(screen.getByText(/Cobrar documento/)).toBeTruthy()
    expect(screen.getByText('Auxílio por incapacidade temporária · perícia 02/10')).toBeTruthy()
    expect(screen.getByText(/vence hoje/)).toBeTruthy()
  })

  it('a linha abre o passo e o nome abre a ficha, em links separados', () => {
    const { container } = desenhar(tarefa)
    const passo = screen.getByRole('link', { name: 'Maria das Graças Oliveira · Cobrar documento' })
    const ficha = screen.getByRole('link', { name: 'Maria das Graças Oliveira' })
    expect(passo.getAttribute('href')).toBe('/casos/maria-1/cobranca')
    expect(ficha.getAttribute('href')).toBe('/clientes/maria')
    expect(passo.contains(ficha)).toBe(false)
    expect(container.querySelector('a a')).toBeNull()
  })

  it('CA4 (Pedro, 14/10) · sem tela própria, a linha abre a ficha; sem cliente, não é link; nunca a "tela não construída"', () => {
    const { unmount } = desenhar({ ...tarefa, href: undefined })
    expect(screen.getByRole('link', { name: 'Maria das Graças Oliveira · Cobrar documento' }).getAttribute('href')).toBe('/clientes/maria')
    unmount()
    desenhar({ ...tarefa, href: undefined, cliente: null, contexto: 'Vigília das publicações' })
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText(/Cobrar documento/)).toBeTruthy()
  })

  it('tarefa urgente avisa o leitor de tela; a comum não', () => {
    const { unmount } = desenhar(tarefa)
    expect(screen.getByText('Urgente:', { exact: false })).toBeTruthy()
    unmount()
    desenhar({ ...tarefa, urgente: false })
    expect(screen.queryByText('Urgente:', { exact: false })).toBeNull()
  })

  it('tarefa sem cliente usa o contexto e não cria link de ficha', () => {
    desenhar({ ...tarefa, cliente: null, contexto: 'Balcão', acao: 'Receber quem chegou' })
    expect(screen.getByText('Balcão')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Balcão' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Balcão · Receber quem chegou' })).toBeTruthy()
  })

  it('sem prazo, não desenha o prazo', () => {
    desenhar({ ...tarefa, prazo: undefined, urgente: false })
    expect(screen.queryByText(/vence hoje/)).toBeNull()
  })

  describe('o balão da tarefa (Pedro, 16/10)', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
      Reflect.deleteProperty(window, 'matchMedia')
    })

    it('o "i" da linha, com o mouse ou o foco, abre o balão com o resumo da IA da tarefa', async () => {
      Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: () => ({ matches: true }) })
      const resumo = 'A cliente ainda não mandou o laudo. Ligue hoje e peça a foto do documento.'
      const fetch = vi.fn(async () => new Response(JSON.stringify({ sugestao: { texto: resumo }, motivo: null }), { status: 200 }))
      vi.stubGlobal('fetch', fetch)
      desenhar({ ...tarefa, processoId: '3c02ce6b-e09a-4205-a371-ad87a62394dc' })
      act(() => screen.getByRole('button', { name: 'Resumo da tarefa' }).focus())
      const balao = screen.getByRole('tooltip', { name: 'Maria das Graças Oliveira · Cobrar documento' })
      expect(await screen.findByText(resumo)).toBeTruthy()
      expect(balao.textContent).toContain('Resumo da IA')
      const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
      expect(url).toBe('/api/tarefas/resumo')
      expect(JSON.parse(String(init.body))).toMatchObject({ acao: 'Cobrar documento', prazo: 'vence hoje', urgente: true, casoId: '3c02ce6b-e09a-4205-a371-ad87a62394dc' })
    })

    it('sem o resumo da IA, o balão diz e manda abrir a tarefa', async () => {
      Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: () => ({ matches: true }) })
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ sugestao: null, motivo: 'A IA não resumiu agora.' }), { status: 200 })))
      desenhar({ ...tarefa, acao: 'Conferir contrato' })
      act(() => screen.getByRole('button', { name: 'Resumo da tarefa' }).focus())
      expect(await screen.findByText(/A IA não resumiu agora. Abra a tarefa/)).toBeTruthy()
    })
  })
})
