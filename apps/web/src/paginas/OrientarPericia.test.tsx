import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { obterPericia, tarefasDoJuridicoAdm } from '../dados/pericia.ts'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { CentralJuridicoAdm } from './CentralJuridicoAdm.tsx'
import { OrientarPericia } from './OrientarPericia.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 7, 10, 0), latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  entrarComo('juridico-adm')
})

const documento = () => screen.getByRole('textbox', { name: /Orientação para Antônio/ }) as HTMLTextAreaElement

async function abrirAntonio() {
  render(comSessao(<OrientarPericia processoId="antonio-exemplo-1" />))
  await screen.findByRole('heading', { name: 'Antônio Exemplo · Orientar para a perícia' })
}

describe('GGVP-62 · preparar o cliente (Figma 10:405)', () => {
  it('CA1 · o documento para enviar ou imprimir, com as linhas da orientação e o contato do cliente', async () => {
    await abrirAntonio()
    expect(screen.getByText('perícia 16/10 · ligar para o cliente · até 13/10')).toBeTruthy()
    const linhas = within(screen.getByRole('region', { name: 'Orientação' }))
    expect(linhas.getByText('pelo perfil do perito: Dr. A. Prado (exemplo) · versão de 34 laudos')).toBeTruthy()
    expect(linhas.getByText('nunca instruir a esconder ou mudar a real situação (G11)')).toBeTruthy()
    expect(documento().value).toContain('O que Dr. A. Prado costuma observar')
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeTruthy()
    const contato = within(screen.getByRole('region', { name: 'Contato do cliente' }))
    expect(contato.getByRole('link', { name: 'Ligar' }).getAttribute('href')).toMatch(/^tel:\+5511/)
    expect(contato.getByRole('button', { name: 'WhatsApp' })).toBeTruthy()
  })

  it('CA3 · enviar e registrar a ligação só depois de "Revisei a orientação"; editar pede revisar de novo', async () => {
    await abrirAntonio()
    const registrar = screen.getByRole('button', { name: 'Registrar a ligação e a orientação' }) as HTMLButtonElement
    const enviar = screen.getByRole('button', { name: 'Enviar orientação' }) as HTMLButtonElement
    expect(registrar.disabled && enviar.disabled).toBe(true)
    expect(screen.getByText('Marque «Revisei a orientação» antes de enviar.')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Revisei a orientação' }))
    expect(registrar.disabled || enviar.disabled).toBe(false)
    fireEvent.change(documento(), { target: { value: `${documento().value}\nChegue cedo.` } })
    expect((screen.getByRole('checkbox', { name: 'Revisei a orientação' }) as HTMLInputElement).checked).toBe(false)
    expect(registrar.disabled).toBe(true)
  })

  it('CA2, CA7 · enviada pelo Chatwoot: o feito com o texto guardado, o histórico com o canal e a tarefa sai da Central', async () => {
    await abrirAntonio()
    const texto = documento().value
    fireEvent.click(screen.getByRole('checkbox', { name: 'Revisei a orientação' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar orientação' }))
    expect(await screen.findByText('Orientação enviada pelo Chatwoot e guardada no caso.')).toBeTruthy()
    const feito = within(screen.getByRole('region', { name: '✓ Orientação passada' }))
    expect(feito.getByText(/Enviada pelo Chatwoot, como documento e instrução, em 07\/10\/2026 10:00, por Igor \(exemplo\)/)).toBeTruthy()
    expect(feito.getByText((_, el) => el?.tagName === 'P' && el.textContent === texto)).toBeTruthy()
    const p = (await obterPericia('antonio-exemplo-1'))!.pericia
    expect(p.historico.at(-1)).toMatchObject({ quem: 'Igor (exemplo)', oQue: 'Enviou a orientação pelo Chatwoot, como documento e instrução', passo: 'DP.06' })
    expect(tarefasDoJuridicoAdm().some((t) => t.id === `pericia-orientar-${p.id}`)).toBe(false)
  })

  it('CA4, CA6 · editada à mão para esconder a situação real: a tela avisa, o servidor recusa e a tentativa fica registrada', async () => {
    await abrirAntonio()
    fireEvent.change(documento(), { target: { value: `${documento().value}\nOculte que voltou a trabalhar.` } })
    expect(screen.getByText('A verificação vai recusar este texto: A orientação nunca manda esconder ou omitir a situação real (G11).')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Revisei a orientação' }))
    fireEvent.click(screen.getByRole('button', { name: 'Registrar a ligação e a orientação' }))
    expect((await screen.findByRole('alert')).textContent).toBe('A orientação nunca manda esconder ou omitir a situação real (G11).')
    const recusas = within(await screen.findByRole('list', { name: 'Envios recusados' }))
    expect(recusas.getByText(/Igor \(exemplo\) · A orientação nunca manda esconder/)).toBeTruthy()
    expect((await obterPericia('antonio-exemplo-1'))!.pericia.preparacao).toBeUndefined()
  })

  it('a perícia sem data: a orientação ainda não está pronta', async () => {
    render(comSessao(<OrientarPericia processoId="maria-exemplo-1" />))
    expect(await screen.findByRole('heading', { name: 'A orientação ainda não está pronta' })).toBeTruthy()
  })
})

describe('GGVP-62 · o chat da Central (Figma 2107:1091)', () => {
  it('CA8 · "o Antônio me ligou": a próxima tarefa e a orientação pronta, só respondendo', async () => {
    render(comSessao(<CentralJuridicoAdm />))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'O Antônio me ligou. O que eu falo para ele?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(await screen.findByText(/A próxima tarefa é sua: orientar Antônio para a perícia de 16\/10\. A orientação da IA está pronta/)).toBeTruthy()
    const item = within(screen.getByRole('list', { name: 'Tarefas sugeridas' })).getByRole('link')
    expect(item.getAttribute('href')).toBe('/casos/antonio-exemplo-1/pericia/orientar')
    expect(item.textContent).toContain('perícia 16/10 · orientação da IA pronta')
    expect(screen.getByText('Só respondo e oriento. Para executar algo, peça e eu mostro um card para você confirmar.')).toBeTruthy()
    expect((await obterPericia('antonio-exemplo-1'))!.pericia.preparacao).toBeUndefined()
  })
})
