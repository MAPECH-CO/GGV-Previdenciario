import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Vigilia } from './Vigilia.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const URL = `/api/casos/${CASO}/vigilia`
const emVigilia = {
  casoId: CASO,
  cliente: 'Maria Souza (exemplo)',
  beneficio: 'bpc_loas_deficiente',
  fase: 'administrativa',
  esperando: 'INSS decidir',
  desde: '2026-10-01T12:00:00.000Z',
  registros: [],
  podeRegistrar: true,
  podeEncerrar: false,
}

function servidor(get: unknown, post: [number, unknown] = [201, { ok: true, aberto: 'prestacao' }]) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return new Response(JSON.stringify(post[1]), { status: post[0] })
    return new Response(JSON.stringify(url === URL ? get : { erro: 'não achou' }), { status: url === URL ? 200 : 404 })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const pdf = () => new File(['%PDF'], 'carta.pdf', { type: 'application/pdf' })

afterEach(() => vi.unstubAllGlobals())

describe('Vigília do Meu INSS (GGVP-35)', () => {
  it('CA7 · mostra o que o caso espera e desde quando', async () => {
    servidor(emVigilia)
    render(<Vigilia casoId={CASO} />)
    expect((await screen.findByText(/Esperando: INSS decidir/)).textContent).toContain('01/10/2026')
  })

  it('CA5 · deferido sem a comunicação anexada não envia', async () => {
    const fetch = servidor(emVigilia)
    render(<Vigilia casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Deferido'))
    fireEvent.change(screen.getByLabelText('Texto da comunicação do INSS'), { target: { value: 'Concedido' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Anexe a comunicação do INSS (PDF ou imagem, até 25 MB).')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('CA6 · exigência pede a data no formato dd/mm/aaaa', async () => {
    servidor(emVigilia)
    render(<Vigilia casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Exigência'))
    fireEvent.change(screen.getByLabelText('Data da exigência'), { target: { value: '03102026' } })
    expect((screen.getByLabelText('Data da exigência') as HTMLInputElement).value).toBe('03/10/2026')
  })

  it('CA3 · deferido com a comunicação: diz o que o sistema abriu', async () => {
    servidor(emVigilia)
    render(<Vigilia casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Deferido'))
    fireEvent.change(screen.getByLabelText('Texto da comunicação do INSS'), { target: { value: 'Concedido' } })
    fireEvent.change(screen.getByLabelText('Comunicação do INSS'), { target: { files: [pdf()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect((await screen.findByRole('status')).textContent).toContain('Prestar contas')
  })

  it('quem não pode registrar só vê', async () => {
    servidor({ ...emVigilia, podeRegistrar: false })
    render(<Vigilia casoId={CASO} />)
    await screen.findByText(/Esperando/)
    expect(screen.queryByRole('button', { name: 'Registrar' })).toBeNull()
  })
})

describe('Indeferido segue para a Justiça (GGVP-48)', () => {
  it('CA2 · indeferido pede o motivo do INSS e a carta', async () => {
    const fetch = servidor(emVigilia)
    render(<Vigilia casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Indeferido'))
    fireEvent.change(screen.getByLabelText('Texto da comunicação do INSS'), { target: { value: 'Negado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Informe o motivo que consta no sistema do INSS')
    fireEvent.change(screen.getByLabelText('Motivo que consta no sistema do INSS'), { target: { value: 'Renda acima' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Anexe a carta de indeferimento (PDF ou imagem, até 25 MB).')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('a Sênior vê "Encerrar sem judicializar" e o motivo é obrigatório', async () => {
    servidor({ ...emVigilia, fase: 'judicial', esperando: null, desde: null, podeRegistrar: false, podeEncerrar: true })
    render(<Vigilia casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Encerrar o caso' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva por que o caso é encerrado')
  })
})
