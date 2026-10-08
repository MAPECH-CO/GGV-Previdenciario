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

const linha = (rotulo: string) => screen.getByText(rotulo, { selector: 'dt' }).parentElement?.textContent
const gerar = () => screen.getByRole('button', { name: 'Gerar contrato' }) as HTMLButtonElement
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
const escrever = (rotulo: string, valor: string) => {
  const caixa = screen.getByLabelText(rotulo)
  fireEvent.change(caixa, { target: { value: valor } })
  fireEvent.blur(caixa)
}

describe('Preparar contrato · preencher pelo modelo e conferir (GGVP-69)', () => {
  it('CA1, CA5, CA9, CA10 e CA11 · cada campo com de onde veio, o modelo e os honorários, sem representante', async () => {
    await abrir('cleide-exemplo-1')
    const documento = screen.getByRole('region', { name: 'Documento preenchido' })
    expect(within(documento).getByText(/modelo MODELOS ZAPSIGN · PREV\/contrato-completo-2026-v1, o mesmo no ZapSign/)).toBeTruthy()
    expect(linha('Nome completo')).toBe('Nome completoCleide Exemplocadastro')
    expect(linha('CPF')).toBe('CPFfaltacadastro')
    expect(linha('Telefone')).toBe('Telefone(11) 90000-0005cadastro')
    expect(linha('Benefício')).toBe('BenefícioPCD Aposentadoria por Contribuiçãocaso')
    expect(linha('Parte contrária')).toBe('Parte contráriaInstituto Nacional do Seguro Social (INSS)caso')
    expect(linha('Honorários')).toBe('Honorários20% do êxito (ad exitum)do modelo, sem campo para digitar')
    expect(within(documento).queryByText(/representante/)).toBeNull()
  })

  it('CA2 · a lista "O que conferir"', async () => {
    await abrir('cleide-exemplo-1')
    const lista = within(screen.getByRole('region', { name: 'O que conferir' })).getAllByRole('listitem').map((li) => li.textContent)
    expect(lista).toEqual([
      'As datas feitas à mão: no papel saem em branco, para preencher na assinatura, menos o contrato de honorários; no ZapSign, vale a data da assinatura.',
      'Na ficha LOAS: se quem assina é o cliente ou o representante legal.',
      'A página do Código Penal vai sem assinatura.',
    ])
  })

  it('CA6 e CA7 · "Gerar contrato" parado sem a decisão, com campo vazio e sem as quatro conferências', async () => {
    await abrir('cleide-exemplo-1')
    expect(gerar().disabled).toBe(true)
    expect(screen.getByText('Responda se os documentos foram aprovados.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }))
    expect(screen.getByText('Falta: Estado civil, Profissão, CPF, RG e Endereço.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Não, corrigir campos' }))
    expect(screen.getByText('Escreva o que corrigir.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('O que corrigir *'), { target: { value: 'faltava o RG' } })
    expect(screen.getByText('Falta: Estado civil, Profissão, CPF, RG e Endereço.')).toBeTruthy()
    expect(gerar().disabled).toBe(true)
  })

  it('CA3 · corrigir: o campo vira caixa, passa pela biblioteca campos e o CPF de outra ficha não grava', async () => {
    await abrir('cleide-exemplo-1')
    fireEvent.click(screen.getByRole('radio', { name: 'Não, corrigir campos' }))
    expect(screen.queryByLabelText('Benefício *')).toBeNull()
    escrever('CPF *', '000.000.001-92')
    expect(screen.getByText('CPF inválido: confira os 11 números.')).toBeTruthy()
    escrever('CPF *', '000.000.001-91')
    escrever('Estado civil *', 'Casada')
    escrever('Profissão *', 'costureira')
    escrever('RG *', '12.345.678-X')
    escrever('Endereço *', 'Rua Exemplo, 5 · São Paulo/SP')
    fireEvent.change(screen.getByLabelText('O que corrigir *'), { target: { value: 'faltavam os dados pessoais' } })
    conferirTudo()
    fireEvent.click(gerar())
    expect(await screen.findByText('Este CPF já está na ficha de Antônio Exemplo.')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Contrato gerado/ })).toBeNull()
  })

  it('CA3, CA6 e CA7 · com os campos corrigidos e as quatro conferências, gera e segue para colher a assinatura', async () => {
    const { processo } = await fecharContrato('antonio-exemplo', 'aposentadoria-idade')
    await abrir(processo.id)
    fireEvent.click(screen.getByRole('radio', { name: 'Não, corrigir campos' }))
    escrever('RG *', '12.345.678-X')
    escrever('Endereço *', 'Rua Exemplo, 1 · São Paulo/SP')
    fireEvent.change(screen.getByLabelText('O que corrigir *'), { target: { value: 'faltavam o RG e o endereço' } })
    expect(screen.getByText('Marque as quatro conferências.')).toBeTruthy()
    conferirTudo()
    expect(gerar().disabled).toBe(false)
    fireEvent.click(gerar())
    expect(await screen.findByRole('heading', { name: '✓ Contrato gerado · versão 1' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Colher assinatura' }).getAttribute('href')).toBe(`/contrato/${processo.id}/assinatura`)
    expect(linha('RG')).toBe('RG12.345.678-Xcorrigido aqui')
    expect(linha('Endereço')).toBe('EndereçoRua Exemplo, 1 · São Paulo/SPcorrigido aqui')
    expect((screen.getByRole('radio', { name: 'Sim' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('CA1 e CA9 · no LOAS representado, os dados do representante entram para conferir', async () => {
    const { processo } = await fecharContrato('josefa-exemplo', 'loas-idoso')
    await abrir(processo.id)
    fireEvent.click(screen.getByRole('checkbox', { name: 'O cliente é representado pelo genitor ou pela genitora' }))
    expect(await screen.findByText('Nome do representante')).toBeTruthy()
    expect(linha('Parentesco do representante')).toBe('Parentesco do representantefaltacaso')
  })
})
