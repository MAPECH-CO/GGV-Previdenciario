import type { ReactNode } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UsuarioDaSessao } from '@ggv/contratos'
import { SessaoContexto } from '../sessao.ts'
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

  it('CA6 · a data da exigência abre no calendário, já em hoje, sem data futura', async () => {
    servidor(emVigilia)
    render(<Vigilia casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Exigência'))
    const campo = screen.getByLabelText('Data da exigência') as HTMLInputElement
    expect([campo.type, campo.value, campo.max]).toEqual(['date', campo.max, campo.max])
    expect(campo.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('CA6 · exigência envia a data escolhida no calendário', async () => {
    const fetch = servidor(emVigilia, [201, { ok: true, aberto: 'exigencia' }])
    render(<Vigilia casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Exigência'))
    fireEvent.change(screen.getByLabelText('Texto da exigência'), { target: { value: 'Trazer CadÚnico' } })
    fireEvent.change(screen.getByLabelText('Data da exigência'), { target: { value: '2026-10-03' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect((await screen.findByRole('status')).textContent).toContain('continua vigiado')
    expect((fetch.mock.calls[1][1]!.body as FormData).get('data')).toBe('03/10/2026')
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
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva o motivo com as suas palavras')
    fireEvent.change(screen.getByLabelText('Motivo com as suas palavras'), { target: { value: 'O INSS somou a renda do filho' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Anexe a carta de indeferimento (PDF ou imagem, até 25 MB).')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('GGVP-52 (ajuste de 06/10) · o motivo com as suas palavras vai no mesmo registro, e a Sênior recebe o despacho', async () => {
    const fetch = servidor(emVigilia, [201, { ok: true, aberto: 'justica' }])
    render(<Vigilia casoId={CASO} />)
    fireEvent.click(await screen.findByLabelText('Indeferido'))
    fireEvent.change(screen.getByLabelText('Texto da comunicação do INSS'), { target: { value: 'Negado' } })
    fireEvent.change(screen.getByLabelText('Motivo que consta no sistema do INSS'), { target: { value: 'Renda acima' } })
    fireEvent.change(screen.getByLabelText('Motivo com as suas palavras'), { target: { value: 'O INSS somou a renda do filho' } })
    fireEvent.change(screen.getByLabelText('Carta de indeferimento'), { target: { files: [new File(['%PDF'], 'carta.pdf', { type: 'application/pdf' })] } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect((await screen.findByRole('status')).textContent).toBe('Indeferido registrado com o seu motivo. O caso foi para a Justiça e a Sênior recebeu "Despachar caso".')
    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect((post[1]!.body as FormData).get('motivoEscrito')).toBe('O INSS somou a renda do filho')
  })

  it('a Sênior vê "Encerrar sem judicializar" e o motivo é obrigatório', async () => {
    servidor({ ...emVigilia, fase: 'judicial', esperando: null, desde: null, podeRegistrar: false, podeEncerrar: true })
    render(<Vigilia casoId={CASO} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Encerrar o caso' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Escreva por que o caso é encerrado')
  })
})

// Ajuste do Mateus (06/10): depois de registrar a resposta do INSS, o passo seguinte da advogada pode ser feito na
// mesma tela; se ela deixar para depois, a tarefa fica na Central.
const exigenciaRegistrada = {
  casoId: CASO,
  exigenciaId: '22222222-2222-4222-8222-222222222222',
  cliente: 'Maria Souza (exemplo)',
  beneficio: 'bpc_loas_deficiente',
  texto: 'Apresentar CadÚnico.',
  data: '2026-10-02',
  diasInss: null,
  prazo: null,
  regraPrazo: null,
  feriadosCadastrados: false,
  pede: null,
  situacao: 'aberta',
  vencida: false,
  itens: [],
  pericias: [],
  card: null,
  podeDecidir: true,
  podeCumprir: false,
  podeResponder: false,
  podeDecidirVencida: false,
}
const prestacaoAberta = {
  casoId: CASO,
  cliente: 'Maria Souza (exemplo)',
  beneficio: 'bpc_loas_deficiente',
  carta: { id: '11111111-1111-4111-8111-111111111111', nome: 'carta.pdf' },
  percentualContrato: '30.00',
  versoes: [],
  agendamento: null,
  podeEditar: true,
  podeReceber: false,
}

/** A API do caso: a vigília, a exigência e a prestação; o registro na vigília responde o passo que abriu. */
function servidorDoCaso(aberto: string) {
  const respostas: Record<string, unknown> = { [URL]: emVigilia, [`/api/casos/${CASO}/exigencia`]: exigenciaRegistrada, [`/api/casos/${CASO}/prestacao`]: prestacaoAberta }
  const fetch = vi.fn(async (url: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? new Response(JSON.stringify({ ok: true, aberto }), { status: 201 })
      : new Response(JSON.stringify(respostas[url] ?? { erro: 'não achou' }), { status: respostas[url] ? 200 : 404 }),
  )
  vi.stubGlobal('fetch', fetch)
}
const comPerfil = (perfilAtivo: string, tela: ReactNode) => <SessaoContexto.Provider value={{ perfilAtivo } as unknown as UsuarioDaSessao}>{tela}</SessaoContexto.Provider>

async function registrarExigencia() {
  fireEvent.click(await screen.findByLabelText('Exigência'))
  fireEvent.change(screen.getByLabelText('Texto da exigência'), { target: { value: 'Apresentar CadÚnico.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
}

describe('A resposta do INSS e o passo seguinte numa tela só (ajuste de 06/10)', () => {
  it('exigência: a advogada trata a exigência ali mesmo; se deixar para depois, a tarefa está na Central', async () => {
    servidorDoCaso('exigencia')
    render(comPerfil('advogada', <Vigilia casoId={CASO} />))
    await registrarExigencia()
    const tratar = await screen.findByRole('region', { name: 'Tratar exigência do INSS' })
    expect(await within(tratar).findByText('O que a exigência pede?')).toBeTruthy()
    expect(screen.getByText('Pode tratar a exigência aqui mesmo, ou depois: a tarefa ficou na sua Central.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Registrar' })).toBeNull()
  })

  it('deferido: a advogada presta contas ali mesmo', async () => {
    servidorDoCaso('prestacao')
    render(comPerfil('advogada', <Vigilia casoId={CASO} />))
    fireEvent.click(await screen.findByLabelText('Deferido'))
    fireEvent.change(screen.getByLabelText('Texto da comunicação do INSS'), { target: { value: 'Benefício concedido' } })
    fireEvent.change(screen.getByLabelText('Comunicação do INSS'), { target: { files: [pdf()] } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    const prestar = await screen.findByRole('region', { name: 'Prestar contas' })
    expect(await within(prestar).findByLabelText('Valor recebido (atrasados)')).toBeTruthy()
  })

  it('quem não faz o passo seguinte (Jurídico administrativo) vê só o que o sistema abriu', async () => {
    servidorDoCaso('exigencia')
    render(comPerfil('juridico_adm', <Vigilia casoId={CASO} />))
    await registrarExigencia()
    expect((await screen.findByRole('status')).textContent).toContain('Tratar exigência do INSS')
    expect(screen.queryByRole('region', { name: 'Tratar exigência do INSS' })).toBeNull()
  })
})

