import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { CPF_DE_TESTE } from '../dados/exemplo.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { FichaAtendimento } from './FichaAtendimento.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function abrir(fichaId = 'josefa-exemplo', tablet = false) {
  render(<FichaAtendimento fichaId={fichaId} tablet={tablet} />)
  await screen.findByRole('heading', { level: 1, name: tablet ? 'Olá! Responda uma pergunta por vez.' : /Preencher ficha/ })
}

const caixa = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement
const salvar = () => screen.getByRole('button', { name: 'Salvar ficha' }) as HTMLButtonElement
const escrever = (rotulo: string, valor: string) => {
  fireEvent.change(caixa(rotulo), { target: { value: valor } })
  fireEvent.blur(caixa(rotulo))
}

describe('Ficha de atendimento · tela do passo', () => {
  it('CA5, CA11 e CA12 · os campos do Figma, a data de hoje sem edição e "Salvar ficha" parado sem os obrigatórios', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Josefa Exemplo · Preencher ficha')
    for (const rotulo of ['Nome completo *', 'CPF *', 'Data de nascimento *', 'Telefone / WhatsApp *', 'Endereço', 'Quantas pessoas moram na casa', 'Benefício procurado', 'Última atividade', 'Desde quando está sem trabalhar', 'O que já pediu ao INSS']) {
      expect(caixa(rotulo), rotulo).toBeTruthy()
    }
    expect(screen.getByText('05/10/2026 · preenchida sozinha, sem edição')).toBeTruthy()
    expect(salvar().disabled).toBe(true)
    expect(screen.getByText('Falta: CPF e Data de nascimento.')).toBeTruthy()
    expect(screen.getByText('A senha do gov.br vai para o cofre, nunca em campo de texto (G9).')).toBeTruthy()
  })

  it('CA7 · o benefício vem do catálogo do escritório, com "Não sei ainda"', async () => {
    await abrir()
    const lista = within(caixa('Benefício procurado') as unknown as HTMLElement)
    expect(lista.getByRole('option', { name: 'Não sei ainda' })).toBeTruthy()
    expect(lista.getByRole('option', { name: 'LOAS Deficiente' })).toBeTruthy()
    expect((caixa('Benefício procurado') as unknown as HTMLSelectElement).value).toBe('loas-idoso')
  })

  it('CA14 e CA15 · a ficha em papel no scanner: a IA preenche, marca o que leu e manda a senha ao cofre para conferir', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Digitalizar a ficha em papel (scanner simulado)' }))
    expect((await screen.findByText(/Ficha de atendimento GGV - Josefa Exemplo - 2026-10-05.pdf em Documentos pessoais/)).textContent).toContain(
      'não leu: CPF, Data de nascimento e Endereço',
    )
    expect(caixa('Última atividade').value).toBe('auxiliar de limpeza, com carteira, até 05/2026')
    expect(caixa('Quantas pessoas moram na casa').value).toBe('3')
    expect(screen.getAllByText('lido pela IA · confira').length).toBeGreaterThan(3)
    expect(screen.getAllByText('a IA não leu: confira no papel')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Conferi a senha do cofre com o papel' })).toBeTruthy()
    // Corrigir um campo lido tira a marca.
    escrever('Última atividade', 'diarista')
    expect(screen.getAllByText('lido pela IA · confira').length).toBeGreaterThan(2)
  })

  it('CA12 · letra não entra no CPF; CPF errado e data futura avisam; a idade aparece; o telefone é conferido', async () => {
    await abrir()
    fireEvent.change(caixa('CPF *'), { target: { value: 'abc000' } })
    expect(caixa('CPF *').value).toBe('000')
    escrever('CPF *', '000.000.001-92')
    expect(screen.getByText('CPF inválido: confira os 11 números.')).toBeTruthy()
    escrever('Data de nascimento *', '06/10/2026')
    expect(screen.getByText('Data em dd/mm/aaaa, sem letra e que não seja futura.')).toBeTruthy()
    escrever('Data de nascimento *', '10/03/1964')
    expect(screen.getByText('62 anos')).toBeTruthy()
    fireEvent.blur(caixa('Telefone / WhatsApp *'))
    expect(await screen.findByText('✓ conferido (celular)')).toBeTruthy()
  })

  it('CA8 · o formulário da ficha não tem campo de senha; a senha só entra pelo cofre, à parte', async () => {
    await abrir()
    const ficha = document.getElementById('ficha-de-atendimento') as HTMLFormElement
    expect(ficha.querySelector('input[type="password"]')).toBeNull()
    const cofre = screen.getByRole('form', { name: 'Cofre da senha do gov.br' })
    expect(cofre.querySelector('input[type="password"]')).toBeTruthy()
    expect(ficha.contains(cofre)).toBe(false)
  })

  it('CA5, CA6 e CA10 · com os obrigatórios, salva, diz o que ficou em branco e grava no histórico', async () => {
    await abrir('antonio-exemplo')
    escrever('Data de nascimento *', '10/03/1964')
    expect(salvar().disabled).toBe(false)
    fireEvent.click(salvar())
    expect(await screen.findByRole('heading', { name: '✓ Ficha salva às 14:32' })).toBeTruthy()
    expect(screen.getByText(/Ficou em branco: Endereço, Quantas pessoas moram na casa, Última atividade, Desde quando está sem trabalhar e O que já pediu ao INSS\./)).toBeTruthy()
    const antonio = await obterFicha('antonio-exemplo')
    expect(antonio?.historico.at(-1)?.oQue).toMatch(/^Salvou a ficha de atendimento \(papel GGV, conferida\); em branco:/)
  })

  it('CPF de outra ficha não grava e avisa de quem é', async () => {
    await abrir()
    escrever('CPF *', CPF_DE_TESTE)
    escrever('Data de nascimento *', '01/02/1950')
    fireEvent.click(salvar())
    expect((await screen.findByRole('alert')).textContent).toBe('Este CPF já é da ficha de Antônio Exemplo: confira o número no papel.')
  })

  it('CA1 · no tablet, uma pergunta por vez, com "Voltar", "Próxima" e o cofre no fim', async () => {
    await abrir('antonio-exemplo', true)
    expect(screen.getByText('Pergunta 1 de 11')).toBeTruthy()
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
    expect(caixa('Qual é o seu nome completo?').value).toBe('Antônio Exemplo')
    const proxima = () => screen.getByRole('button', { name: 'Próxima' }) as HTMLButtonElement
    fireEvent.click(proxima())
    expect(caixa('Qual é o seu CPF?').value).toBe('000.000.001-91')
    fireEvent.click(proxima())
    expect(proxima().disabled).toBe(true)
    escrever('Qual é a sua data de nascimento?', '10/03/1964')
    fireEvent.click(proxima())
    for (let i = 0; i < 7; i++) fireEvent.click(proxima())
    expect(screen.getByText('Pergunta 11 de 11')).toBeTruthy()
    expect(screen.getByText('Você sabe a senha do gov.br?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByText('Pergunta 10 de 11')).toBeTruthy()
    fireEvent.click(proxima())
    fireEvent.click(salvar())
    expect(await screen.findByText('Obrigado! Sua ficha foi salva. Devolva o tablet ao balcão.')).toBeTruthy()
    await waitFor(async () => expect((await obterFicha('antonio-exemplo'))?.historico.at(-1)?.quem).toBe('Cliente (tablet)'))
  })
})
