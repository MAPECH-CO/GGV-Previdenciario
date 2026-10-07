import { describe, expect, it } from 'vitest'
import { MATRIZ, PERFIS, VERSAO_MATRIZ, digitalDaMatriz, pode, type Acao, type Perfil } from './permissoes.ts'

const acoesDe = (perfil: Perfil) => (Object.keys(MATRIZ) as Acao[]).filter((a) => pode(perfil, a)).sort()

describe('matriz de permissões (GGVP-96)', () => {
  it('CA15 · mudou a matriz, mudou a versão: atualize os dois juntos', () => {
    expect({ versao: VERSAO_MATRIZ, digital: digitalDaMatriz() }).toEqual({ versao: 5, digital: '77c71910' })
  })

  it('CA2 · só a Sênior aprova para o INSS', () => {
    expect(PERFIS.filter((p) => pode(p, 'caso.aprovar_para_inss'))).toEqual(['senior'])
  })

  it('CA4 · só a Documentação libera ao Jurídico', () => {
    expect(PERFIS.filter((p) => pode(p, 'caso.liberar_ao_juridico'))).toEqual(['documentacao'])
  })

  it('CA5 · perícia é do Jurídico administrativo; o Atendimento não tem essas ações', () => {
    for (const a of ['pericia.marcar', 'pericia.decidir_documento_novo', 'pericia.orientar_cliente', 'pericia.registrar_comparecimento'] as const) {
      expect(pode('juridico_adm', a), a).toBe(true)
      expect(pode('atendimento', a), a).toBe(false)
    }
  })

  it('CA6 · ninguém abre a tarefa de perícia: é o sistema', () => {
    expect(PERFIS.filter((p) => pode(p, 'pericia.abrir_tarefa'))).toEqual([])
  })

  it('CA7 · laudo novo: o Atendimento sobe, a advogada confere', () => {
    expect(pode('atendimento', 'laudo.subir')).toBe(true)
    expect(pode('advogada', 'laudo.conferir')).toBe(true)
    expect(pode('atendimento', 'laudo.conferir')).toBe(false)
  })

  it('CA1 e CA12 · Financeiro vê prestação e valores, nunca entrevista, laudos, saúde nem petição', () => {
    expect(acoesDe('financeiro')).toEqual(['gestao.ver', 'prestacao.registrar_recebimento', 'prestacao.ver', 'valores.ver'])
  })

  it('CA12 · dado de saúde em detalhe só para o Jurídico; valores só o Financeiro, e a prestação também a advogada', () => {
    expect(PERFIS.filter((p) => pode(p, 'dado_saude.ver_detalhe'))).toEqual(['advogada', 'senior', 'juridico_adm'])
    expect(PERFIS.filter((p) => pode(p, 'valores.ver'))).toEqual(['financeiro'])
    expect(PERFIS.filter((p) => pode(p, 'prestacao.ver'))).toEqual(['advogada', 'financeiro'])
  })

  it('GGVP-23 · só a Sênior encerra; Financeiro e Sócio não abrem o caso', () => {
    expect(PERFIS.filter((p) => pode(p, 'caso.encerrar'))).toEqual(['senior'])
    expect(pode('financeiro', 'caso.ver')).toBe(false)
    expect(pode('socio', 'caso.ver')).toBe(false)
    expect(pode('atendimento', 'caso.ver')).toBe(true)
  })

  it('CA10 · só o Sócio atribui perfis', () => {
    expect(PERFIS.filter((p) => pode(p, 'perfis.atribuir'))).toEqual(['socio'])
  })

  it('versão 4 · exigência do INSS e ida ao banco: cada ação só no seu perfil', () => {
    expect(pode('advogada', 'exigencia_inss.tratar')).toBe(true)
    expect(pode('documentacao', 'exigencia_inss.cumprir')).toBe(true)
    expect(pode('advogada', 'exigencia_inss.cumprir')).toBe(false)
    expect(pode('senior', 'exigencia_inss.decidir_vencida')).toBe(true)
    expect(pode('financeiro', 'banco.agendar')).toBe(false)
  })

  it('perfil inventado ou vazio não pode nada', () => {
    expect(pode('admin', 'perfis.atribuir')).toBe(false)
    expect(pode(null, 'entrevista.ver')).toBe(false)
  })

  it('o que cada perfil pode, um por um (muda junto com a versão)', () => {
    expect(Object.fromEntries(PERFIS.map((p) => [p, acoesDe(p).length]))).toEqual({
      atendimento: 5,
      atendimento_lider: 7,
      documentacao: 4,
      advogada: 14,
      senior: 13,
      juridico_adm: 11,
      financeiro: 4,
      socio: 2,
    })
  })
})
