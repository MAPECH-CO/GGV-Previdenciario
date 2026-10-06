import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RegistrarIndeferimento } from './RegistrarIndeferimento.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const CARTA = '22222222-2222-4222-8222-222222222222'
const base = {
  casoId: CASO,
  cliente: 'Sebastião Cruz (exemplo)',
  beneficio: 'bpc_loas_idoso',
  dataDecisao: '2026-10-06',
  motivoInss: 'Renda per capita acima do limite',
  carta: { id: CARTA, nome: 'carta-inss.pdf' },
  motivoEscrito: null,
  podeRegistrar: true,
}

function servidor(get: object, post: [number, unknown] = [201, { ok: true }]) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify(post[1]), { status: post[0] }) : new Response(JSON.stringify(get), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

describe('Registrar o motivo do indeferimento (GGVP-52)', () => {
  it('CA3 · mostra o motivo do INSS e a carta para abrir, ao lado do campo', async () => {
    servidor(base)
    render(<RegistrarIndeferimento casoId={CASO} />)
    expect((await screen.findByText(/Motivo no sistema do INSS/)).textContent).toBe('Motivo no sistema do INSS: Renda per capita acima do limite')
    expect(screen.getByRole('link', { name: 'Abrir a carta de indeferimento (carta-inss.pdf)' }).getAttribute('href')).toBe(`/api/casos/${CASO}/documentos/${CARTA}`)
    expect(screen.getByLabelText('Motivo com as suas palavras')).toBeTruthy()
  })

  it('CA1, CA6 · o motivo é obrigatório; registrado, avisa que a Sênior recebeu o despacho', async () => {
    const fetch = servidor(base)
    render(<RegistrarIndeferimento casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar e enviar à Sênior' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva o motivo com as suas palavras')
    fireEvent.change(screen.getByLabelText('Motivo com as suas palavras'), { target: { value: 'O INSS somou a renda do filho' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar e enviar à Sênior' }))
    expect((await screen.findByRole('status')).textContent).toBe('Motivo registrado no banco de motivos. A Sênior recebeu "Despachar caso".')
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect((post[1]!.body as FormData).get('motivo')).toBe('O INSS somou a renda do filho')
  })

  it('CA4 · sem a carta no caso, pede o arquivo', async () => {
    servidor({ ...base, carta: null })
    render(<RegistrarIndeferimento casoId={CASO} />)
    fireEvent.change(await screen.findByLabelText('Motivo com as suas palavras'), { target: { value: 'Faltou o laudo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar e enviar à Sênior' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Anexe a carta de indeferimento (PDF ou imagem, até 25 MB).')
    expect(screen.getByLabelText('Carta de indeferimento')).toBeTruthy()
  })

  it('CA7 · registrado, mostra o motivo com quem escreveu e quando, sem o formulário', async () => {
    servidor({ ...base, podeRegistrar: false, motivoEscrito: { texto: 'O INSS somou a renda do filho', por: 'Gabi', em: '2026-10-07T13:00:00.000Z' } })
    render(<RegistrarIndeferimento casoId={CASO} />)
    expect((await screen.findByText('O INSS somou a renda do filho')).textContent).toBe('O INSS somou a renda do filho')
    expect(screen.getByText('Gabi em 07/10/2026')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Registrar e enviar à Sênior' })).toBeNull()
  })
})
