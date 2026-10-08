import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Manifestar } from './Manifestar.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const ITEM = '22222222-2222-4222-8222-222222222222'
const base = {
  casoId: CASO,
  cliente: 'Paulo Reis (exemplo)',
  prazo: { fim: '2026-10-27', regra: 'Lei 11.419' },
  faltam: [],
  pendentes: [],
  semProva: [],
  versoes: [],
  dilacaoAutorizada: false,
  protocolo: null,
  podeAnexar: true,
  podeProtocolar: false,
  podeAutorizarDilacao: false,
  podeEncerrarSemProva: false,
}
const versao = (extra = {}) => ({ numero: 1, tipo: 'manifestacao', arquivo: 'peca.pdf', por: 'Gabi', em: '2026-10-05T15:00:00.000Z', aprovadaPor: null, aprovadaEm: null, ...extra })

function servidor(get: object, post: [number, unknown] = [201, { ok: true }]) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify(post[1]), { status: post[0] }) : new Response(JSON.stringify(get), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
afterEach(() => vi.unstubAllGlobals())

describe('Manifestar e protocolar (GGVP-87)', () => {
  it('CA5 · com setor pendente, mostra o bloqueio com quem falta e o prazo; o botão fica desligado', async () => {
    servidor({ ...base, faltam: ['Atendimento'], pendentes: [{ alvo: 'item', id: ITEM, setor: 'Atendimento', descricao: 'CTPS', prazoInterno: '2026-10-20' }] })
    render(<Manifestar casoId={CASO} />)
    expect((await screen.findByText(/Manifestar bloqueado/)).textContent).toBe('Manifestar bloqueado: falta Atendimento (G21).')
    expect(screen.getByText(/CTPS · até 20\/10\/2026/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Manifestar e protocolar' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('G6 · aprovar a versão pede a marcação (GGVP-109 CA3: o botão só habilita com ela)', async () => {
    servidor({ ...base, versoes: [versao()] })
    render(<Manifestar casoId={CASO} />)
    const aprovar = (await screen.findByRole('button', { name: 'Aprovar a versão 1' })) as HTMLButtonElement
    expect(aprovar.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('Aprovei a versão da manifestação (G6)'))
    expect(aprovar.disabled).toBe(false)
  })

  it('CA3 · protocolar pede o comprovante; com tudo, avisa a volta à vigília', async () => {
    servidor({ ...base, versoes: [versao({ aprovadaPor: 'Gabi', aprovadaEm: '2026-10-05T15:00:00.000Z' })], podeProtocolar: true }, [201, { ok: true, tipo: 'manifestacao' }])
    render(<Manifestar casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Manifestar e protocolar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Anexe o comprovante do protocolo (PDF ou imagem, até 25 MB).')
    fireEvent.change(screen.getByLabelText('Comprovante do protocolo'), { target: { files: [new File(['%PDF'], 'c.pdf', { type: 'application/pdf' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Manifestar e protocolar' }))
    expect((await screen.findByRole('status')).textContent).toBe('Manifestação protocolada. O processo voltou para a vigília.')
  })

  it('CA10 · protocolada, mostra a data, a versão e quem protocolou', async () => {
    servidor({ ...base, podeAnexar: false, protocolo: { em: '2026-10-05T15:00:00.000Z', versao: 2, tipo: 'manifestacao', por: 'Gabi' } })
    render(<Manifestar casoId={CASO} />)
    expect((await screen.findByLabelText('Protocolo')).textContent).toBe('Manifestação protocolada em 05/10/2026 · versão 2 · por Gabi')
  })

  it('CA12 · a Sênior autoriza a dilação, com o motivo obrigatório', async () => {
    servidor({ ...base, podeAnexar: false, faltam: ['Atendimento'], podeAutorizarDilacao: true })
    render(<Manifestar casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Autorizar a dilação' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva o motivo da dilação')
  })

  it('ajuste de 06/10 · o documento não existe: encerrar sem a prova pede o motivo e avisa para explicar na manifestação', async () => {
    const fetch = servidor({
      ...base,
      faltam: ['Perícia'],
      pendentes: [{ alvo: 'pericia', id: ITEM, setor: 'Jurídico administrativo', descricao: 'Perícia médica', prazoInterno: null }],
      podeEncerrarSemProva: true,
    })
    render(<Manifestar casoId={CASO} />)
    expect(await screen.findByText(/A perícia não tem como ser feita\?/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar sem a prova' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva por que vai manifestar sem essa prova')
    fireEvent.change(screen.getByLabelText('Por que vai manifestar sem essa prova'), { target: { value: 'O juiz cancelou a perícia' } })
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar sem a prova' }))
    expect((await screen.findByRole('status')).textContent).toContain('Explique isso na manifestação')
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1]!.body as string)).toEqual({ alvo: 'pericia', id: ITEM, motivo: 'O juiz cancelou a perícia' })
  })

  it('ajuste de 06/10 · mostra o que foi encerrado sem a prova, com o motivo e quem', async () => {
    servidor({ ...base, semProva: [{ descricao: 'Laudo', motivo: 'O médico faleceu', por: 'Gabi', em: '2026-10-05T15:00:00.000Z' }] })
    render(<Manifestar casoId={CASO} />)
    expect((await screen.findByText(/O médico faleceu/)).textContent).toBe('Laudo · O médico faleceu · Gabi em 05/10/2026')
  })
})
