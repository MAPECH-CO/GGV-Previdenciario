import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DecidirPericia } from './DecidirPericia.tsx'
import { Protocolar } from './Protocolar.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const casoParaProtocolo = {
  casoId: CASO,
  cliente: 'Maria Souza (exemplo)',
  beneficio: 'bpc_loas_deficiente',
  okSenior: { por: 'Helena', em: '2026-10-05T12:00:00.000Z' },
  documentos: [
    { id: '11111111-1111-4111-8111-111111111111', tipo: 'rg', nome: 'RG e CPF.pdf' },
    { id: '22222222-2222-4222-8222-222222222222', tipo: 'laudo', nome: 'Laudo médico.pdf' },
  ],
  temSenhaNoCofre: true,
  jaProtocolado: false,
}

/** Responde por caminho: { '/api/x': [status, corpo] }. */
function servidor(rotas: Record<string, [number, unknown]>) {
  const fetch = vi.fn(async (url: string) => {
    const [status, corpo] = rotas[url] ?? [404, { erro: 'não achou' }]
    return new Response(JSON.stringify(corpo), { status })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => vi.unstubAllGlobals())

describe('Protocolar no Meu INSS (GGVP-27)', () => {
  it('CA1 · mostra o OK da Sênior, os documentos na ordem e o acesso ao cofre', async () => {
    servidor({ [`/api/casos/${CASO}/protocolo`]: [200, casoParaProtocolo] })
    render(<Protocolar casoId={CASO} />)
    expect(await screen.findByText(/OK recebido · Helena/)).toBeTruthy()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['RG e CPF.pdf', 'Laudo médico.pdf'])
    expect(screen.getByRole('button', { name: 'Ver a senha do gov.br' })).toBeTruthy()
  })

  it('CA4 · sem a conferência marcada, não envia e diz o que falta', async () => {
    const fetch = servidor({ [`/api/casos/${CASO}/protocolo`]: [200, casoParaProtocolo] })
    render(<Protocolar casoId={CASO} />)
    fireEvent.change(await screen.findByLabelText('Número do requerimento'), { target: { value: '1234a5' } })
    expect((screen.getByLabelText('Número do requerimento') as HTMLInputElement).value).toBe('12345')
    fireEvent.change(screen.getByLabelText('Data de entrada do requerimento (DER)'), { target: { value: '05102026' } })
    expect((screen.getByLabelText('Data de entrada do requerimento (DER)') as HTMLInputElement).value).toBe('05/10/2026')
    fireEvent.click(screen.getByRole('button', { name: 'Registrar protocolo' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Marque "Revisei o requerimento antes de enviar"')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('CA3 · sem o OK da Sênior, o botão de registrar fica desligado', async () => {
    servidor({ [`/api/casos/${CASO}/protocolo`]: [200, { ...casoParaProtocolo, okSenior: null }] })
    render(<Protocolar casoId={CASO} />)
    expect(await screen.findByText(/Sem o OK da Sênior/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Registrar protocolo' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('CA6 · a senha do gov.br pede a senha do portal e aparece com o tempo contando', async () => {
    servidor({
      [`/api/casos/${CASO}/protocolo`]: [200, casoParaProtocolo],
      [`/api/casos/${CASO}/cofre`]: [200, { senha: 'gov-maria', segundos: 60 }],
    })
    render(<Protocolar casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ver a senha do gov.br' }))
    fireEvent.change(screen.getByLabelText('Confirme com a sua senha do portal'), { target: { value: 'minha' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar por 60 segundos' }))
    expect((await screen.findByRole('status')).textContent).toContain('gov-maria')
    expect(screen.getByRole('status').textContent).toContain('some em 60s')
  })
})

describe('Decidir perícia (GGVP-31)', () => {
  it('CA5 · "Definir" só habilita com a resposta; com "Sim", só com um tipo', () => {
    render(<DecidirPericia casoId={CASO} />)
    const definir = () => screen.getByRole('button', { name: 'Definir' }) as HTMLButtonElement
    expect(definir().disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Sim, o sistema abre a tarefa de perícia'))
    expect(definir().disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Avaliação social'))
    expect(definir().disabled).toBe(false)
    fireEvent.click(screen.getByLabelText('Não'))
    expect(definir().disabled).toBe(false)
  })

  it('CA1 · com perícia, envia os tipos e avisa que o sistema abriu a tarefa', async () => {
    const fetch = servidor({ [`/api/casos/${CASO}/pericia`]: [201, { ok: true }] })
    render(<DecidirPericia casoId={CASO} />)
    fireEvent.click(screen.getByLabelText('Sim, o sistema abre a tarefa de perícia'))
    fireEvent.click(screen.getByLabelText('Perícia médica'))
    fireEvent.click(screen.getByLabelText('Avaliação social'))
    fireEvent.click(screen.getByRole('button', { name: 'Definir' }))
    expect((await screen.findByRole('status')).textContent).toContain('abriu a tarefa de perícia')
    expect(fetch).toHaveBeenCalledWith(`/api/casos/${CASO}/pericia`, expect.objectContaining({ body: JSON.stringify({ precisa: true, tipos: ['medica', 'social'] }) }))
  })
})
