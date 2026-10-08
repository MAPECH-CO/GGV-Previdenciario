import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CPF_DE_TESTE, telefoneDeExemplo } from '../dados/exemplo.ts'
import { buscarNoBalcao, configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { MENSAGEM } from '../regras/formularios.ts'
import { NovoCliente } from './NovoCliente.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

const PRETENDE = 'Quer saber da aposentadoria por idade.'
const campo = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement
const digitar = (rotulo: string, valor: string) => fireEvent.change(campo(rotulo), { target: { value: valor } })
const botao = (nome: string) => screen.getByRole('button', { name: nome }) as HTMLButtonElement
const quantas = async (nome: string) => (await buscarNoBalcao(nome)).length

function abrir() {
  const navegar = vi.fn()
  render(<NovoCliente navegar={navegar} />)
  return navegar
}

function preencher(nome: string, telefone: string) {
  digitar('Nome completo *', nome)
  digitar('Idade *', '58')
  digitar('Telefone / WhatsApp *', telefone)
  digitar('O que a pessoa pretende *', PRETENDE)
}

describe('Novo cliente', () => {
  it('CA11 · mostra os blocos do Figma 73:371, o catálogo de benefícios e as duas saídas', () => {
    abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Novo cliente')
    expect(screen.getByText('D1.01 · reconhecer quem chegou')).toBeTruthy()
    for (const rotulo of ['CPF (opcional)', 'E-mail (opcional)', 'Cidade / UF', 'Como chegou (lista do escritório)', 'Observação']) {
      expect(campo(rotulo), rotulo).toBeTruthy()
    }
    const beneficios = within(screen.getByRole('radiogroup', { name: 'Benefício de interesse (opcional)' }))
    for (const nome of ['Curatela', 'Isenção e Restituição de Imposto de Renda', 'Empréstimo Indevido', 'Seguro de Vida', 'Cartão RMC']) expect(beneficios.getByRole('radio', { name: nome })).toBeTruthy()
    expect(beneficios.getByRole('radio', { name: 'Não sei ainda' }).getAttribute('aria-checked')).toBe('true')
    expect(botao('Salvar e marcar a entrevista')).toBeTruthy()
    expect(botao('Salvar apenas')).toBeTruthy()
    expect(within(screen.getByRole('region', { name: 'O que acontece depois' })).getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByText(/CPF repetido abre a ficha que já existe/)).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/senha|cofre/i)
  })

  it('CA3 e CA15 · sem o mínimo não salva; CPF é opcional; letra não entra; CPF e telefone errados avisam', () => {
    abrir()
    fireEvent.click(botao('Salvar apenas'))
    expect(screen.getByText('Confira os campos marcados em vermelho.')).toBeTruthy()
    for (const mensagem of [MENSAGEM.nome, MENSAGEM.idade, MENSAGEM.telefone, MENSAGEM.pretende]) expect(screen.getByText(mensagem)).toBeTruthy()
    expect(screen.queryByText(MENSAGEM.cpf)).toBeNull()

    digitar('Idade *', '5a8')
    expect(campo('Idade *').value).toBe('58')
    digitar('CPF (opcional)', `${CPF_DE_TESTE.slice(0, 3)}x`)
    expect(campo('CPF (opcional)').value).toBe(CPF_DE_TESTE.slice(0, 3))
    digitar('CPF (opcional)', `${CPF_DE_TESTE.slice(0, 10)}2`)
    fireEvent.blur(campo('CPF (opcional)'))
    expect(screen.getByText(MENSAGEM.cpf)).toBeTruthy()
    digitar('Telefone / WhatsApp *', 'x91234-5678')
    expect(campo('Telefone / WhatsApp *').value).toBe('91234-5678')
    fireEvent.blur(campo('Telefone / WhatsApp *'))
    expect(screen.getByText(MENSAGEM.telefone)).toBeTruthy()
  })

  it('CA6 · CPF que já existe avisa em "Já existe?" e salvar abre a ficha que já existe, sem criar outra', async () => {
    const navegar = abrir()
    preencher('Antônio Exemplo', telefoneDeExemplo(1))
    digitar('CPF (opcional)', CPF_DE_TESTE)
    fireEvent.blur(campo('CPF (opcional)'))
    expect(await screen.findByText(/Este CPF já está na ficha de/)).toBeTruthy()
    fireEvent.click(botao('Salvar apenas'))
    await waitFor(() => expect(navegar).toHaveBeenCalledWith('/clientes/antonio-exemplo'))
    expect(await quantas('Antônio')).toBe(1)
  })

  it('CA9 e CA14 · telefone de outra ficha só avisa; com "É outra pessoa" grava e cria uma pasta só', async () => {
    configurarExemplo({ latencia: 5 })
    const navegar = abrir()
    preencher('Natália Exemplo', telefoneDeExemplo(3))
    fireEvent.blur(campo('Telefone / WhatsApp *'))
    const lista = within(await screen.findByRole('list', { name: 'Fichas parecidas' }))
    expect(lista.getAllByRole('listitem').map((li) => li.textContent?.split(' · ')[0])).toEqual(['Natália Exemplo', 'Nair Exemplo'])

    fireEvent.click(botao('Salvar apenas'))
    expect(await screen.findByText(/Há ficha parecida/)).toBeTruthy()
    expect(await quantas('natalia')).toBe(1)

    fireEvent.click(screen.getByRole('checkbox', { name: 'É outra pessoa' }))
    fireEvent.click(botao('Salvar apenas'))
    expect(await screen.findByText('criando a pasta…')).toBeTruthy()
    await waitFor(() => expect(navegar).toHaveBeenCalledWith('/clientes/natalia-exemplo-2'))
    const nova = await obterFicha('natalia-exemplo-2')
    expect(nova?.pastaId).toBe('drive-natalia-exemplo-2')
    expect(nova?.historico[0].oQue).toContain('confirmando que é outra pessoa')
  })

  it('CA12, CA13 e CA14 · indicação pede quem indicou; duas pastas com o nome perguntam qual; a anotação vai para "Últimos contatos"', async () => {
    const navegar = abrir()
    preencher('Rosa Exemplo', telefoneDeExemplo(51))
    fireEvent.change(campo('Como chegou (lista do escritório)'), { target: { value: 'indicacao' } })
    fireEvent.click(botao('Salvar e marcar a entrevista'))
    expect(screen.getByText(MENSAGEM.indicadoPor)).toBeTruthy()
    digitar('Quem indicou *', 'Maria Exemplo')
    fireEvent.click(botao('Salvar e marcar a entrevista'))

    const escolha = within(await screen.findByRole('group', { name: /Há 2 pastas no Drive/ }))
    expect(escolha.getAllByRole('radio')).toHaveLength(3)
    fireEvent.click(escolha.getByRole('radio', { name: 'Scanner/antigos/ROSA EXEMPLO' }))
    fireEvent.click(escolha.getByRole('button', { name: 'Usar esta pasta' }))
    await waitFor(() => expect(navegar).toHaveBeenCalledWith('/agenda/marcar/rosa-exemplo'))

    const rosa = await obterFicha('rosa-exemplo')
    expect(rosa).toMatchObject({ situacao: 'lead', comoChegou: 'indicacao', indicadoPor: 'Maria Exemplo', pastaId: 'drive-rosa-2' })
    expect(rosa?.contatos).toEqual([{ data: '2026-10-05', canal: 'Presencial (balcão)', texto: PRETENDE }])
  })

  it('CA16 · dois cliques em "Salvar apenas" gravam uma ficha só', async () => {
    abrir()
    preencher('Rosa Exemplo', telefoneDeExemplo(51))
    const salvar = botao('Salvar apenas')
    fireEvent.click(salvar)
    expect(salvar.textContent).toBe('salvando…')
    expect(salvar.disabled).toBe(true)
    fireEvent.click(salvar)
    expect(await screen.findByRole('group', { name: /pastas no Drive/ })).toBeTruthy()
    expect(await quantas('rosa')).toBe(1)
  })
})
