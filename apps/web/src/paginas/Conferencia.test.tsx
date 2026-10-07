import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CasoParaConferencia } from '@ggv/contratos'
import { Conferencia } from './Conferencia.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const base: CasoParaConferencia = {
  casoId: CASO,
  cliente: 'Antônia Lima (exemplo)',
  beneficio: 'pensao_morte',
  checklist: { cadastrado: false, completo: true, faltam: [] },
  documentos: [{ id: '11111111-1111-4111-8111-111111111111', tipo: 'rg', nome: 'RG e CPF.pdf' }],
  parecer: { resultado: 'suficiente', itens: [{ item: 'Data de início', atendido: true }], justificativaDispensa: null },
  parecerRestrito: false,
  laudoNovoEsperando: false,
  temFicha: true,
  kitAssinado: true,
  podeDecidir: true,
  situacao: 'aguardando',
}

function servidor(caso: CasoParaConferencia, decisao: [number, unknown] = [201, { ok: true }]) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify(decisao[1]), { status: decisao[0] }) : new Response(JSON.stringify(caso)),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => vi.unstubAllGlobals())

describe('Conferência da Sênior (GGVP-23)', () => {
  it('CA1 e CA5 · mostra benefício, documentos e o parecer item a item; aprovar envia e confirma', async () => {
    const fetch = servidor(base)
    render(<Conferencia casoId={CASO} />)
    expect(await screen.findByText('Suficiente')).toBeTruthy()
    expect(screen.getByText('✓ Data de início')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }))
    expect((await screen.findByRole('status')).textContent).toContain('protocolo e a decisão de perícia foram abertos')
    expect(fetch).toHaveBeenLastCalledWith(`/api/casos/${CASO}/conferencia`, expect.objectContaining({ body: JSON.stringify({ decisao: 'aprovar' }) }))
  })

  it('CA4 · sem o perfil Sênior: só leitura, sem Aprovar nem Reprovar', async () => {
    servidor({ ...base, podeDecidir: false })
    render(<Conferencia casoId={CASO} />)
    expect(await screen.findByText(/Só leitura/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Aprovar' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Reprovar/ })).toBeNull()
  })

  it('GGVP-96 CA12 · para quem não vê dado de saúde, o parecer aparece como restrito, não como ausente', async () => {
    servidor({ ...base, parecer: null, parecerRestrito: true, podeDecidir: false })
    render(<Conferencia casoId={CASO} />)
    expect(await screen.findByText('Parecer médico restrito ao Jurídico.')).toBeTruthy()
    expect(screen.queryByText('Sem parecer médico.')).toBeNull()
  })

  it('CA5 · sem parecer, Aprovar fica desligado e a dispensa aparece', async () => {
    servidor({ ...base, parecer: null })
    render(<Conferencia casoId={CASO} />)
    expect(((await screen.findByRole('button', { name: 'Aprovar' })) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Sem parecer médico "Suficiente" ou dispensa justificada (G17).')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Dispensar o parecer' })).toBeTruthy()
  })

  it('CA3 e CA8 · reprovar pede motivo e a resposta do prazo antes de enviar', async () => {
    const fetch = servidor(base)
    render(<Conferencia casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Reprovar, volta ao Atendimento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprovação' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Responda se a tarefa tem prazo')
    fireEvent.click(screen.getByLabelText('Não'))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprovação' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva o que o Atendimento precisa ajustar')
    expect(fetch).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText('O que o Atendimento precisa ajustar'), { target: { value: 'Falta a procuração' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reprovação' }))
    expect((await screen.findByRole('status')).textContent).toContain('voltou para o Atendimento')
  })

  it('G1 · avisa quando o kit do benefício não está cadastrado', async () => {
    servidor(base)
    render(<Conferencia casoId={CASO} />)
    expect(await screen.findByText(/Kit do benefício não cadastrado/)).toBeTruthy()
  })
})
