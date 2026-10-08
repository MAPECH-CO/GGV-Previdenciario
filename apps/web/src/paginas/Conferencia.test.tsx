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
  travaDoParecer: null,
  dispensa: null,
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
  it('GGVP-131 · "Ver a chance de êxito" mostra o número com os casos e a base, e os fatores como sugestão; sem casos, sem número', async () => {
    const chance = { casos: 4, favoraveis: 3, porcentagem: 75, baseEm: '2026-10-07T15:00:00.000Z', regra: 'mesmo benefício', motivoIa: null, fatores: { chamadaId: '66666666-6666-4666-8666-666666666666', sugestao: true, texto: 'Para subir: trazer o relatório do médico assistente.', fontes: [], modelo: 'gpt-4.1-mini', geradaEm: '2026-10-07T20:00:00.000Z', alerta: null } }
    servidor(base, [200, chance])
    const { unmount } = render(<Conferencia casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ver a chance de êxito' }))
    expect((await screen.findByText(/75% em 4 casos parecidos/)).textContent).toBe('75% em 4 casos parecidos · base de 07/10/2026')
    expect(screen.getByText('Fatores sugeridos pela IA · confira')).toBeTruthy()
    expect(screen.getByText('Para subir: trazer o relatório do médico assistente.')).toBeTruthy()
    unmount()
    servidor(base, [200, { ...chance, casos: 0, favoraveis: 0, porcentagem: null, baseEm: null, fatores: null, motivoIa: 'A IA não respondeu agora: os fatores ficam com a sua leitura.' }])
    render(<Conferencia casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ver a chance de êxito' }))
    expect(await screen.findByText('Sem casos parecidos na casa ainda: sem porcentagem.')).toBeTruthy()
  })

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

  const SEM_PARECER = 'Não dá para aprovar para o INSS: falta o parecer médico "Suficiente", confirmado por pessoa (G17).'

  it('CA5 · sem parecer, Aprovar fica desligado com a trava do servidor, e a Sênior pode pedir a dispensa', async () => {
    servidor({ ...base, parecer: null, travaDoParecer: SEM_PARECER })
    render(<Conferencia casoId={CASO} />)
    expect(((await screen.findByRole('button', { name: 'Aprovar' })) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(SEM_PARECER)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pedir a dispensa do parecer' })).toBeTruthy()
  })

  it('G17 e Q14 · dispensa pedida: quem pediu espera outra Sênior; a outra aprova ou recusa', async () => {
    const dispensa = { pedidaPor: 'Helena', justificativa: 'Laudo do INSS já reconhece', podeResponder: false }
    servidor({ ...base, parecer: null, travaDoParecer: 'espera a aprovação de outra Sênior', dispensa })
    const { unmount } = render(<Conferencia casoId={CASO} />)
    expect(await screen.findByText(/Espera a aprovação de outra Sênior/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Aprovar a dispensa' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pedir a dispensa do parecer' })).toBeNull()
    unmount()
    const fetch = servidor({ ...base, parecer: null, travaDoParecer: 'espera', dispensa: { ...dispensa, podeResponder: true } })
    render(<Conferencia casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Aprovar a dispensa' }))
    await screen.findByRole('button', { name: 'Recusar a dispensa' })
    const envio = fetch.mock.calls.find(([url]) => String(url).endsWith('/parecer/dispensa/aprovacao'))
    expect(JSON.parse(String(envio?.[1]?.body))).toEqual({ aprova: true })
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
