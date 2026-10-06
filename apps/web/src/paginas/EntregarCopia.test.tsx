import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { obterContrato } from '../dados/contrato.ts'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { EntregarCopia } from './EntregarCopia.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function abrir(processoId = 'cleide-exemplo-2') {
  render(<EntregarCopia processoId={processoId} />)
  await screen.findByRole('heading', { level: 1, name: /Entregar cópia do contrato/ })
}

const botao = (nome: string) => screen.getByRole('button', { name: nome }) as HTMLButtonElement
const escrever = (rotulo: string, valor: string) => {
  const caixa = screen.getByLabelText(rotulo)
  fireEvent.change(caixa, { target: { value: valor } })
  fireEvent.blur(caixa)
}

describe('Entregar cópia do contrato (GGVP-89)', () => {
  it('CA1 · a Cleide: o contrato assinado, a visita de hoje e "Imprimir cópia para o cliente"', async () => {
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Cleide Exemplo · Entregar cópia do contrato')
    expect(screen.getByText('contrato assinado 12/07 · visita ao escritório hoje 16:00')).toBeTruthy()
    expect(screen.getByText(/Imprima a cópia do contrato assinado e entregue numa pastinha para Cleide. Confira se é a versão assinada no ZapSign./)).toBeTruthy()
    expect(screen.getByText('Versão assinada: Contrato assinado - Cleide Exemplo - 2026-07-12 (ZapSign, com evidências).pdf')).toBeTruthy()
    fireEvent.click(botao('Imprimir cópia para o cliente'))
    expect(await screen.findByText(/Impressa em 05\/10\/2026 14:32 \(impressora simulada\)\./)).toBeTruthy()
  })

  it('CA3 e CA5 · "Registrar entrega" só com a confirmação, a data e quem recebeu; registrada, segue para o checklist', async () => {
    await abrir()
    expect(botao('Registrar entrega').disabled).toBe(true)
    expect(screen.getByText('Confirme que é a cópia impressa da versão assinada.')).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'É a cópia impressa da versão assinada *' }))
    expect(screen.getByText('Escreva quem recebeu.')).toBeTruthy()
    escrever('Quem recebeu *', 'C1eide')
    expect(screen.getByText('Escreva o nome completo, só com letras.')).toBeTruthy()
    escrever('Quem recebeu *', 'Cleide Exemplo')
    escrever('Entregue em (data) *', '06/10/2026')
    expect(screen.getByText('Data em dd/mm/aaaa, sem letra e que não seja futura.')).toBeTruthy()
    escrever('Entregue em (data) *', '05/10/2026')
    expect(botao('Registrar entrega').disabled).toBe(false)
    fireEvent.click(botao('Registrar entrega'))
    expect(await screen.findByRole('heading', { name: '✓ Entrega registrada' })).toBeTruthy()
    expect(screen.getByText(/Entregue em 05\/10 a Cleide Exemplo\. O caso segue para a conferência do checklist do benefício \(D1\.21\)\./)).toBeTruthy()
    expect((await obterContrato('cleide-exemplo-2'))?.contrato.etapa).toBe('entregue')
  })

  it('CA4 · entregar depois: a visita marcada entra na agenda', async () => {
    await abrir()
    escrever('Data da visita *', '04/10/2026')
    fireEvent.change(screen.getByLabelText('Hora *'), { target: { value: '10:30' } })
    fireEvent.click(botao('Marcar a visita na agenda'))
    expect(screen.getByText('Data em dd/mm/aaaa, de hoje em diante.')).toBeTruthy()
    escrever('Data da visita *', '08/10/2026')
    fireEvent.click(botao('Marcar a visita na agenda'))
    expect(await screen.findByText('Visita marcada: 08/10 às 10:30 · na agenda como "Entregar cópia do contrato".')).toBeTruthy()
    expect(screen.getByText('contrato assinado 12/07 · visita ao escritório 08/10 10:30')).toBeTruthy()
  })

  it('contrato que ainda não chegou à cópia', async () => {
    await abrir('nair-exemplo-1')
    expect(screen.getByText(/O contrato ainda não está pronto para a cópia/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Abrir a etapa do contrato' }).getAttribute('href')).toBe('/contrato/nair-exemplo-1/assinatura')
  })
})
