// GGVP-137 · a perícia anda de verdade no servidor, do lado da tela: o INSS liberou (D2.E1) na tela de marcar, a senha do
// gov.br pelo cofre, "Anexar" sobe à pasta do caso, a Central do Jurídico administrativo sem a mesma perícia duas vezes e o
// conteúdo médico pela permissão. O servidor aqui é de mentira, rota a rota; as regras do servidor têm os testes da API.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { doJuridico, registraSaude } from '../dados/parecer.ts'
import { iniciarPericia, sincronizarPericias } from '../dados/pericia.ts'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import type { Ficha, Tarefa } from '../dados/tipos.ts'
import { criarPericia, marcar, mudancas, naTela, type MundoDaPericia, type Pericia, type PedidoDePericia } from '../regras/periciaNoCaso.ts'
import { CentralJuridicoAdm } from './CentralJuridicoAdm.tsx'
import { MarcarPericia } from './MarcarPericia.tsx'
import { ReunirDocumentosPericia } from './ReunirDocumentosPericia.tsx'

const AGORA = new Date(2026, 9, 8, 10, 0)
const CASO = '6f1c2b3a-4d5e-4f60-8a9b-0c1d2e3f4a5b'
const PESSOA = '7a2d3c4b-5e6f-4a70-9b8c-1d2e3f4a5b6c'
const PERICIA = '8b3e4d5c-6f70-4b81-8c9d-2e3f4a5b6c7d'
const url = (caminho = '') => `/api/processos/${CASO}/pericia${caminho}`

const DO_INSS: PedidoDePericia = { origem: 'd2-necessidade', tipo: 'medica', instancia: 'inss', pedidaPor: 'Gabi' }

/** O mundo do servidor: a ficha mínima do caso e a perícia médica pedida no D2.03 (liberada ou esperando o INSS) ou pelo juiz. */
function mundoDoServidor(liberada: boolean, pedido = DO_INSS): { mundo: MundoDaPericia; pericia: Pericia } {
  const ficha: Ficha = {
    id: PESSOA,
    situacao: 'cliente',
    desde: '10/2026',
    nome: 'Ivone Teste',
    telefone: '11900000050',
    senhaGov: { situacao: 'sem-senha' },
    fichaAtendimentoPreenchida: false,
    processos: [{ id: CASO, beneficio: 'loas-deficiente', etapa: 'administrativa' }],
    agendamentos: [],
    contatos: [],
    documentos: [],
    transcricoes: 0,
    historico: [],
    arquivos: [],
  }
  const mundo: MundoDaPericia = { fichas: [ficha], pericias: [], peritos: [] }
  const pericia = criarPericia(mundo, CASO, pedido, AGORA, liberada ? AGORA : undefined, PERICIA)
  return { mundo, pericia }
}

/** Liga o modo servidor com um servidor de mentira: cada rota ("MÉTODO /api/...") responde o que a função devolve. */
function ligarServidor(rotas: Record<string, (corpo: unknown) => unknown>) {
  const fetch = vi.fn(async (endereco: string, init?: RequestInit) => {
    const responder = rotas[`${init?.method ?? 'GET'} ${endereco}`]
    if (!responder) return new Response(JSON.stringify({ erro: 'Não encontrado.' }), { status: 404 })
    const corpo = init?.body instanceof FormData ? init.body : init?.body ? JSON.parse(String(init.body)) : undefined
    return new Response(JSON.stringify(responder(corpo)), { status: 200 })
  })
  vi.stubGlobal('fetch', fetch)
  configurarExemplo({ servidor: true })
  return fetch
}

beforeEach(() => {
  configurarExemplo({ agora: () => AGORA, latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  entrarComo('juridico-adm')
})
afterEach(() => {
  configurarExemplo({ servidor: false })
  vi.unstubAllGlobals()
})

describe('D2.E1 · o INSS liberou o agendamento: o Jurídico administrativo registra na tela de marcar', () => {
  it('na semente: a perícia esperando o INSS mostra a espera e o botão; liberada, a marcação abre na mesma tela', async () => {
    await iniciarPericia('rita-exemplo-1', { origem: 'd2-necessidade', tipo: 'medica', instancia: 'inss', pedidaPor: 'Dra. Paula (exemplo)' })
    render(comSessao(<MarcarPericia processoId="rita-exemplo-1" />))
    const espera = await screen.findByRole('region', { name: 'Esperando o INSS liberar o agendamento (D2.E1)' })
    expect((screen.getByRole('radio', { name: 'Sim, marcado' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(espera).getByRole('button', { name: 'O INSS liberou o agendamento' }))
    expect(await screen.findByText('Liberação registrada: marque a perícia pelo Meu INSS.')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Esperando o INSS liberar o agendamento (D2.E1)' })).toBeNull()
    expect((screen.getByRole('radio', { name: 'Sim, marcado' }) as HTMLButtonElement).disabled).toBe(false)
    // Quem libera é o INSS, não o portal (texto da instrução).
    expect(screen.getByText(/pelo Meu INSS \(senha no cofre\): o INSS já liberou o agendamento/)).toBeTruthy()
  })

  it('outro perfil vê a espera, sem o botão', async () => {
    await iniciarPericia('rita-exemplo-1', { origem: 'd2-necessidade', tipo: 'medica', instancia: 'inss', pedidaPor: 'Dra. Paula (exemplo)' })
    entrarComo('advogada')
    render(comSessao(<MarcarPericia processoId="rita-exemplo-1" />))
    const espera = await screen.findByRole('region', { name: 'Esperando o INSS liberar o agendamento (D2.E1)' })
    expect(within(espera).queryByRole('button')).toBeNull()
  })

  it('no servidor: o botão chama a liberação da perícia do caso e a tela recebe a perícia liberada', async () => {
    const { mundo, pericia } = mundoDoServidor(false)
    const fetch = ligarServidor({
      [`GET ${url()}`]: () => naTela(mundo, pericia, AGORA),
      [`POST ${url('/liberacao')}`]: () => {
        mudancas.liberacao({ mundo, pericia, agora: AGORA })
        return naTela(mundo, pericia, AGORA)
      },
    })
    render(comSessao(<MarcarPericia processoId={CASO} />))
    fireEvent.click(await screen.findByRole('button', { name: 'O INSS liberou o agendamento' }))
    expect(await screen.findByText('Liberação registrada: marque a perícia pelo Meu INSS.')).toBeTruthy()
    expect(fetch.mock.calls.map(([e, i]) => `${i?.method ?? 'GET'} ${e}`)).toContain(`POST ${url('/liberacao')}`)
  })
})

describe('G9 · a senha do gov.br na tela de marcar a perícia, pelo cofre', () => {
  it('com a tarefa de marcar aberta: confirma a senha do portal e a senha aparece pelos segundos do cofre', async () => {
    const { mundo, pericia } = mundoDoServidor(true)
    const pedidos: unknown[] = []
    ligarServidor({
      [`GET ${url()}`]: () => naTela(mundo, pericia, AGORA),
      [`POST /api/casos/${CASO}/cofre`]: (corpo) => {
        pedidos.push(corpo)
        return { senha: 'senha-gov-da-ivone', segundos: 60 }
      },
    })
    render(comSessao(<MarcarPericia processoId={CASO} />))
    const inss = await screen.findByRole('region', { name: 'Meu INSS' })
    fireEvent.click(within(inss).getByRole('button', { name: 'Ver a senha do gov.br' }))
    fireEvent.change(within(inss).getByLabelText('Confirme com a sua senha do portal'), { target: { value: 'senha-do-portal-1' } })
    fireEvent.click(within(inss).getByRole('button', { name: 'Mostrar por 60 segundos' }))
    expect((await within(inss).findByRole('status')).textContent).toBe('Senha do gov.br: senha-gov-da-ivone · some em 60s')
    expect(pedidos).toEqual([{ senhaDoPortal: 'senha-do-portal-1' }])
  })

  it('sem a tarefa de marcar (esperando o INSS ou já marcada), nada de senha', async () => {
    const { mundo, pericia } = mundoDoServidor(false)
    ligarServidor({ [`GET ${url()}`]: () => naTela(mundo, pericia, AGORA) })
    render(comSessao(<MarcarPericia processoId={CASO} />))
    await screen.findByRole('region', { name: 'Esperando o INSS liberar o agendamento (D2.E1)' })
    expect(screen.queryByRole('region', { name: 'Meu INSS' })).toBeNull()
  })
})

describe('perícia do juízo sem data lida: o Jurídico administrativo registra a data que o juízo designou', () => {
  const DO_JUIZ: PedidoDePericia = { origem: 'd3a-juiz', tipo: 'medica', instancia: 'juizo', pedidaPor: 'Juízo (exemplo)' }
  /** Preenche a data, a hora e o local no cartão da data do juízo. */
  function preencher(cartao: HTMLElement, data: string) {
    fireEvent.change(within(cartao).getByLabelText(/^Data \(dd\/mm\/aaaa\)/), { target: { value: data } })
    fireEvent.change(within(cartao).getByLabelText(/^Hora/), { target: { value: '10:00' } })
    fireEvent.change(within(cartao).getByLabelText(/^Local/), { target: { value: 'Sala 1 da Vara Federal' } })
  }

  it('na semente: a tela diz que a data não saiu, sem Meu INSS nem comprovante; registrada, vai à agenda', async () => {
    await iniciarPericia('rita-exemplo-1', DO_JUIZ)
    render(comSessao(<MarcarPericia processoId="rita-exemplo-1" />))
    const cartao = await screen.findByRole('region', { name: 'A data ainda não saiu na publicação' })
    expect(screen.getByText(/ainda não saiu na publicação \(ou saiu num formato que o sistema não lê\)/)).toBeTruthy()
    expect(screen.queryByText(/o sistema leu na publicação/)).toBeNull()
    // Sem o fluxo do comprovante do INSS: a perícia judicial não tem comprovante.
    expect((screen.getByRole('radio', { name: 'Sim, marcado' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Registrar a perícia' })).toBeNull()
    const registrar = within(cartao).getByRole('button', { name: 'Registrar a data do juízo' }) as HTMLButtonElement
    expect(registrar.disabled).toBe(true)
    preencher(cartao, '01/10/2026')
    expect(within(cartao).getByText('Confira a data da perícia: ela não pode ser passada.')).toBeTruthy()
    preencher(cartao, '22/10/2026')
    expect(registrar.disabled).toBe(false)
    fireEvent.click(registrar)
    expect(await screen.findByText('Data do juízo registrada: na agenda e na ficha, com o lembrete da véspera agendado.')).toBeTruthy()
    const feita = screen.getByRole('region', { name: '✓ Perícia registrada' })
    expect(feita.textContent).toContain('10:00 · Sala 1 da Vara Federal')
    expect(feita.textContent).toContain('A data veio do juízo, registrada por')
  })

  it('outro perfil vê que a data não saiu, sem o formulário', async () => {
    await iniciarPericia('rita-exemplo-1', DO_JUIZ)
    entrarComo('advogada')
    render(comSessao(<MarcarPericia processoId="rita-exemplo-1" />))
    const cartao = await screen.findByRole('region', { name: 'A data ainda não saiu na publicação' })
    expect(within(cartao).queryByRole('button')).toBeNull()
  })

  it('no servidor: o registro vai à rota da data do juízo, sem o cofre do gov.br, e a tela recebe a perícia agendada', async () => {
    const { mundo, pericia } = mundoDoServidor(false, DO_JUIZ)
    const pedidos: unknown[] = []
    ligarServidor({
      [`GET ${url()}`]: () => naTela(mundo, pericia, AGORA),
      [`POST ${url('/data-do-juizo')}`]: (corpo) => {
        pedidos.push(corpo)
        mudancas.dataDoJuizo({ mundo, pericia, agora: AGORA }, corpo as { data: string; hora: string; local: string }, 'Igor')
        return naTela(mundo, pericia, AGORA)
      },
    })
    render(comSessao(<MarcarPericia processoId={CASO} />))
    const cartao = await screen.findByRole('region', { name: 'A data ainda não saiu na publicação' })
    expect(screen.queryByRole('region', { name: 'Meu INSS' })).toBeNull()
    preencher(cartao, '22/10/2026')
    fireEvent.click(within(cartao).getByRole('button', { name: 'Registrar a data do juízo' }))
    expect(await screen.findByText('Data do juízo registrada: na agenda e na ficha, com o lembrete da véspera agendado.')).toBeTruthy()
    expect(pedidos).toEqual([{ data: '2026-10-22', hora: '10:00', local: 'Sala 1 da Vara Federal' }])
    expect(screen.getByRole('region', { name: '✓ Perícia registrada' }).textContent).toContain('registrada por Igor')
  })
})

describe('DP.03 · "Anexar" no caso do servidor sobe o documento à pasta do caso', () => {
  it('o arquivo vai à rota da perícia com o item; o item fica anexado', async () => {
    const { mundo, pericia } = mundoDoServidor(true)
    const lido = { data: '2026-10-29', hora: '08:30', local: 'Agência INSS Santo Amaro', modalidade: 'presencial', tipo: 'medica' as const }
    marcar(mundo, pericia, { comprovante: { nome: 'comprovante.pdf' }, lido, pedeDocumentoNovo: true }, 'Igor', AGORA)
    const enviados: { item: unknown; arquivo: string }[] = []
    ligarServidor({
      [`GET ${url()}`]: () => naTela(mundo, pericia, AGORA),
      [`POST ${url('/documentos')}`]: (corpo) => {
        const f = corpo as FormData
        const dados = JSON.parse(String(f.get('dados'))) as { itemId: string }
        enviados.push({ item: dados.itemId, arquivo: (f.get('documento') as File).name })
        mudancas.anexo({ mundo, pericia, agora: AGORA }, { itemId: dados.itemId, arquivo: { nome: (f.get('documento') as File).name } }, 'Fábio')
        return naTela(mundo, pericia, AGORA)
      },
    })
    entrarComo('documentacao')
    render(comSessao(<ReunirDocumentosPericia processoId={CASO} />))
    const anexar = await screen.findByLabelText('Anexar: Laudo médico recente (até 30 dias)')
    fireEvent.change(anexar, { target: { files: [new File(['%PDF-1.4'], 'laudo_ivone.pdf', { type: 'application/pdf' })] } })
    expect(await screen.findByText('Anexado: Laudo médico recente (até 30 dias), na pasta do caso.')).toBeTruthy()
    expect(enviados).toEqual([{ item: 'laudo-recente', arquivo: 'laudo_ivone.pdf' }])
    const itens = screen.getByRole('list', { name: 'O que a perícia pede' })
    expect(within(itens).getByText(/anexado: laudo_ivone\.pdf/)).toBeTruthy()
    expect(within(itens).queryByLabelText('Anexar: Laudo médico recente (até 30 dias)')).toBeNull()
  })
})

describe('Central do Jurídico administrativo · a mesma perícia uma vez só', () => {
  const linhaDp01 = { id: '1b2c3d4e-0000-4000-8000-000000000001', casoId: CASO, passo: 'DP.01', cliente: { id: PESSOA, nome: 'Ivone Teste' }, titulo: 'Marcar perícia médica', detalhe: 'bpc loas deficiente', tela: `/casos/${CASO}/pericia/marcar`, prazo: null, urgente: false }
  const MARCAR: Tarefa = { id: `pericia-marcar-${PERICIA}`, codigo: 'DP.02', cliente: { id: PESSOA, nome: 'Ivone Teste' }, acao: 'Marcar perícia', detalhe: '', href: `/casos/${CASO}/pericia/marcar` }

  it('liberada: a tarefa que o sistema abriu (DP.01) e a da perícia levam à mesma tela, e fica uma', async () => {
    const { mundo, pericia } = mundoDoServidor(true)
    ligarServidor({ 'GET /api/tarefas': () => [linhaDp01], 'GET /api/pericias': () => [naTela(mundo, pericia, AGORA)], 'GET /api/pericias/tarefas': () => [MARCAR], 'GET /api/peritos': () => [] })
    await sincronizarPericias(true)
    render(comSessao(<CentralJuridicoAdm />))
    await waitFor(() => expect(screen.getAllByRole('link', { name: /^Ivone Teste · / })).toHaveLength(1))
    expect(screen.getByRole('link', { name: 'Ivone Teste · Marcar perícia' }).getAttribute('href')).toBe(`/casos/${CASO}/pericia/marcar`)
  })

  it('esperando o INSS: só a tarefa do sistema, que leva à tela de marcar (onde se registra a liberação)', async () => {
    const { mundo, pericia } = mundoDoServidor(false)
    ligarServidor({ 'GET /api/tarefas': () => [linhaDp01], 'GET /api/pericias': () => [naTela(mundo, pericia, AGORA)], 'GET /api/pericias/tarefas': () => [], 'GET /api/peritos': () => [] })
    await sincronizarPericias(true)
    render(comSessao(<CentralJuridicoAdm />))
    expect((await screen.findByRole('link', { name: 'Ivone Teste · Marcar perícia médica' })).getAttribute('href')).toBe(`/casos/${CASO}/pericia/marcar`)
  })
})

describe('saúde simples · o conteúdo médico na tela segue a permissão do servidor', () => {
  it('o Jurídico administrativo vê o conteúdo médico (dado_saude.ver_detalhe); registrar continua com a advogada e a sênior', () => {
    expect(['advogada', 'senior', 'senior-2', 'juridico-adm', 'atendimento', 'documentacao'].map(doJuridico)).toEqual([true, true, true, true, false, false])
    expect(['advogada', 'senior', 'senior-2', 'juridico-adm', 'documentacao'].map(registraSaude)).toEqual([true, true, true, false, false])
  })
})
