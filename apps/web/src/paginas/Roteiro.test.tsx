import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { comSessao, entrarComo } from '../dados/sessaoDeTeste.tsx'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { Roteiro } from './Roteiro.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 6, 15, 10), latencia: 0 })
  zerarExemplo()
  localStorage.clear()
  entrarComo()
})

describe('Roteiro de laudos · tela', () => {
  it('CA1 · a lista traz cada roteiro com os benefícios e a versão; a régua documental diz "sem laudo"', async () => {
    render(comSessao(<Roteiro />))
    const lista = await screen.findByRole('list', { name: 'Roteiros' })
    const itens = within(lista).getAllByRole('link')
    // GGVP-50: o roteiro infantil é o último.
    expect(itens).toHaveLength(11)
    expect(itens[10].getAttribute('href')).toBe('/roteiros/loas-infantil')
    expect(itens[1].textContent).toContain('Aposentadoria da Pessoa com Deficiência')
    expect(itens[1].textContent).toContain('PCD Aposentadoria por Contribuição · PCD Aposentadoria por Idade')
    expect(itens[1].getAttribute('href')).toBe('/roteiros/pcd')
    expect(itens[5].textContent).toContain('sem laudo · régua documental')
  })

  it('CA1 · a advogada vê os itens por tipo, com o texto do escritório e a pergunta ao médico, mas não edita', async () => {
    render(comSessao(<Roteiro id="auxilio-acidente" />))
    await screen.findByRole('heading', { level: 1, name: 'Auxílio-Acidente · Roteiro de conteúdo mínimo' })
    const obrigatorios = screen.getByRole('list', { name: 'Obrigatórios · o que o documento precisa abordar' })
    expect(within(obrigatorios).getAllByRole('listitem')).toHaveLength(7)
    expect(obrigatorios.textContent).toContain('Consolidação das lesõesPergunta ao médico: As lesões já estão consolidadas? Desde quando?')
    // GGVP-47: o laudo sem redução da capacidade também bloqueia (resposta do Lucas, 01/10).
    expect(within(screen.getByRole('list', { name: 'Contradições que bloqueiam (G18)' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Lesão ainda não consolidada',
      'Laudo sem redução da capacidade para o trabalho habitual (a redução mínima basta, Tema 416 do STJ)',
    ])
    expect(screen.getByRole('list', { name: 'Documentos complementares' }).textContent).toContain('CAT, boletim de ocorrência')
    expect(screen.queryByRole('button', { name: 'Editar o roteiro' })).toBeNull()
    expect(screen.getByText('Só a sênior edita o roteiro. Você vê a versão em vigor e as anteriores.')).toBeTruthy()
  })

  it('CA2 · a sênior edita, a trava pede o texto, e salvar cria a versão 2 com autor e data', async () => {
    entrarComo('senior')
    render(comSessao(<Roteiro id="loas-deficiente" />))
    fireEvent.click(await screen.findByRole('button', { name: 'Editar o roteiro' }))
    const textos = screen.getAllByRole('textbox', { name: 'Texto do item' })
    fireEvent.change(textos[2], { target: { value: '' } })
    const salvar = screen.getByRole('button', { name: 'Salvar como versão 2' }) as HTMLButtonElement
    expect(salvar.disabled).toBe(true)
    expect(screen.getByText('Escreva o texto de cada item.')).toBeTruthy()
    fireEvent.change(textos[2], { target: { value: 'Prognóstico: duração prevista em meses, ou permanente' } })
    fireEvent.click(salvar)
    expect(await screen.findByRole('heading', { name: '✓ Nova versão salva' })).toBeTruthy()
    expect(screen.getByText(/Versão 2 salva por Dra\. Renata \(exemplo\) em 06\/10\/2026 15:10/)).toBeTruthy()
    const versoes = within(screen.getByRole('list', { name: 'Versões' })).getAllByRole('listitem')
    expect(versoes.map((v) => v.textContent)).toEqual([
      'Versão 2 · em vigorDra. Renata (exemplo) · 06/10/2026 15:10 · 1 item alterado',
      'Versão 1Escritório (roteiro de laudos, 26/09) · 26/09/2026 12:00 · primeira versão',
    ])
    expect(screen.getByRole('list', { name: 'Obrigatórios · o que o documento precisa abordar' }).textContent).toContain('duração prevista em meses')
  })

  it('o Atendimento não vê o roteiro: ele é do Jurídico', async () => {
    entrarComo('atendimento')
    render(comSessao(<Roteiro id="loas-deficiente" />))
    expect(screen.getByRole('heading', { level: 1, name: 'O roteiro de laudos é do Jurídico' })).toBeTruthy()
    expect(screen.getByText(/O que falta pedir ao cliente aparece no parecer médico do caso/)).toBeTruthy()
  })
})
