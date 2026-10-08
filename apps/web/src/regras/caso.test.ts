import { describe, expect, it } from 'vitest'
import {
  emOrdem,
  estadosDasEtapas,
  etapaAtual,
  etapaDaOrigem,
  faseDoCaso,
  identificacao,
  jurimetriaDoJuizo,
  podeVerValor,
  prazosDaFase,
  setoresPendentes,
  taxaComCasos,
  visaoDoPerfil,
} from './caso.ts'

describe('GGVP-86 · o caso numa linha só', () => {
  it('CA1 · a etapa atual sai do texto da etapa do processo', () => {
    expect(etapaAtual('Contrato · assinatura')).toBe('entrevista')
    expect(etapaAtual('Documentação · conferência')).toBe('entrevista')
    expect(etapaAtual('Jurídico · parecer médico')).toBe('entrevista')
    expect(etapaAtual('Administrativo · perícia')).toBe('inss')
    expect(etapaAtual('Benefício deferido')).toBe('inss')
    expect(etapaAtual('Judicial · petição')).toBe('justica')
    expect(etapaAtual('Judicial · exigência')).toBe('vigilia')
    expect(etapaAtual('Judicial · sentença procedente')).toBe('desfecho')
  })

  it('CA1 · antes da atual, feita; depois, ainda não chegou; deferido no INSS apaga a Justiça, a vigília e o desfecho', () => {
    expect(estadosDasEtapas('vigilia')).toEqual({ entrevista: 'feita', inss: 'feita', justica: 'feita', vigilia: 'atual', desfecho: 'futura' })
    expect(estadosDasEtapas('inss', { deferidoNoInss: true })).toEqual({
      entrevista: 'feita',
      inss: 'atual',
      justica: 'nao-se-aplica',
      vigilia: 'nao-se-aplica',
      desfecho: 'nao-se-aplica',
    })
    expect(estadosDasEtapas('justica', { semInss: true }).inss).toBe('nao-se-aplica')
    // Sem INSS, mas ainda na entrevista: o INSS não foi pulado ainda.
    expect(estadosDasEtapas('entrevista', { semInss: true }).inss).toBe('futura')
  })

  it('CA2 · a perícia fica ligada à etapa que pediu', () => {
    expect(etapaDaOrigem('d2-necessidade')).toBe('inss')
    expect(etapaDaOrigem('d2-exigencia')).toBe('inss')
    expect(etapaDaOrigem('d3-despacho')).toBe('justica')
    expect(etapaDaOrigem('d3a-juiz')).toBe('vigilia')
  })

  it('CA3 · os setores acionados que ainda não subiram o card, sem repetir', () => {
    const lacos = [
      { setor: 'Documentação', subiu: undefined },
      { setor: 'Atendimento', subiu: { quem: 'Bruna', quando: '2026-09-28' } },
      { setor: 'Documentação' },
      { setor: 'Perícia' },
    ]
    expect(setoresPendentes(lacos)).toEqual(['Documentação', 'Perícia'])
    expect(setoresPendentes([{ setor: 'Jurídico', subiu: true }])).toEqual([])
  })

  it('CA10 · a linha em ordem cronológica, mantendo a ordem da gravação na mesma hora', () => {
    const linha = [
      { quando: '2026-09-27T10:00:00.000Z', oQue: 'c' },
      { quando: '2025-07-10T10:00:00.000Z', oQue: 'a' },
      { quando: '2026-09-27T10:00:00.000Z', oQue: 'd' },
      { quando: '2025-07-15T10:00:00.000Z', oQue: 'b' },
    ]
    expect(emOrdem(linha).map((e) => e.oQue)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('CA12 · só os prazos da fase', () => {
    const prazos = [
      { tipo: 'prazo' as const, oQue: 'exigência' },
      { tipo: 'vigilia-meu-inss' as const, oQue: 'Meu INSS' },
      { tipo: 'vigilia-publicacoes' as const, oQue: 'publicações' },
    ]
    expect(prazosDaFase('administrativa', prazos).map((p) => p.oQue)).toEqual(['exigência', 'Meu INSS'])
    expect(prazosDaFase('judicial', prazos).map((p) => p.oQue)).toEqual(['exigência', 'publicações'])
  })

  it('CA13 · NB ou protocolo na fase administrativa, CNJ com processo judicial', () => {
    expect(faseDoCaso({ etapa: 'Judicial · exigência' })).toBe('judicial')
    expect(faseDoCaso({ etapa: 'Administrativo · perícia' })).toBe('administrativa')
    expect(faseDoCaso({ etapa: 'Contrato · conferência', numero: '0000002-70.2026.4.03.6100' })).toBe('judicial')
    expect(identificacao('administrativa', { nb: '4561237895' })).toEqual({ rotulo: 'NB', valor: '456.123.789-5' })
    expect(identificacao('administrativa', { protocolo: '1.234.567' })).toEqual({ rotulo: 'Protocolo', valor: '1.234.567' })
    expect(identificacao('administrativa', {})).toEqual({ rotulo: 'NB', valor: 'sem NB nem protocolo ainda' })
    expect(identificacao('judicial', { numero: '00000027020264036100', nb: '4561237895' })).toEqual({ rotulo: 'Processo (CNJ)', valor: '0000002-70.2026.4.03.6100' })
    expect(identificacao('judicial', {}).valor).toBe('número CNJ ainda não lido')
  })

  it('CA6 e G22 · os números da jurimetria vêm do código, com o número de casos ao lado e a data da base, sem amostra mínima', () => {
    expect(taxaComCasos(7, 12, '2026-10-07')).toBe('58% · 7 de 12 casos · base de 07/10')
    expect(taxaComCasos(1, 3, '2026-10-07')).toBe('33% · 1 de 3 casos · base de 07/10')
    expect(taxaComCasos(1, 1, '2026-10-07', 'laudos')).toBe('100% · 1 de 1 laudo · base de 07/10')
    expect(taxaComCasos(0, 0, '2026-10-07')).toBe('sem casos no acervo')
    const j = jurimetriaDoJuizo([
      { beneficio: 'a', procedente: true, meses: 10 },
      { beneficio: 'a', procedente: false, meses: 12 },
      { beneficio: 'b', procedente: true, meses: 11 },
    ], '2026-10-07')
    expect(j.casos).toBe(3)
    expect(j.mesesAteASentenca).toBe(11)
    expect(j.porBeneficio).toEqual([
      { beneficio: 'a', procedentes: 1, casos: 2, texto: '50% · 1 de 2 casos · base de 07/10' },
      { beneficio: 'b', procedentes: 1, casos: 1, texto: '100% · 1 de 1 caso · base de 07/10' },
    ])
  })

  it('Permissão · o Jurídico vê tudo; o Financeiro, valores; os outros, sem saúde nem valores', () => {
    expect(visaoDoPerfil('advogada')).toBe('juridico')
    expect(visaoDoPerfil('juridico-adm')).toBe('juridico')
    expect(visaoDoPerfil('financeiro')).toBe('financeiro')
    expect(visaoDoPerfil('atendimento')).toBe('atendimento')
    expect(visaoDoPerfil('documentacao')).toBe('atendimento')
    expect(visaoDoPerfil(undefined)).toBe('atendimento')
  })

  it('Valores · só o Financeiro e o Sócio; a advogada vê a causa, a renda por pessoa e a prestação de contas do caso dela', () => {
    const dela = { advogadaDoCaso: true, naPrestacaoDeContas: true }
    for (const tipo of ['causa', 'renda-por-pessoa', 'prestacao-de-contas'] as const) {
      expect(podeVerValor('financeiro', tipo, dela)).toBe(true)
      expect(podeVerValor('socio', tipo, dela)).toBe(true)
      for (const outro of ['atendimento', 'documentacao', 'senior', 'juridico-adm', undefined]) expect(podeVerValor(outro, tipo, dela)).toBe(false)
    }
    expect(podeVerValor('advogada', 'causa', { advogadaDoCaso: false, naPrestacaoDeContas: false })).toBe(true)
    expect(podeVerValor('advogada', 'renda-por-pessoa', { advogadaDoCaso: false, naPrestacaoDeContas: false })).toBe(true)
    expect(podeVerValor('advogada', 'prestacao-de-contas', dela)).toBe(true)
    expect(podeVerValor('advogada', 'prestacao-de-contas', { advogadaDoCaso: false, naPrestacaoDeContas: true })).toBe(false)
    expect(podeVerValor('advogada', 'prestacao-de-contas', { advogadaDoCaso: true, naPrestacaoDeContas: false })).toBe(false)
  })
})
