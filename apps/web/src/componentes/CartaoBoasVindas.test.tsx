import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { conferirChecklist } from '../dados/checklist.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { ConferirChecklist } from '../paginas/ConferirChecklist.tsx'
import { CartaoBoasVindas } from './CartaoBoasVindas.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function abrir(processoId: string) {
  render(<ConferirChecklist processoId={processoId} />)
  await screen.findByRole('heading', { level: 1, name: /Conferir checklist/ })
  return within(await screen.findByRole('region', { name: 'Boas-vindas (D1.22)' }))
}

const enviar = (bloco: ReturnType<typeof within>) => bloco.getByRole('button', { name: /pelo Chatwoot/ }) as HTMLButtonElement

describe('Boas-vindas · na tela do checklist', () => {
  it('CA1 · cliente novo: as boas-vindas esperam a conferência e, conferido o checklist, vêm com as pendências', async () => {
    let bloco = await abrir('rita-exemplo-1')
    expect(screen.getByText('cliente novo · boas-vindas')).toBeTruthy()
    expect(bloco.getByText('Depois de concluir a conferência do checklist, com as pendências dele.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Gerar cobrança das pendências' }))
    await screen.findByRole('heading', { name: '✓ Conferido às 14:32' })
    bloco = within(screen.getByRole('region', { name: 'Boas-vindas (D1.22)' }))
    expect(await bloco.findByText(/mensagem padrão \+ cópias do kit \+ pendências: Documento pessoal \(RG\)/)).toBeTruthy()
    expect((bloco.getByRole('textbox', { name: 'Mensagem (confira antes de enviar)' }) as HTMLTextAreaElement).value).toContain('Olá, Rita!')
  })

  it('CA2 e CA4 · só envia depois de "Conferi a mensagem"; enviada, fica no histórico e não envia de novo', async () => {
    await conferirChecklist('rita-exemplo-1')
    const bloco = await abrir('rita-exemplo-1')
    await bloco.findByRole('textbox', { name: 'Mensagem (confira antes de enviar)' })
    expect(enviar(bloco).disabled).toBe(true)
    fireEvent.click(bloco.getByRole('checkbox', { name: 'Conferi a mensagem' }))
    fireEvent.click(enviar(bloco))
    expect(await bloco.findByText('hoje às 14:32 · Chatwoot')).toBeTruthy()
    expect(bloco.getByText('ok')).toBeTruthy()
    expect(bloco.queryByRole('button', { name: /pelo Chatwoot/ })).toBeNull()
    expect((await obterFicha('rita-exemplo'))?.historico.at(-1)?.oQue).toContain('Enviou as boas-vindas pelo Chatwoot')
  })

  it('CA3 · quem já era cliente não recebe, e a tela diz por quê', async () => {
    const bloco = await abrir('cleide-exemplo-2')
    expect(screen.getByText('já era cliente · sem boas-vindas')).toBeTruthy()
    expect(bloco.getByText('Cleide Exemplo já era cliente do escritório: as boas-vindas só vão ao cliente novo.')).toBeTruthy()
  })

  it('CA6 · ficha sem telefone: o envio falha, a tela mostra o motivo e oferece tentar de novo', async () => {
    await conferirChecklist('marta-exemplo-1')
    const bloco = await abrir('marta-exemplo-1')
    await bloco.findByRole('textbox', { name: 'Mensagem (confira antes de enviar)' })
    fireEvent.click(bloco.getByRole('checkbox', { name: 'Conferi a mensagem' }))
    fireEvent.click(enviar(bloco))
    expect(await bloco.findByText(/a ficha não tem telefone, e o Chatwoot não acha a conversa do cliente/)).toBeTruthy()
    expect(bloco.getByText('falhou')).toBeTruthy()
    expect(bloco.getByRole('button', { name: 'Tentar de novo pelo Chatwoot' })).toBeTruthy()
  })
})

describe('Boas-vindas · caso do servidor (GGVP-125, bloco 5c)', () => {
  const ID = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
  const PROC = '8b3e4d5c-6f70-4b81-8c9d-2e3f4a5b6c7d'
  const FICHA = {
    id: ID,
    situacao: 'cliente',
    desde: '10/2026',
    nome: 'Ivone Teste',
    idade: 41,
    telefone: '11900000050',
    senhaGov: { situacao: 'sem-senha' },
    fichaAtendimentoPreenchida: false,
    processos: [{ id: PROC, beneficio: 'loas-idoso', etapa: 'Documentação' }],
    agendamentos: [],
    contatos: [],
    documentos: [],
    arquivos: [],
    transcricoes: 0,
    historico: [],
  }
  afterEach(() => {
    configurarExemplo({ servidor: false })
    vi.unstubAllGlobals()
  })

  it('o portal ainda não manda: a mensagem é para copiar, sem "Conferi"; "Já enviei" marca e mostra que foi mandada por fora', async () => {
    const aEnviar = { situacao: 'a-enviar', mensagem: 'Olá, Ivone! Boas-vindas ao escritório GGV.', copias: [], faltam: ['RG'] }
    const registro = { fichaId: ID, processoId: PROC, quando: new Date(2026, 9, 5, 14, 32).toISOString(), situacao: 'enviada', mensagem: aEnviar.mensagem }
    let enviada = false
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        enviada = true
        return new Response(JSON.stringify({ boasVindas: { ...aEnviar, situacao: 'enviada', registro }, ficha: FICHA }))
      }
      return new Response(JSON.stringify(enviada ? { ...aEnviar, situacao: 'enviada', registro } : aEnviar))
    })
    vi.stubGlobal('fetch', fetch)
    configurarExemplo({ servidor: true })

    render(<CartaoBoasVindas processoId={PROC} nome="Ivone Teste" versao={0} />)
    const bloco = within(await screen.findByRole('region', { name: 'Boas-vindas (D1.22)' }))
    expect(bloco.getByText('A Atendimento manda por fora: o portal ainda não envia')).toBeTruthy()
    expect((bloco.getByRole('textbox', { name: 'Mensagem para copiar' }) as HTMLTextAreaElement).readOnly).toBe(true)
    expect(bloco.queryByRole('checkbox', { name: 'Conferi a mensagem' })).toBeNull()

    fireEvent.click(bloco.getByRole('button', { name: 'Já enviei' }))
    expect(await bloco.findByText('hoje às 14:32 · mandada por fora do portal')).toBeTruthy()
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST').map(([url]) => url)).toEqual([`/api/processos/${PROC}/boas-vindas`])
  })
})
