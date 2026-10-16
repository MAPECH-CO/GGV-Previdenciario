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
    expect(acaoDoCaminho('/')).toBeUndefined()
    expect(podeAbrir('financeiro', '/')).toBe(true)
    // GGVP-158 E7: os roteiros de laudos e as telas de passo do caso abrem só para quem vê o caso.
    expect(acaoDoCaminho('/roteiros/pcd')).toBe('caso.ver')
    expect(podeAbrir('atendimento', '/roteiros/pcd')).toBe(true)
    expect(podeAbrir('financeiro', '/roteiros/pcd')).toBe(false)
    expect(acaoDoCaminho(`/casos/${CASO}/parecer/dispensa`)).toBe('caso.aprovar_para_inss')
    expect(acaoDoCaminho(`/casos/${CASO}/publicacoes`)).toBe('processo.abrir')
  })

  it('GGVP-163 R5 · a base histórica por benefício é do Jurídico e do Sócio (estudo.ver)', () => {
    expect([acaoDoCaminho('/beneficios'), acaoDoCaminho('/beneficios/bpc_loas_deficiente')]).toEqual(['estudo.ver', 'estudo.ver'])
    expect([podeAbrir('advogada', '/beneficios/bpc_loas_deficiente'), podeAbrir('socio', '/beneficios'), podeAbrir('atendimento', '/beneficios'), podeAbrir('financeiro', '/beneficios')]).toEqual([true, true, false, false])
  })
})
