import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ITENS_DA_GESTAO, ITENS_DAS_BASES, itensDoPerfil } from './itensDaGestao.ts'
import { Topbar, type ItemNavegacao } from './Topbar.tsx'

const itens = [
  { id: 'inicio', glifo: '⌂', rotulo: 'Início', href: '/' },
  { id: 'agenda', glifo: '▦', rotulo: 'Agenda', href: '/agenda' },
]

describe('Topbar', () => {
  it('mostra a marca, os botões da função com o atual aceso, a ação, tema e fonte e a função', () => {
    render(
      <Topbar itens={itens} ativo="inicio" funcao="Atendimento" acao={{ rotulo: '+ Novo cliente', href: '/clientes/novo' }} />,
    )
    expect(screen.getByText('GGV Previdenciário')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'GGV Previdenciário, início' }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('link', { name: 'Início' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Agenda' }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('link', { name: '+ Novo cliente' }).getAttribute('href')).toBe('/clientes/novo')
    expect(screen.getByRole('button', { name: /^Mudar para o tema (escuro|claro)$/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^(Aumentar|Diminuir) a fonte$/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Atendimento' })).toBeTruthy()
  })

  it('a troca de função, ainda não ligada, avisa que está indisponível e não promete menu', () => {
    render(<Topbar itens={itens} ativo="inicio" funcao="Atendimento" />)
    const funcao = screen.getByRole('button', { name: 'Atendimento' })
    expect(funcao.getAttribute('aria-disabled')).toBe('true')
    expect(funcao.getAttribute('aria-haspopup')).toBeNull()
  })
})

describe('GGVP-78 · os itens do topo pelo perfil da sessão (Figma 1927:605, 1927:14, 1931:130)', () => {
  const ids = (perfil: string | null, lista: ItemNavegacao[] = itens) => itensDoPerfil(lista, perfil).map((i) => i.id)

  it('Clientes e Processos depois do Início e da Agenda para o líder, a Advogada e a Sênior; a Gestão no fim, para quem tem', () => {
    expect(ids('atendimento_lider')).toEqual(['inicio', 'agenda', 'clientes', 'processos', 'tentativas', 'prazos', 'cofre', 'resultados', 'configuracao'])
    expect(ids('advogada')).toEqual(['inicio', 'agenda', 'clientes', 'processos'])
    expect(ids('senior', [...itens, { id: 'estudos', rotulo: 'Estudos de caso', href: '/estudos' }])).toEqual([
      'inicio',
      'agenda',
      'clientes',
      'processos',
      'estudos',
      'tentativas',
      'prazos',
      'cofre',
      'resultados',
      'configuracao',
    ])
  })

  it('o Atendimento só tem a Agenda; o Financeiro, sem ver o caso, fica com a Gestão e o painel Financeiro; sem sessão, nada muda', () => {
    expect(ids('atendimento')).toEqual(['inicio', 'agenda'])
    expect(ids('financeiro')).toEqual(['inicio', 'agenda', 'tentativas', 'prazos', 'cofre', 'resultados', 'configuracao', 'financeiro'])
    expect(ids(null)).toEqual(['inicio', 'agenda'])
  })

  it('o painel Financeiro no topo de quem vê os totais em dinheiro: o Financeiro e o Sócio; a Sênior, não', () => {
    expect(ids('socio').at(-1)).toBe('financeiro')
    expect(ids('senior')).not.toContain('financeiro')
    expect(ids('advogada')).not.toContain('financeiro')
  })

  it('o que a tela já trouxe não se repete', () => {
    expect(ids('senior', [...itens, ...ITENS_DAS_BASES, ...ITENS_DA_GESTAO])).toEqual(ids('senior'))
  })
})
