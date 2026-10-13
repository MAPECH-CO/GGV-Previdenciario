import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NovoEvento } from '../componentes/NovoEvento.tsx'
import { Agenda } from './Agenda.tsx'
import { EntrevistaAoVivo } from './EntrevistaAoVivo.tsx'
import { RegistrarFechamento } from './RegistrarFechamento.tsx'
import { MarcarEntrevista } from './MarcarEntrevista.tsx'
import { PrepararEntrevista } from './PrepararEntrevista.tsx'
import { bancoInventado, ENTREVISTA_FICTICIA, fichaInventada, ID_FICTICIO } from '../dados/caminhoMaria.fixture.ts'
import { configurarExemplo, gravar, zerarExemplo } from '../dados/servidor.ts'
import { SessaoContexto } from '../sessao.ts'

vi.mock('../dados/gravacaoDeVerdade.ts', () => ({ useGravacaoDeVerdade: () => ({
  aoVivo: [{ id: '1', texto: 'Minha senha é frase inventada', final: true }, { id: '2', texto: 'continuação inventada', final: false }],
  semAoVivo: '', semMicrofone: '', tirarPendentes: () => [],
}) }))
beforeEach(() => { configurarExemplo({ servidor: true, latencia: 0, agora: () => new Date('2026-10-11T12:00:00Z') }); zerarExemplo(); gravar(bancoInventado()) })
afterEach(() => { configurarExemplo({ servidor: false }); zerarExemplo(); vi.unstubAllGlobals() })
function servidor() {
  const ficha = fichaInventada()
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/pericias')) return new Response('[]')
    if (url.endsWith('/recepcao')) return new Response(JSON.stringify(bancoInventado([ficha])))
    if (init?.method === 'POST' && url.endsWith('/fechamento')) {
      return new Response(JSON.stringify({ fechou: false, ficha: { ...ficha, fechamento: { situacao: 'recontatar', motivo: 'desistiu', recontatarEm: '2026-10-20', papel: 'atendimento', quem: 'Equipe Inventada', quando: '2026-10-11T12:00:00Z' } }, tarefas: [] }))
    }
    return new Response(JSON.stringify(ficha))
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('caminho da entrevista nas telas', () => {
  it('agenda filtra os compromissos pelo nome da pessoa da sessão', async () => {
    servidor()
    render(<SessaoContexto.Provider value={{ nome: 'Outra Advogada Inventada', email: 'teste@example.invalid', perfis: ['advogada'], perfilAtivo: 'advogada', trocarSenha: false }}><Agenda vistaInicial="lista" /></SessaoContexto.Provider>)
    await screen.findByRole('button', { name: /Pessoa Inventada no Teste · Fazer entrevista/ })
    fireEvent.click(screen.getByLabelText('Só as minhas'))
    expect(screen.queryByRole('button', { name: /Pessoa Inventada no Teste · Fazer entrevista/ })).toBeNull()
    fireEvent.click(screen.getByLabelText('Só as minhas'))
    expect(screen.getByRole('button', { name: /Pessoa Inventada no Teste · Fazer entrevista/ })).toBeTruthy()
  })
  it('a lista fixa de advogadas não aparece no agendamento de uma ficha do servidor', async () => {
    servidor(); render(<MarcarEntrevista fichaId={ID_FICTICIO} />)
    const campo = await screen.findByLabelText('Com quem')
    expect(within(campo).queryByRole('option', { name: /Paula/ })).toBeNull()
    expect((screen.getByRole('button', { name: /Iniciar entrevista/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getAllByText(/lista de advogadas ainda não está disponível/).length).toBeGreaterThan(0)
  })
  it('um compromisso interno não oferece equipe de exemplo quando ligado ao servidor', () => {
    render(<NovoEvento hoje="2026-10-11" aoCriado={vi.fn()} aoFechar={vi.fn()} navegar={vi.fn()} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Compromisso interno' }))
    expect(within(screen.getByLabelText('Responsável')).queryByRole('option', { name: /Paula/ })).toBeNull()
    expect((screen.getByRole('button', { name: 'Pôr na agenda' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/A lista da equipe ainda não está disponível/)).toBeTruthy()
  })
  it('a desistência oferece motivo e exige uma data válida para recontatar', async () => {
    const fetch = servidor(); render(<RegistrarFechamento fichaId={ID_FICTICIO} antesDaEntrevista />)
    expect((await screen.findByLabelText('Motivo *') as HTMLSelectElement).value).toBe('desistiu')
    const data = screen.getByLabelText('Recontatar em *')
    const botao = screen.getByRole('button', { name: 'Registrar e agendar retorno' }) as HTMLButtonElement
    expect(botao.disabled).toBe(true)
    fireEvent.change(data, { target: { value: '20/10/2026' } })
    fireEvent.click(botao)
    await screen.findByRole('heading', { name: /Registrado: recontatar em/ })
    const post = fetch.mock.calls.find(([, i]) => i?.method === 'POST')!
    expect(JSON.parse(String(post[1]!.body))).toMatchObject({ fechou: false, motivo: 'desistiu', recontatar: { data: '20/10/2026' } })
  })
  it('trocar de entrevista retira a ficha anterior enquanto aguarda a API', async () => {
    const primeira = fichaInventada()
    const segunda = { ...primeira, id: '44444444-4444-4444-8444-444444444444', nome: 'Outra Pessoa Inventada' }
    const outroAgendamento = segunda.id + '-ag-teste'
    segunda.agendamentos = [{ ...primeira.agendamentos[0], id: outroAgendamento }]
    let liberar!: () => void
    const atrasada = new Promise<Response>(resolve => { liberar = () => resolve(new Response(JSON.stringify(segunda))) })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith(segunda.id) ? atrasada : new Response(JSON.stringify(primeira))))
    const tela = render(<PrepararEntrevista agendamentoId={ENTREVISTA_FICTICIA} />)
    await screen.findByRole('heading', { name: /Pessoa Inventada no Teste/ })
    tela.rerender(<PrepararEntrevista agendamentoId={outroAgendamento} />)
    expect(screen.queryByRole('heading', { name: /Pessoa Inventada no Teste/ })).toBeNull()
    expect(screen.getByText('Abrindo a preparação…')).toBeTruthy()
    liberar()
    await screen.findByRole('heading', { name: /Outra Pessoa Inventada/ })
  })
  it('falha de leitura não mostra preparação antiga', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    render(<PrepararEntrevista agendamentoId={ENTREVISTA_FICTICIA} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível buscar a ficha no servidor')
  })
  it('avisa sobre o áudio e não exibe a senha nem o texto parcial no DOM', async () => {
    servidor(); render(<EntrevistaAoVivo agendamentoId={ENTREVISTA_FICTICIA} />)
    await screen.findByText(/A gravação capta só o microfone/)
    expect(screen.queryByText('Minha senha é frase inventada')).toBeNull()
    expect(screen.queryByText('continuação inventada')).toBeNull()
    expect(screen.getByText('[senha retirada: vai ao cofre]')).toBeTruthy()
    expect(screen.getByText('Ouvindo…')).toBeTruthy()
  })
})
