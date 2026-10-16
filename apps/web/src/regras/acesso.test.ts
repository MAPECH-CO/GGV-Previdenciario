import { describe, expect, it } from 'vitest'
import { acaoDoCaminho, podeAbrir } from './acesso.ts'

const CASO = '0f1e2d3c-4b5a-4968-8776-655443322110'

describe('podeAbrir: o link só aparece para quem abre a tela', () => {
  it('o Sócio lê a ficha, mas não abre nova demanda, cadastro, marcar entrevista nem a ficha de atendimento', () => {
    expect(podeAbrir('socio', '/clientes/ana')).toBe(true)
    for (const href of ['/clientes/ana/nova-demanda', '/clientes/ana/cadastro', '/agenda/marcar/ana', '/clientes/ana/ficha-de-atendimento'])
      expect(podeAbrir('socio', href)).toBe(false)
  })

  it('o Financeiro não abre a agenda nem a página do processo; abre o painel dele', () => {
    expect(podeAbrir('financeiro', '/agenda')).toBe(false)
    expect(podeAbrir('financeiro', `/casos/${CASO}`)).toBe(false)
    expect(podeAbrir('financeiro', '/financeiro?periodo=2026-10')).toBe(true)
  })

  it('a tela de caso usa a ação dela, e a tela que confere sozinha deixa o link', () => {
    expect(acaoDoCaminho(`/casos/${CASO}/pericia/decidir`)).toBe('pericia.decidir')
    expect(podeAbrir('juridico_adm', `/casos/${CASO}/pericia/decidir`)).toBe(false)
    expect(acaoDoCaminho('/roteiros/pcd')).toBeUndefined()
    expect(podeAbrir('atendimento', '/roteiros/pcd')).toBe(true)
  })
})
