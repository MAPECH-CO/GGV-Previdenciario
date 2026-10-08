import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CofreGovbr } from '../componentes/CofreGovbr.tsx'
import { Prazos, UsoDoCofreTela } from './Gestao.tsx'
import { Historico } from './Historico.tsx'

const CASO = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const PESSOA = '7a1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'
const base = {
  casoId: CASO,
  cliente: 'Vera Lúcia (exemplo)',
  eventos: [
    { quando: '2026-10-05T12:00:00.000Z', quem: 'Helena', origem: 'pessoa', passo: 'D2.01', descricao: 'OK da Sênior para o INSS: aprovado' },
    { quando: '2026-10-06T12:00:00.000Z', quem: 'Sistema', origem: 'sistema', passo: null, descricao: 'Vigília rodou' },
  ],
  exportacao: null,
  podePedirExportacao: false,
  podeAutorizarExportacao: false,
  podeExportar: false,
}

function servidor(get: object, post: [number, unknown] = [201, { ok: true }]) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'POST' ? new Response(JSON.stringify(post[1]), { status: post[0] }) : new Response(JSON.stringify(get), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}
const posts = (fetch: ReturnType<typeof servidor>) =>
  fetch.mock.calls.filter(([, i]) => i?.method === 'POST').map(([url, i]) => [String(url), i?.body ? JSON.parse(i.body as string) : null])
afterEach(() => vi.unstubAllGlobals())

describe('Histórico do processo (GGVP-99)', () => {
  it('CA7, CA11 · a linha do processo, em ordem, com quando, quem, o que e o passo', async () => {
    servidor(base)
    render(<Historico casoId={CASO} />)
    const linha = await screen.findByRole('list', { name: 'Linha do processo' })
    expect(within(linha).getAllByRole('listitem').map((l) => l.textContent)).toEqual([
      '05/10/2026, 09:00 · Helena · OK da Sênior para o INSS: aprovado (D2.01)',
      '06/10/2026, 09:00 · Sistema · Vigília rodou',
    ])
    expect(screen.queryByRole('region', { name: 'Exportação do histórico' })).toBeNull()
  })

  it('GGVP-108 CA3 · o caso aparece pelo número da fase: o processo na Justiça, o protocolo no INSS', async () => {
    servidor({ ...base, numero: { tipo: 'cnj', valor: '00011239320184036301' } })
    const { unmount } = render(<Historico casoId={CASO} />)
    expect((await screen.findByText(/Processo 0001123-93\.2018\.4\.03\.6301/)).textContent).toContain('Vera Lúcia (exemplo) · Processo 0001123-93.2018.4.03.6301 ·')
    unmount()
    servidor({ ...base, numero: { tipo: 'protocolo_inss', valor: '123456789' } })
    render(<Historico casoId={CASO} />)
    expect(await screen.findByText(/Protocolo do INSS 123456789/)).toBeTruthy()
  })

  it('CA12 · a gestão pede a exportação com o motivo', async () => {
    const fetch = servidor({ ...base, podePedirExportacao: true })
    render(<Historico casoId={CASO} />)
    const pedir = (await screen.findByRole('button', { name: 'Pedir a exportação' })) as HTMLButtonElement
    expect(pedir.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Motivo do pedido (auditoria, titular dos dados)'), { target: { value: 'Pedido do titular' } })
    fireEvent.click(pedir)
    expect((await screen.findByRole('status')).textContent).toBe('Pedido enviado. A direção recebeu a tarefa de autorizar a exportação.')
    expect(posts(fetch)).toEqual([[`/api/casos/${CASO}/historico/exportacao`, { motivo: 'Pedido do titular' }]])
  })

  it('CA12 · a direção autoriza; autorizada, quem pediu baixa a trilha', async () => {
    const exportacao = { situacao: 'pedida', pedidaPor: 'Helena', motivo: 'Pedido do titular', pedidaEm: '2026-10-07T12:00:00.000Z' }
    const fetch = servidor({ ...base, eventos: [], exportacao, podeAutorizarExportacao: true })
    render(<Historico casoId={CASO} />)
    expect((await screen.findByText(/Pedida por Helena/)).textContent).toBe('Pedida por Helena em 07/10/2026, 09:00: Pedido do titular. Esperando a autorização da direção.')
    fireEvent.click(screen.getByRole('button', { name: 'Autorizar a exportação' }))
    expect((await screen.findByRole('status')).textContent).toBe('Exportação autorizada. Quem pediu já pode baixar o histórico.')
    expect(posts(fetch)).toEqual([[`/api/casos/${CASO}/historico/exportacao/autorizacao`, null]])
    vi.unstubAllGlobals()
    servidor({ ...base, exportacao: { ...exportacao, situacao: 'autorizada' }, podeExportar: true })
    render(<Historico casoId={CASO} />)
    expect((await screen.findByRole('link', { name: 'Baixar o histórico (JSON)' })).getAttribute('href')).toBe(`/api/casos/${CASO}/historico/exportacao`)
  })
})

describe('Gestão: prazos e uso do cofre (GGVP-99 CA14, GGVP-103 CA6)', () => {
  it('os prazos cumpridos e perdidos, com o cliente', async () => {
    servidor({ cumpridos: 1, perdidos: 1, itens: [{ quando: '2026-10-02T12:00:00.000Z', casoId: CASO, cliente: 'Vera Lúcia (exemplo)', situacao: 'perdido', descricao: 'Exigência do juiz perdida' }] })
    render(<Prazos />)
    expect((await screen.findByText(/Cumpridos:/)).textContent).toBe('Cumpridos: 1 · Perdidos: 1')
    expect(screen.getByRole('list', { name: 'Prazos' }).textContent).toBe('02/10/2026, 09:00 · Vera Lúcia (exemplo) · Exigência do juiz perdida')
  })

  it('o uso do cofre por pessoa, sem a senha', async () => {
    servidor({ pessoas: [{ quem: 'Igor', leituras: 2, cadastros: 0, recusas: 1, ultimoUso: '2026-10-07T15:00:00.000Z' }] })
    render(<UsoDoCofreTela />)
    expect((await screen.findByRole('list', { name: 'Uso do cofre por pessoa' })).textContent).toBe(
      'Igor · leituras 2 · cadastros e trocas 0 · recusas 1 · último uso 07/10/2026, 12:00',
    )
  })
})

describe('Cofre do gov.br (GGVP-103 CA4, CA11)', () => {
  it('a senha entra num campo de senha, vai direto ao cofre e some do campo', async () => {
    const fetch = servidor({}, [201, { ok: true, trocada: false }])
    const aoGuardar = vi.fn()
    render(<CofreGovbr pessoaId={PESSOA} temSenha={false} aoGuardar={aoGuardar} />)
    fireEvent.click(screen.getByText('Cadastrar a senha do gov.br no cofre'))
    const campo = screen.getByLabelText('Senha do gov.br') as HTMLInputElement
    expect([campo.type, campo.autocomplete]).toEqual(['password', 'off'])
    fireEvent.change(campo, { target: { value: 'gov-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar no cofre' }))
    expect((await screen.findByRole('status')).textContent).toBe('Senha guardada no cofre.')
    expect([campo.value, aoGuardar.mock.calls.length]).toEqual(['', 1])
    expect(posts(fetch)).toEqual([[`/api/pessoas/${PESSOA}/cofre`, { senha: 'gov-123' }]])
  })
})
