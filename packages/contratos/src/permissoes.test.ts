import { describe, expect, it } from 'vitest'
import { MATRIZ, PERFIS, VERSAO_MATRIZ, digitalDaMatriz, pode, type Acao, type Perfil } from './permissoes.ts'

const acoesDe = (perfil: Perfil) => (Object.keys(MATRIZ) as Acao[]).filter((a) => pode(perfil, a)).sort()

describe('matriz de permissões (GGVP-96)', () => {
  it('CA15 · mudou a matriz, mudou a versão: atualize os dois juntos', () => {
    expect({ versao: VERSAO_MATRIZ, digital: digitalDaMatriz() }).toEqual({ versao: 19, digital: 'f1a04156' })
  })

  it('GGVP-75 CA4 · os totais em dinheiro do painel de resultados só para o Sócio e o Financeiro', () => {
    expect(PERFIS.filter((p) => pode(p, 'valores.ver_totais'))).toEqual(['financeiro', 'socio'])
  })

  it('GGVP-143 · só a Sênior muda o glossário do escritório', () => {
    expect(PERFIS.filter((p) => pode(p, 'glossario.editar'))).toEqual(['senior'])
  })

  it('GGVP-55 CA7 · só a Sênior confere os desfechos do acervo', () => {
    expect(PERFIS.filter((p) => pode(p, 'acervo.conferir_desfecho'))).toEqual(['senior'])
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
    expect(acoesDe('financeiro')).toEqual(['banco.agendar', 'gestao.ver', 'prestacao.registrar_recebimento', 'prestacao.ver', 'valores.ver', 'valores.ver_totais'])
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
  })

  it('versão 14 · o Jurídico aprova o resumo do resultado; a advogada ou o Atendimento explica (GGVP-22)', () => {
    expect(PERFIS.filter((p) => pode(p, 'resultado.aprovar_resumo'))).toEqual(['advogada', 'senior'])
    expect(pode('atendimento', 'resultado.explicar')).toBe(true)
    expect(pode('atendimento', 'resultado.aprovar_resumo')).toBe(false)
    expect(pode('financeiro', 'resultado.explicar')).toBe(false)
  })

  it('versão 14 · a ida ao banco é do Financeiro (GGVP-98); o Atendimento não marca', () => {
    expect(pode('financeiro', 'banco.agendar')).toBe(true)
    expect(pode('atendimento', 'banco.agendar')).toBe(false)
  })

  it('versão 5 · vigília: a Sênior reprocessa e casa a fila; a advogada vê e classifica', () => {
    expect(pode('senior', 'vigilia.reprocessar')).toBe(true)
    expect(pode('advogada', 'vigilia.reprocessar')).toBe(false)
    expect(pode('senior', 'publicacao.casar')).toBe(true)
    expect(pode('advogada', 'publicacao.classificar')).toBe(true)
    expect(pode('atendimento', 'vigilia.ver')).toBe(false)
  })

  it('versão 18 · documentação médica no servidor: o Jurídico registra o parecer e o dado de saúde; só a Sênior edita o roteiro', () => {
    expect(PERFIS.filter((p) => pode(p, 'roteiro.editar'))).toEqual(['senior'])
    expect(PERFIS.filter((p) => pode(p, 'parecer.registrar'))).toEqual(['advogada', 'senior'])
    expect(PERFIS.filter((p) => pode(p, 'dado_saude.registrar'))).toEqual(['advogada', 'senior'])
    expect(PERFIS.filter((p) => pode(p, 'complemento.cobrar'))).toEqual(['atendimento', 'atendimento_lider'])
    expect(PERFIS.filter((p) => pode(p, 'complemento.decidir'))).toEqual(['senior'])
    expect(PERFIS.filter((p) => pode(p, 'acidente.registrar'))).toEqual(['documentacao', 'advogada', 'senior'])
  })

  it('GGVP-137 · a Documentação reúne o que a perícia pede; no limite (G15) e no resultado, só a advogada, nunca a Sênior', () => {
    expect(PERFIS.filter((p) => pode(p, 'pericia.reunir_documentos'))).toEqual(['documentacao'])
    expect(PERFIS.filter((p) => pode(p, 'pericia.decidir_no_limite'))).toEqual(['advogada'])
    expect(PERFIS.filter((p) => pode(p, 'pericia.conferir_resultado'))).toEqual(['advogada'])
  })

  it('perfil inventado ou vazio não pode nada', () => {
    expect(pode('admin', 'perfis.atribuir')).toBe(false)
    expect(pode(null, 'entrevista.ver')).toBe(false)
  })

  it('GGVP-19 · o estudo de caso é do Jurídico (o Atendimento não vê); o novo processo, a Sênior decide', () => {
    expect([pode('advogada', 'estudo.ver'), pode('juridico_adm', 'estudo.ver'), pode('atendimento', 'estudo.ver'), pode('financeiro', 'estudo.ver')]).toEqual([true, true, false, false])
    expect([pode('senior', 'estudo.revisar'), pode('advogada', 'estudo.revisar')]).toEqual([true, false])
  })

  it('GGVP-125 · a ficha da Recepção: quem trabalha com o caso edita; Financeiro e Sócio, não', () => {
    expect(PERFIS.filter((p) => pode(p, 'ficha.editar'))).toEqual(PERFIS.filter((p) => !['financeiro', 'socio'].includes(p)))
    // Bloco 3a: gravar e transcrever a entrevista, que tem dado de saúde, só o Jurídico.
    expect(PERFIS.filter((p) => pode(p, 'entrevista.gravar'))).toEqual(['advogada', 'senior', 'juridico_adm'])
  })

  it('GGVP-138 · o Relacionamento: conversa com o Atendimento e o Jurídico; versão e prazo só com a Sênior; a segunda confirmação bancária, não do Atendimento', () => {
    expect(PERFIS.filter((p) => pode(p, 'conversa.registrar'))).toEqual(['atendimento', 'atendimento_lider', 'advogada', 'senior'])
    expect(PERFIS.filter((p) => pode(p, 'ficha.voltar_versao'))).toEqual(['senior'])
    expect(PERFIS.filter((p) => pode(p, 'conversa.prazo_da_pendencia'))).toEqual(['senior'])
    expect(PERFIS.filter((p) => pode(p, 'dados_bancarios.confirmar'))).toEqual(['atendimento_lider', 'advogada', 'senior'])
    expect(pode('financeiro', 'mensagem.enviar')).toBe(false)
  })

  it('o que cada perfil pode, um por um (muda junto com a versão)', () => {
    expect(Object.fromEntries(PERFIS.map((p) => [p, acoesDe(p).length]))).toEqual({
      atendimento: 13,
      atendimento_lider: 16,
      documentacao: 9,
      advogada: 34,
      senior: 38,
      juridico_adm: 17,
      financeiro: 6,
      socio: 5,
    })
  })
})
