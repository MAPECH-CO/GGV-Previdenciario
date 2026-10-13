import { describe, expect, it } from 'vitest'
import { AdiamentoDaCobranca, CnisDigitado, DecisaoDaCobranca, FichaLidaPelaIa, LidoPelaIa, SegundaFichaLidaPelaIa, TentativaDaCobranca } from './recepcao.ts'

describe('GGVP-158 P4.2 · o que a IA lê das fichas em papel', () => {
  it('a ficha de atendimento: o que falta fica vazio, e as pessoas na casa aceitam número ou texto', () => {
    expect(FichaLidaPelaIa.parse({ nome: 'Maria Exemplo', pessoasNaCasa: 3 })).toMatchObject({ nome: 'Maria Exemplo', cpf: '', pessoasNaCasa: 3, senha: '' })
    expect(FichaLidaPelaIa.parse({ pessoasNaCasa: 'três' }).pessoasNaCasa).toBe('três')
    expect(FichaLidaPelaIa.parse({ pessoasNaCasa: null }).pessoasNaCasa).toBe('')
  })

  it('a segunda ficha: as respostas campo a campo, e o que vier fora do formato fica vazio', () => {
    expect(SegundaFichaLidaPelaIa.parse({ respostas: { empresa: 'Exemplo Ltda', cat: 1 } })).toEqual({ respostas: { empresa: 'Exemplo Ltda', cat: '' }, senha: '' })
    expect(SegundaFichaLidaPelaIa.parse({ respostas: 'nada' })).toEqual({ respostas: {}, senha: '' })
  })
})

describe('GGVP-158 P4.1 · o que a IA lê do documento do balcão', () => {
  it('a leitura completa passa como veio; o que falta ou vem fora do formato fica vazio, e o que não é objeto recusa', () => {
    const lido = { tipo: 'cnis', data: '2026-09-30', nome: 'Maria Exemplo', cpf: '000.000.000-00', rg: '', endereco: '', assinado: null, dataEmBranco: false, legivel: true, confianca: 92, emitente: '', registro: '' }
    expect(LidoPelaIa.parse(lido)).toEqual(lido)
    expect(LidoPelaIa.parse({ tipo: 'rg', confianca: 'alta', assinado: 'sim', nome: 7 })).toEqual({
      tipo: 'rg', data: '', nome: '', cpf: '', rg: '', endereco: '', assinado: null, dataEmBranco: false, legivel: true, confianca: 0, emitente: '', registro: '',
    })
    expect(LidoPelaIa.safeParse('não é JSON').success).toBe(false)
  })
})

describe('GGVP-125 · bloco 5c: a cobrança dos documentos', () => {
  it('a tentativa, o adiamento e a decisão da Sênior só passam com os valores da tela', () => {
    expect(TentativaDaCobranca.safeParse({ canal: 'ligacao', resultado: 'sem-resposta' }).success).toBe(true)
    expect(TentativaDaCobranca.safeParse({ canal: 'email', resultado: 'sem-resposta' }).success).toBe(false)
    expect(AdiamentoDaCobranca.safeParse({ para: null }).success).toBe(true)
    expect(AdiamentoDaCobranca.safeParse({ para: '12/10/2026' }).success).toBe(false)
    expect(DecisaoDaCobranca.safeParse({ opcao: 'nova-tentativa', justificativa: 'cliente viaja', prazo: '2026-10-20' }).success).toBe(true)
    expect(DecisaoDaCobranca.safeParse({ opcao: 'arquivar', justificativa: 'x' }).success).toBe(false)
  })
})

describe('GGVP-158 P3.4 · o CNIS digitado no portal', () => {
  const CNIS = {
    origem: 'impresso',
    extraidoEm: '05/10/2026',
    calculo: { nascimento: '10/03/1962', referencia: '01/10/2026', vinculos: [{ inicio: '01/01/1990', fim: '30/09/2026', tempo: 'conferido', carencia: 'conferido' }], excecoes: [] },
  }

  it('leva a origem, a data da extração e a mesma entrada do cálculo da tela', () => {
    expect(CnisDigitado.safeParse(CNIS).success).toBe(true)
  })

  it('sem origem conhecida, com a data errada ou sem vínculo, recusa com o que corrigir', () => {
    const erro = (v: object) => CnisDigitado.safeParse({ ...CNIS, ...v }).error?.issues[0]?.message
    expect(erro({ origem: 'whatsapp' })).toBe('Diga de onde veio o CNIS: impresso ou Meu INSS.')
    expect(erro({ extraidoEm: '2026-10-05' })).toBe('Data da extração inválida: use dd/mm/aaaa.')
    expect(erro({ calculo: { ...CNIS.calculo, vinculos: [] } })).toBe('Digite ao menos um vínculo.')
  })
})
