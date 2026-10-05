import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { lerSegundaFichaEmPapel, registrarAnalise, salvarSegundaFicha } from '../dados/segundaFicha.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { FichaCliente } from './FichaCliente.tsx'
import { PrepararEntrevista } from './PrepararEntrevista.tsx'
import { SegundaFicha } from './SegundaFicha.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function abrir(tablet = false) {
  render(<SegundaFicha fichaId="josefa-exemplo" tablet={tablet} />)
  await screen.findByRole('heading', { level: 1, name: tablet ? /Conte como foi/ : /Preencher segunda ficha/ })
}

const enviar = () => screen.getByRole('button', { name: 'Enviar segunda ficha' }) as HTMLButtonElement

describe('Segunda ficha · tela', () => {
  it('CA5 e CA8 · as seções do modelo, a 1 vinda da ficha única e a médica fora da visão do Atendimento', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Josefa Exemplo · Preencher segunda ficha')
    expect(screen.getByText('Preenchida pela própria cliente · auxílio acidentário')).toBeTruthy()
    for (const titulo of [
      '1. Atendimento e dados pessoais',
      '2. Dados profissionais',
      '3. Benefício e INSS',
      '4. Acidente',
      '5. Dados médicos',
      '6. Histórico do caso contado pelo cliente',
    ]) {
      expect(screen.getByRole('heading', { name: titulo }), titulo).toBeTruthy()
    }
    const medica = within(screen.getByRole('region', { name: '5. Dados médicos' }))
    expect(medica.getByText(/Só o Jurídico vê/)).toBeTruthy()
    expect(medica.queryByRole('textbox')).toBeNull()
    expect(screen.queryByLabelText('Doenças')).toBeNull()
    expect(enviar().disabled).toBe(true)
    expect(screen.getByText('Falta: o que aconteceu (seção 6).')).toBeTruthy()
  })

  it('CA6 e CA7 · o papel no scanner preenche para conferir, sem a seção médica, e a senha do Meu INSS vai ao cofre', async () => {
    await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Digitalizar a segunda ficha (scanner simulado)' }))
    expect(await screen.findByText(/Ficha de atendimento AUXILIO ACIDENTE - Josefa Exemplo - 2026-10-05.pdf em Documentos pessoais/)).toBeTruthy()
    expect((screen.getByLabelText('Empresa') as HTMLInputElement).value).toBe('Exemplo Indústria Ltda')
    expect((screen.getByLabelText('Houve CAT?') as HTMLSelectElement).value).toBe('sim')
    expect(screen.getByRole('button', { name: 'Conferi a senha do cofre com o papel' })).toBeTruthy()
    expect(document.body.textContent).not.toContain('perda de força')
    fireEvent.click(enviar())
    expect(await screen.findByRole('heading', { name: '✓ Segunda ficha salva às 14:32' })).toBeTruthy()
    expect((await obterFicha('josefa-exemplo'))?.segundaFicha?.respostas.doencas).toBe('dor e perda de força na mão')
    expect(document.body.textContent).not.toContain('perda de força')
  })

  it('datas e NB pela biblioteca campos: letra não entra, data futura e NB curto avisam', async () => {
    await abrir()
    fireEvent.change(screen.getByLabelText('Data do acidente'), { target: { value: '0a1/10/2026' } })
    expect((screen.getByLabelText('Data do acidente') as HTMLInputElement).value).toBe('01/10/2026')
    fireEvent.change(screen.getByLabelText('Data de entrada do requerimento (DER)'), { target: { value: '06/10/2026' } })
    fireEvent.blur(screen.getByLabelText('Data de entrada do requerimento (DER)'))
    expect(screen.getByText('Data em dd/mm/aaaa, sem letra e que não seja futura.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Número do benefício (NB)'), { target: { value: '123' } })
    fireEvent.blur(screen.getByLabelText('Número do benefício (NB)'))
    expect(screen.getByText('Número do benefício com 10 números.')).toBeTruthy()
  })

  it('CA1 · no tablet, a cliente preenche uma parte por tela, com a seção médica', async () => {
    await abrir(true)
    expect(screen.getByText('Parte 1 de 6')).toBeTruthy()
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    expect(screen.getByText('Parte 5 de 6')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Doenças'), { target: { value: 'dor no punho' } })
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    fireEvent.change(screen.getByLabelText('O que aconteceu *'), { target: { value: 'Caí da escada no trabalho.' } })
    fireEvent.click(enviar())
    expect(await screen.findByText('Obrigado! Sua ficha foi salva. Devolva o tablet ao balcão.')).toBeTruthy()
    await waitFor(async () => expect((await obterFicha('josefa-exemplo'))?.segundaFicha?.respostas.doencas).toBe('dor no punho'))
  })

  it('CA2 e CA8 · a advogada vê as duas fichas juntas, com a seção médica; a ficha do cliente, só que foi preenchida', async () => {
    await registrarAnalise('josefa-entrevista', { acidentario: true })
    const leitura = await lerSegundaFichaEmPapel('josefa-exemplo')
    await salvarSegundaFicha('josefa-exemplo', leitura.respostas, 'papel')
    render(<PrepararEntrevista agendamentoId="josefa-entrevista" />)
    const segunda = within(await screen.findByRole('region', { name: 'Segunda ficha (auxílio acidentário)' }))
    expect(segunda.getByText('dor e perda de força na mão')).toBeTruthy()
    expect(segunda.getByText('Direito')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir a segunda ficha' })).toBeTruthy()
    expect(screen.queryByText('A cliente ainda não preencheu a segunda ficha (auxílio acidentário).')).toBeNull()
    screen.getByRole('link', { name: 'Iniciar entrevista (Transcrição)' })

    render(<FichaCliente id="josefa-exemplo" />)
    expect(await screen.findByText(/Segunda ficha \(auxílio acidentário\): preenchida em 05\/10\/2026/)).toBeTruthy()
  })
})
