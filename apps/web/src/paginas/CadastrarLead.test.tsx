import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { encerrarGravacao, iniciarGravacao, transcrever } from '../dados/entrevista.ts'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { CadastrarLead } from './CadastrarLead.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function entrevistaTranscrita() {
  const g = await iniciarGravacao('josefa-entrevista', { avisei: true })
  await encerrarGravacao(g.id, { aos: 140, online: true })
  await transcrever(g.id)
}

async function abrir(fichaId = 'josefa-exemplo') {
  render(<CadastrarLead fichaId={fichaId} />)
  await screen.findByRole('heading', { level: 1, name: /Cadastrar lead/ })
}

const campo = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement
const botao = (nome: string) => screen.getByRole('button', { name: nome }) as HTMLButtonElement

function preencher(rotulo: string, valor: string) {
  fireEvent.change(campo(rotulo), { target: { value: valor } })
  fireEvent.blur(campo(rotulo))
}

describe('Cadastrar lead · tela do passo', () => {
  it('CA1, CA3 e CA8 · vem preenchido pela ficha e pela entrevista; a diferença do telefone para escolher; o que falta', async () => {
    await entrevistaTranscrita()
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Josefa Exemplo · Cadastrar lead')
    expect(screen.getByText('Após a entrevista')).toBeTruthy()
    expect(campo('Nome completo *').value).toBe('Josefa Exemplo')
    expect(campo('Estado civil *').value).toBe('União estável')
    expect(campo('Profissão *').value).toBe('Auxiliar de limpeza')
    expect(screen.getAllByText('da entrevista · confira')).toHaveLength(2)
    const divergencia = screen.getByRole('region', { name: 'A ficha e a entrevista dizem diferente' })
    expect(within(divergencia).getByRole('radio', { name: 'Ficha: (11) 90000-0002' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(within(divergencia).getByRole('radio', { name: 'Entrevista: (11) 90000-0021' }))
    expect(campo('Telefone *').value).toBe('(11) 90000-0021')
    expect(botao('Salvar cadastro').disabled).toBe(true)
    expect(screen.getByText('Falta: CPF, RG, CEP, Rua e número, Bairro, Cidade e UF.')).toBeTruthy()
    expect(screen.getByText(/Ainda não pode ser gerado\. Falta: CPF, estado civil, profissão, RG e endereço\./)).toBeTruthy()
  })

  it('CA5 e CA10 · CPF com dígito errado, a idade pela data de nascimento e o endereço pelo CEP', async () => {
    await abrir()
    preencher('CPF *', '000.000.001-92')
    expect(screen.getByText('CPF inválido: confira os 11 números.')).toBeTruthy()
    preencher('Data de nascimento', '10/03/1958')
    expect(screen.getByText('68 anos')).toBeTruthy()
    preencher('CEP *', '01001000')
    expect(await screen.findByText('Endereço pelo CEP (ViaCEP simulado): confira e complete o número.')).toBeTruthy()
    expect(campo('CEP *').value).toBe('01001-000')
    expect(campo('Rua e número *').value).toBe('Praça da Sé, ')
    expect([campo('Bairro *').value, campo('Cidade *').value, campo('UF *').value]).toEqual(['Sé', 'São Paulo', 'SP'])
    expect((screen.getByLabelText('Profissão *') as HTMLSelectElement).options[1].textContent).toBe('Agricultor(a) / trabalhador(a) rural')
  })

  it('CA2 · CPF de outra ficha: mostra o cadastro existente e não cria outro', async () => {
    await entrevistaTranscrita()
    await abrir()
    preencher('CPF *', '00000000191')
    preencher('RG *', '1234567')
    preencher('CEP *', '01001-000')
    await screen.findByText(/Endereço pelo CEP/)
    preencher('Rua e número *', 'Praça da Sé, 1')
    fireEvent.click(botao('Salvar cadastro'))
    const alerta = await screen.findByRole('alert')
    expect(alerta.textContent).toContain('Este CPF já é do cadastro de Antônio Exemplo. O portal não cria outro.')
    expect(within(alerta).getByRole('link', { name: 'Abrir o cadastro existente' }).getAttribute('href')).toBe('/clientes/antonio-exemplo')
  })

  it('CA6 · com representante legal, os campos dele também entram no que falta', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('checkbox', { name: /Tem representante legal/ }))
    expect(campo('Nome completo do representante *')).toBeTruthy()
    expect(screen.getByText(/Nome completo do representante, CPF do representante, RG do representante, Parentesco do representante/)).toBeTruthy()
  })

  it('CA4 e CA9 · salvo na mesma ficha, com o kit liberado', async () => {
    await abrir('antonio-exemplo')
    preencher('RG *', '12.345.678-9')
    fireEvent.change(screen.getByLabelText('Profissão *'), { target: { value: 'Porteiro(a)' } })
    preencher('CEP *', '01001-000')
    await screen.findByText(/Endereço pelo CEP/)
    preencher('Rua e número *', 'Praça da Sé, 10')
    fireEvent.click(botao('Salvar cadastro'))
    expect(await screen.findByRole('heading', { name: '✓ Cadastro salvo na mesma ficha (cliente)' })).toBeTruthy()
    expect(screen.getByText('Pode ser gerado: o cadastro tem os campos do modelo.')).toBeTruthy()
  })

  it('CA11 · a outra aba vê "está editando" na hora', async () => {
    await abrir()
    render(<CadastrarLead fichaId="josefa-exemplo" />)
    const avisos = await screen.findAllByText(/Você \(Advogada\), em outra aba, está editando esta ficha agora/)
    expect(avisos.length).toBeGreaterThan(0)
  })
})
