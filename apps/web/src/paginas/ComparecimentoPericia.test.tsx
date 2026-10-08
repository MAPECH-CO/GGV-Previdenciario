import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DetalhePericia } from '../componentes/DetalhePericia.tsx'
import { eventosDaAgenda } from '../dados/agenda.ts'
import { obterPericia, tarefasDaAdvogadaNaPericia, tarefasDoJuridicoAdm } from '../dados/pericia.ts'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, gravar, ler, zerarExemplo } from '../dados/servidor.ts'
import { CentralJuridicoAdm } from './CentralJuridicoAdm.tsx'
import { ComparecimentoPericia } from './ComparecimentoPericia.tsx'

let agora = new Date(2026, 9, 7, 10, 0)

beforeEach(async () => {
  agora = new Date(2026, 9, 7, 10, 0)
  configurarExemplo({ agora: () => agora, latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  entrarComo('juridico-adm')
  // A semente nasce em 07/10: a perícia do Antônio fica em 16/10, 10:30 (data lida da publicação).
  await obterPericia('antonio-exemplo-1')
})

async function abrir(titulo: string) {
  render(comSessao(<ComparecimentoPericia processoId="antonio-exemplo-1" />))
  await screen.findByRole('heading', { name: `Antônio Exemplo · ${titulo}` })
}

describe('GGVP-66 · comparecimento e remarcação (Figma 1818:289)', () => {
  it('CA7, CA8 · na véspera, a confirmação na Central; depois das 16h, o alerta; o resultado fica registrado', async () => {
    agora = new Date(2026, 9, 15, 16, 30)
    render(comSessao(<CentralJuridicoAdm />))
    const tarefa = await screen.findByRole('link', { name: 'Antônio Exemplo · Confirmar presença na perícia' })
    expect(tarefa.getAttribute('href')).toBe('/casos/antonio-exemplo-1/pericia/comparecimento')
    expect(screen.getByText(/presença não confirmada até 16h: contatar o cliente/)).toBeTruthy()
  })

  it('CA7 · registrar a confirmação: "não consegui" pede o que aconteceu; "confirmou" registra e sai da Central', async () => {
    agora = new Date(2026, 9, 15, 10, 0)
    await abrir('Confirmar presença na perícia')
    expect(screen.getByText('perícia médica do Juízo 16/10, 10:30 · Vara Federal de Santo Amaro (exemplo) · sala de perícias')).toBeTruthy()
    const registrar = screen.getByRole('button', { name: 'Registrar a confirmação' }) as HTMLButtonElement
    expect(registrar.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Não consegui confirmar' }))
    expect(screen.getByText('Diga o que aconteceu na tentativa.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('O que aconteceu *'), { target: { value: 'caixa postal' } })
    fireEvent.click(registrar)
    expect(await screen.findByText('Tentativa registrada: a confirmação segue na sua Central.')).toBeTruthy()
    expect(screen.getByText(/Não confirmou: caixa postal/)).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Confirmou' }))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar a confirmação' }))
    expect(await screen.findByText('Presença confirmada e registrada.')).toBeTruthy()
    expect(screen.getByText(/✓ Presença confirmada/)).toBeTruthy()
    expect(tarefasDoJuridicoAdm().some((t) => t.acao === 'Confirmar presença na perícia')).toBe(false)
  })

  it('CA9 · o cliente avisa que não pode ir: remarca na hora com o motivo, contando no limite', async () => {
    agora = new Date(2026, 9, 15, 10, 0)
    await abrir('Confirmar presença na perícia')
    fireEvent.click(screen.getByRole('radio', { name: 'Não vai poder ir' }))
    expect(screen.getByText('Remarcar na hora: remarcação 1 · limite 2 (G15); passou, sobe para a advogada.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Motivo da remarcação *'), { target: { value: 'vai estar internado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Remarcar agora' }))
    expect(await screen.findByRole('heading', { name: '✓ Remarcação registrada' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Remarcar a perícia' }).getAttribute('href')).toBe('/casos/antonio-exemplo-1/pericia/marcar')
    const p = (await obterPericia('antonio-exemplo-1'))!.pericia
    expect(p.remarcacoes).toBe(1)
    expect(p.historico.at(-1)?.oQue).toBe('Remarcação 1: vai estar internado')
  })

  it('CA1 · antes do dia e da hora, não há "compareceu?"; depois, "Registrar" só com a resposta', async () => {
    agora = new Date(2026, 9, 16, 10, 0)
    const { unmount } = render(comSessao(<ComparecimentoPericia processoId="antonio-exemplo-1" />))
    await screen.findByRole('heading', { name: 'Antônio Exemplo · Confirmar presença na perícia' })
    expect(screen.queryByRole('radiogroup', { name: 'Antônio compareceu?' })).toBeNull()
    unmount()
    agora = new Date(2026, 9, 16, 11, 0)
    await abrir('Registrar comparecimento')
    expect(screen.getByText('Depois de 16/10, registre se Antônio foi. Se faltou, marque de novo.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Registrar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Se faltou: remarcação 1 · limite 2 (G15); passou, sobe para a advogada.')).toBeTruthy()
  })

  it('CA4, CA5 · compareceu: o feito diz que espera o resultado, e a advogada responsável fica com o acompanhamento', async () => {
    agora = new Date(2026, 9, 16, 14, 0)
    await abrir('Registrar comparecimento')
    fireEvent.click(screen.getByRole('radio', { name: 'Compareceu' }))
    fireEvent.change(screen.getByLabelText('Justificativa, se houver'), { target: { value: 'chegou 40 min antes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    const feito = within(await screen.findByRole('region', { name: '✓ Comparecimento registrado' }))
    expect(feito.getByText(/Compareceu · registrado em 16\/10\/2026 14:00 por Igor \(exemplo\) · chegou 40 min antes/)).toBeTruthy()
    expect(feito.getByText(/a advogada responsável acompanha no processo/)).toBeTruthy()
    expect(tarefasDaAdvogadaNaPericia().map((t) => `${t.cliente?.nome} · ${t.acao}`)).toEqual(['Antônio Exemplo · Conferir resultado da perícia'])
  })

  it('CA2, CA4 · faltou: a falta com a justificativa e a tarefa volta para remarcar', async () => {
    agora = new Date(2026, 9, 16, 14, 0)
    await abrir('Registrar comparecimento')
    fireEvent.click(screen.getByRole('radio', { name: 'Faltou' }))
    fireEvent.change(screen.getByLabelText('Justificativa, se houver'), { target: { value: 'ônibus não passou' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(await screen.findByRole('heading', { name: '✓ Falta registrada' })).toBeTruthy()
    expect(screen.getByText(/Antônio não compareceu à perícia de 16\/10, 10:30 · ônibus não passou/)).toBeTruthy()
    expect(screen.getByText('A perícia voltou para remarcar: 1ª remarcação, limite 2 (G15).')).toBeTruthy()
    expect(tarefasDoJuridicoAdm().find((t) => t.cliente?.id === 'antonio-exemplo')?.acao).toBe('Remarcar perícia')
  })

  it('CA3 · a falta que passa do limite sobe para a advogada responsável (G15)', async () => {
    const banco = ler()
    banco.pericias!.find((p) => p.processoId === 'antonio-exemplo-1')!.remarcacoes = 2
    gravar(banco)
    agora = new Date(2026, 9, 16, 14, 0)
    await abrir('Registrar comparecimento')
    fireEvent.click(screen.getByRole('radio', { name: 'Faltou' }))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar' }))
    expect(await screen.findByText(/Passou do limite de 2 remarcações: a perícia subiu para a advogada responsável \(G15\)/)).toBeTruthy()
    expect(tarefasDaAdvogadaNaPericia().map((t) => t.acao)).toEqual(['Decidir a perícia'])
  })

  it('CA6 · no dia seguinte sem registro, o alerta na Central', async () => {
    agora = new Date(2026, 9, 17, 9, 0)
    render(comSessao(<CentralJuridicoAdm />))
    expect(await screen.findByRole('link', { name: 'Antônio Exemplo · Registrar comparecimento' })).toBeTruthy()
    expect(screen.getByText(/alerta: o comparecimento não foi registrado/)).toBeTruthy()
  })

  it('a agenda: "Marcar como realizado" abre o comparecimento', async () => {
    agora = new Date(2026, 9, 16, 14, 0)
    const evento = (await eventosDaAgenda('2026-10-16', '2026-10-16')).find((e) => e.categoria === 'pericias')!
    render(comSessao(<DetalhePericia evento={evento} aoFechar={() => {}} />))
    expect(screen.getByRole('link', { name: 'Marcar como realizado' }).getAttribute('href')).toBe('/casos/antonio-exemplo-1/pericia/comparecimento')
  })
})
