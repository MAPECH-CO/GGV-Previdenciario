import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { encerrarGravacao, iniciarGravacao, transcrever } from '../dados/entrevista.ts'
import { configurarExemplo, obterFicha, zerarExemplo } from '../dados/servidor.ts'
import { DefinirBeneficio } from './DefinirBeneficio.tsx'

beforeEach(() => {
  configurarExemplo({ agora: () => new Date(2026, 9, 5, 14, 32), latencia: 0 })
  zerarExemplo()
})

async function entrevista(agendamentoId: string) {
  const g = await iniciarGravacao(agendamentoId, { avisei: true })
  await encerrarGravacao(g.id, { aos: 140, online: true })
  await transcrever(g.id)
}

async function abrir(agendamentoId = 'josefa-entrevista') {
  render(<DefinirBeneficio agendamentoId={agendamentoId} />)
  await screen.findByRole('heading', { level: 1, name: /Definir benefício/ })
}

const botao = (nome: string) => screen.getByRole('button', { name: nome }) as HTMLButtonElement
const sugestao = () => within(screen.getByRole('region', { name: 'A IA sugere · você confere' }))

describe('Definir benefício · tela do passo', () => {
  it('CA2, CA4, CA5 e CA7 · a sugestão com a base, o porquê, a alternativa e os requisitos; confirmar só com a conferência', async () => {
    await entrevista('josefa-entrevista')
    await abrir()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Josefa Exemplo · Definir benefício')
    expect(screen.getByText('com apoio do acervo')).toBeTruthy()
    expect(sugestao().getByText('Auxílio por Incapacidade Temporária')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Casos parecidos do acervo' })).getAllByRole('listitem')).toHaveLength(3)
    expect(sugestao().getByText(/^Parecido com 2 casos deferidos/)).toBeTruthy()
    expect(sugestao().getByText('LOAS Idoso')).toBeTruthy()
    const requisitos = screen.getByRole('region', { name: 'Requisitos de Auxílio por Incapacidade Temporária' })
    expect(requisitos.textContent).toContain('Carência: 147 contribuições no CNIS; o mínimo é 12 (calculado por código, G19)')
    expect(requisitos.textContent).toContain('Afastamento: 126 dias desde 06/2026')
    expect(botao('Confirmar benefício').disabled).toBe(true)
    expect(screen.getByText('Escolha o benefício.')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Aceitar: Auxílio por Incapacidade Temporária' }))
    expect(botao('Confirmar benefício').disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi a recomendação com a entrevista' }))
    fireEvent.click(botao('Confirmar benefício'))
    expect(await screen.findByRole('heading', { name: '✓ Benefício definido: Auxílio por Incapacidade Temporária' })).toBeTruthy()
  })

  it('CA3 e CA5 · outro benefício da lista do escritório, com o motivo de recusar a sugestão no histórico', async () => {
    await entrevista('josefa-entrevista')
    await abrir()
    fireEvent.click(screen.getByRole('radio', { name: 'Outro benefício' }))
    const lista = screen.getByLabelText('Benefício definido *') as HTMLSelectElement
    expect([...lista.options].map((o) => o.textContent)).toContain('LOAS Deficiente')
    fireEvent.change(lista, { target: { value: 'aposentadoria-idade' } })
    expect(screen.getByRole('region', { name: 'Requisitos de Aposentadoria por Idade' }).textContent).toContain('não tem requisito numérico')
    fireEvent.change(screen.getByLabelText('Por que não a sugestão da IA? (fica no histórico)'), { target: { value: 'já tem a idade e 15 anos de carteira' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Conferi a recomendação com a entrevista' }))
    fireEvent.click(botao('Confirmar benefício'))
    await screen.findByRole('heading', { name: '✓ Benefício definido: Aposentadoria por Idade' })
    expect((await obterFicha('josefa-exemplo'))!.historico.at(-1)?.oQue).toBe(
      'Recusou a sugestão da IA (Auxílio por Incapacidade Temporária): já tem a idade e 15 anos de carteira',
    )
  })

  it('CA1 · o benefício citado pela advogada vem escolhido e prevalece; o do acervo é só sugestão', async () => {
    await entrevista('natalia-entrevista')
    await abrir('natalia-entrevista')
    expect(sugestao().getByText('Citado por você').nextElementSibling?.textContent).toBe('Aposentadoria por Incapacidade Permanente · prevalece (G3)')
    expect(sugestao().getByText('Auxílio por Incapacidade Temporária · só como sugestão')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'O que você citou: Aposentadoria por Incapacidade Permanente' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('region', { name: 'Requisitos de Aposentadoria por Incapacidade Permanente' }).textContent).toContain('Carência: 63 contribuições')
  })

  it('sem transcrição, a IA ainda não sugere e a lista do escritório já está lá', async () => {
    await abrir()
    expect(screen.getByText(/A entrevista ainda não foi transcrita/)).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Outro benefício' })).toBeTruthy()
  })
})
