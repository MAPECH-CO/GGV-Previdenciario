import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { fecharContrato } from '../dados/contrato.ts'
import { configurarExemplo, zerarExemplo } from '../dados/servidor.ts'
import { PrepararContrato } from './PrepararContrato.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function abrir(processoId: string) {
  render(<PrepararContrato processoId={processoId} />)
  await screen.findByRole('heading', { level: 1, name: /Preparar contrato/ })
}

const documentos = () => within(screen.getByRole('list', { name: 'Documentos do kit' })).getAllByRole('listitem').map((li) => li.textContent)

describe('Preparar contrato · o kit do benefício (GGVP-65)', () => {
  it('CA1 e CA5 · a Cleide fechou a Aposentadoria PCD: o kit das aposentadorias pelo Contrato Completo 2026', async () => {
    await abrir('cleide-exemplo-1')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Cleide Exemplo · Preparar contrato')
    expect(screen.getByText('PCD Aposentadoria por Contribuição · pelo Contrato Completo 2026')).toBeTruthy()
    expect(screen.getByText(/Gere o contrato de Cleide pelo Contrato Completo 2026, com o kit de Aposentadorias: 6 documentos/)).toBeTruthy()
    expect(screen.getByText(/honorários \(20% do êxito \(ad exitum\)\)/)).toBeTruthy()
    expect(documentos()).toEqual([
      '✓Contrato de honorários',
      '✓Procuração',
      '✓Declaração de hipossuficiência',
      '✓Declaração de residência',
      '✓Termo INSS · aposentadorias, CTC, recursos',
      '✓Código Penal',
    ])
    expect(screen.getByText('Assinam: o cliente.')).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Condições do caso (LOAS)' })).toBeNull()
  })

  it('CA2 e CA8 · no LOAS, a ficha de grupo familiar vai sempre; representado e declarações entram pela condição', async () => {
    const { processo } = await fecharContrato('josefa-exemplo', 'loas-idoso')
    await abrir(processo.id)
    expect(documentos().at(-1)).toBe('✓Ficha de grupo familiar · obrigatória em todo LOAS')
    const condicoes = screen.getByRole('group', { name: 'Condições do caso (LOAS)' })
    fireEvent.click(within(condicoes).getByRole('checkbox', { name: 'O cliente é representado pelo genitor ou pela genitora' }))
    expect(await screen.findByText('Assinam: o representado (cliente) e o genitor ou a genitora (representante legal).')).toBeTruthy()
    expect(screen.getByText(/^LOAS representado \(genitor\)$/)).toBeTruthy()
    fireEvent.click(within(condicoes).getByRole('checkbox', { name: 'Vive em união estável' }))
    expect(await screen.findByText('Declaração de união estável')).toBeTruthy()
    expect(documentos().at(-1)).toBe('✓Declaração de união estável · vive em união estávelcondição do caso')
  })

  it('CA3 · Isenção de IR: sem a declaração de hipossuficiência, pelo modelo 7', async () => {
    const { processo } = await fecharContrato('antonio-exemplo', 'isencao-ir')
    await abrir(processo.id)
    expect(screen.getByText('Isenção e Restituição de Imposto de Renda · pelo modelo 7')).toBeTruthy()
    expect(documentos()).toEqual(['✓Contrato de honorários', '✓Procuração', '✓Termo INSS · isenção de IR', '✓Código Penal', '✓Declaração de residência'])
  })

  it('benefício sem kit cadastrado: a tela avisa e nada é gerado', async () => {
    const { processo } = await fecharContrato('antonio-exemplo', 'pensao-morte')
    await abrir(processo.id)
    expect(screen.getByText(/Pensão por Morte ainda não tem kit cadastrado. A gestão cadastra/)).toBeTruthy()
    expect(screen.queryByRole('list', { name: 'Documentos do kit' })).toBeNull()
  })

  it('contrato que não existe', async () => {
    render(<PrepararContrato processoId="nao-existe" />)
    expect(await screen.findByRole('heading', { name: 'Contrato não encontrado' })).toBeTruthy()
  })
})
