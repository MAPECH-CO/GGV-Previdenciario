import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as contrato from '../dados/contrato.ts'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { PrepararContrato } from './PrepararContrato.tsx'

// GGVP-136 · o kit de verdade na tela de preparar o contrato. O servidor de exemplo não gera Word: a resposta do servidor
// (o que falta na ficha, o modelo que falta) entra pelo `gerarContrato`, e o contrato do servidor liga `kitDeVerdade`.
vi.mock('../dados/contrato.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../dados/contrato.ts')>()
  return { ...real, gerarContrato: vi.fn(real.gerarContrato), kitDeVerdade: vi.fn(() => false) }
})

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
  vi.mocked(contrato.kitDeVerdade).mockReturnValue(false)
})

async function abrirComoAntonio() {
  const { processo } = await contrato.fecharContrato('antonio-exemplo', 'aposentadoria-idade')
  render(<PrepararContrato processoId={processo.id} />)
  await screen.findByRole('heading', { level: 1, name: /Preparar contrato/ })
}

const escrever = (rotulo: string, valor: string) => {
  const caixa = screen.getByLabelText(rotulo)
  fireEvent.change(caixa, { target: { value: valor } })
  fireEvent.blur(caixa)
}
const conferirTudo = () => {
  for (const nome of [
    'Campos certos e completos',
    'Datas feitas à mão serão preenchidas na assinatura',
    'Ficha LOAS: cliente ou representante legal (se aplicável)',
    'A página do Código Penal não tem assinatura',
  ]) {
    fireEvent.click(screen.getByRole('checkbox', { name: nome }))
  }
}
/** Tudo pronto na tela para gerar: o que falta do exemplo preenchido, as quatro conferências marcadas. */
function prepararParaGerar() {
  fireEvent.click(screen.getByRole('radio', { name: 'Não, corrigir campos' }))
  escrever('RG *', '12.345.678-X')
  escrever('Endereço *', 'Rua Exemplo, 1 · São Paulo/SP')
  fireEvent.change(screen.getByLabelText('O que corrigir *'), { target: { value: 'faltavam o RG e o endereço' } })
  conferirTudo()
}

describe('GGVP-136 · o kit de verdade na tela de preparar o contrato', () => {
  it('CA4 · o servidor diz o que falta na ficha: o kit não é gerado e a lista vem com o atalho para completar a ficha', async () => {
    await abrirComoAntonio()
    prepararParaGerar()
    vi.mocked(contrato.gerarContrato).mockResolvedValueOnce({ resultado: 'faltam-na-ficha', faltam: ['Bairro', 'CEP'] })
    fireEvent.click(screen.getByRole('button', { name: 'Gerar contrato' }))
    const aviso = await screen.findByText('O kit não foi gerado. Falta na ficha: Bairro, CEP.')
    expect(aviso.closest('[role="alert"]')?.querySelector('a')?.getAttribute('href')).toBe('/clientes/antonio-exemplo')
    expect(screen.getByRole('link', { name: 'Completar a ficha' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Contrato gerado/ })).toBeNull()
  })

  it('o aviso some na tentativa seguinte', async () => {
    await abrirComoAntonio()
    prepararParaGerar()
    vi.mocked(contrato.gerarContrato).mockResolvedValueOnce({ resultado: 'faltam-na-ficha', faltam: ['CEP'] })
    fireEvent.click(screen.getByRole('button', { name: 'Gerar contrato' }))
    await screen.findByText('O kit não foi gerado. Falta na ficha: CEP.')
    fireEvent.click(screen.getByRole('button', { name: 'Gerar contrato' }))
    expect(await screen.findByRole('heading', { name: '✓ Contrato gerado · versão 1' })).toBeTruthy()
    expect(screen.queryByText(/O kit não foi gerado/)).toBeNull()
  })

  it('sem modelo: a tela diz qual falta e quem sobe; sem linha de modelo, manda avisar a gestão', async () => {
    await abrirComoAntonio()
    prepararParaGerar()
    vi.mocked(contrato.gerarContrato).mockResolvedValueOnce({ resultado: 'sem-modelo', modelo: 'Modelo 8 (kit consumidor)' })
    fireEvent.click(screen.getByRole('button', { name: 'Gerar contrato' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Falta o Modelo 8 (kit consumidor): peça à Sênior para subir o modelo na Configuração do escritório.')
    vi.mocked(contrato.gerarContrato).mockResolvedValueOnce({ resultado: 'sem-modelo' })
    fireEvent.click(screen.getByRole('button', { name: 'Gerar contrato' }))
    expect(await screen.findByText('Este kit ainda não tem modelo do Word. Avise a gestão.')).toBeTruthy()
  })

  it('CA3 · no contrato do servidor, a nacionalidade entra como campo do contrato e trava "Gerar contrato" até a pessoa escrever', async () => {
    vi.mocked(contrato.kitDeVerdade).mockReturnValue(true)
    await abrirComoAntonio()
    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }))
    expect(screen.getByText('Falta: Nacionalidade, RG e Endereço.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Não, corrigir campos' }))
    escrever('Nacionalidade *', 'brasileiro')
    expect(screen.getByText('Escreva o que corrigir.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('O que corrigir *'), { target: { value: 'faltavam os dados' } })
    expect(screen.getByText('Falta: RG e Endereço.')).toBeTruthy()
  })
})
