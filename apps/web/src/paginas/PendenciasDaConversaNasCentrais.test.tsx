import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SessaoContexto } from '../sessao.ts'
import { CentralAtendimento } from './CentralAtendimento.tsx'
import { CentralAdvogada } from './CentralAdvogada.tsx'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it.each(['atendimento', 'documentacao', 'advogada'])('mostra a pendência retornada pela API para %s', async perfil => {
  configurarExemplo({ latencia: 0 }); zerarExemplo()
  const tarefa = { id: 'pendencia-inventada-' + perfil, codigo: 'D5.05', cliente: { id: 'pessoa-inventada', nome: 'Pessoa Inventada da Conversa' }, acao: 'Cumprir pendência', detalhe: 'Combinado fictício do teste', prazo: 'vence 30/10', href: '/conversas/inventada/conferir' }
  const fetch = vi.fn(async (url: string) => new Response(JSON.stringify(String(url) === '/api/conversas/tarefas' ? [tarefa] : [])))
  vi.stubGlobal('fetch', fetch)
  render(<SessaoContexto value={{ nome: 'Responsável Fictício', email: 'responsavel@example.test', perfis: [perfil], perfilAtivo: perfil, trocarSenha: false }}>{perfil === 'advogada' ? <CentralAdvogada /> : <CentralAtendimento />}</SessaoContexto>)
  const link = await screen.findByRole('link', { name: 'Pessoa Inventada da Conversa · Cumprir pendência' })
  expect(link.getAttribute('href')).toBe('/conversas/inventada/conferir')
  expect(link.closest('li')?.textContent).toContain('vence 30/10')
  expect(fetch.mock.calls.some(([url]) => url === '/api/conversas/tarefas')).toBe(true)
})
