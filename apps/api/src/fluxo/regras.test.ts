import { describe, expect, it } from 'vitest'
import { calcular, diiCarenciaQualidade, incapacidade15Dias, loas24Meses, periodosPcd } from './regras.ts'

const HOJE = '2026-10-06'
const detalhe = (r: { detalhes: { rotulo: string; valor: string }[] }, rotulo: string) => r.detalhes.find((d) => d.rotulo === rotulo)?.valor
/** Competências mm/aaaa de `de` até `ate`, inclusive. */
function competencias(de: string, ate: string) {
  const lista: string[] = []
  let [m, a] = de.split('/').map(Number)
  const [mf, af] = ate.split('/').map(Number)
  while (a < af || (a === af && m <= mf)) {
    lista.push(`${String(m).padStart(2, '0')}/${a}`)
    m += 1
    if (m > 12) [m, a] = [1, a + 1]
  }
  return lista
}

describe('CA1 · BPC/LOAS Deficiente: 24 meses', () => {
  it('início em 2024 e ainda presente: conta até hoje e alcança', () => {
    const r = loas24Meses({ inicio: '2024-03-10', persiste: true }, HOJE)
    expect([r.atende, r.resumo, detalhe(r, 'Até')]).toEqual([true, '30 meses: alcança os 24 meses', '06/10/2026 (hoje, ainda persiste)'])
  })
  it('diagnóstico em 2026 com prognóstico até 2028: alcança; prognóstico curto não alcança', () => {
    expect(loas24Meses({ inicio: '2026-05-01', fimPrevisto: '2028-06-01' }, HOJE).resumo).toBe('25 meses: alcança os 24 meses')
    const curto = loas24Meses({ inicio: '2026-01-10', fimPrevisto: '2027-01-09' }, HOJE)
    expect([curto.atende, curto.resumo]).toEqual([false, '11 meses: não alcança os 24 meses'])
  })
  it('prognóstico permanente alcança', () => {
    expect(loas24Meses({ inicio: '2026-09-01', permanente: true }, HOJE).atende).toBe(true)
  })
})

describe('CA2 · incapacidade temporária: mais de 15 dias na janela de 60', () => {
  it('soma só os correlacionados, encadeados até 60 dias depois da volta', () => {
    const r = incapacidade15Dias(
      {
        atestados: [
          { inicio: '2026-09-01', dias: 10, correlacionado: true }, // volta ao trabalho em 11/09
          { inicio: '2026-09-15', dias: 5, correlacionado: false }, // sem correlação: fora da soma
          { inicio: '2026-11-10', dias: 8, correlacionado: true }, // 60 dias depois da volta: soma
        ],
      },
      HOJE,
    )
    expect([r.atende, r.resumo]).toEqual([true, '18 dias somados: passa de 15 dias'])
    expect([detalhe(r, 'Atestados somados'), detalhe(r, 'Fora da soma (sem correlação marcada)')]).toEqual(['01/09/2026, 10/11/2026', '15/09/2026'])
  })
  it('depois de 60 dias da volta começa outra soma; dias sobrepostos contam uma vez', () => {
    const longe = incapacidade15Dias(
      { atestados: [{ inicio: '2026-09-01', dias: 10, correlacionado: true }, { inicio: '2026-11-11', dias: 8, correlacionado: true }] },
      HOJE,
    )
    expect([longe.atende, longe.resumo]).toEqual([false, '10 dias somados: não passa de 15 dias'])
    const sobreposto = incapacidade15Dias(
      { atestados: [{ inicio: '2026-09-01', dias: 10, correlacionado: true }, { inicio: '2026-09-05', dias: 10, correlacionado: true }] },
      HOJE,
    )
    expect(sobreposto.resumo).toBe('14 dias somados: não passa de 15 dias')
  })
})

describe('CA3 · Aposentadoria PCD: períodos na condição', () => {
  it('a parte de cada vínculo dentro da deficiência; o vínculo anterior fica de fora', () => {
    const r = periodosPcd(
      {
        inicioDeficiencia: '2015-06-01',
        vinculos: [{ inicio: '2008-01-01', fim: '2009-12-31' }, { inicio: '2010-01-01', fim: '2016-12-31' }, { inicio: '2018-03-01' }],
      },
      HOJE,
    )
    expect(r.detalhes).toEqual([
      { rotulo: 'Período 1', valor: '01/06/2015 a 31/12/2016' },
      { rotulo: 'Período 2', valor: '01/03/2018 a 06/10/2026' },
    ])
    expect(r.resumo).toBe('2 períodos contam como tempo na condição de PCD: 3722 dias')
  })
  it('vínculos concomitantes contam uma vez no total; deficiência transitória para no fim', () => {
    const r = periodosPcd(
      {
        inicioDeficiencia: '2020-01-01',
        fimDeficiencia: '2020-01-31',
        vinculos: [{ inicio: '2019-01-01', fim: '2021-01-01' }, { inicio: '2020-01-10', fim: '2020-03-01' }],
      },
      HOJE,
    )
    expect(r.resumo).toBe('2 períodos contam como tempo na condição de PCD: 31 dias')
  })
})

describe('CA4 · dado que falta: não calculável (G19)', () => {
  it('cada regra diz o que falta, sem palpite', () => {
    expect(loas24Meses({ persiste: true }, HOJE)).toMatchObject({
      atende: null,
      resumo: 'Não calculável: falta a data de início do impedimento',
      falta: ['a data de início do impedimento'],
    })
    expect(loas24Meses({ inicio: '2024-01-01' }, HOJE).falta).toEqual(['o prognóstico (data prevista, permanente ou se ainda persiste)'])
    expect(incapacidade15Dias({}, HOJE).resumo).toBe('Não calculável: falta os atestados')
    expect(periodosPcd({ vinculos: [] }, HOJE).falta).toEqual(['a data de início da deficiência', 'os vínculos do CNIS'])
    expect(diiCarenciaQualidade({ competencias: ['01/2026'] }, HOJE).falta).toEqual(['a data de início da incapacidade (DII)'])
  })
})

describe('CA5 · DII com carência e qualidade de segurado', () => {
  it('12 contribuições e a DII dentro da graça: compatível', () => {
    const r = diiCarenciaQualidade({ dii: '2026-08-15', competencias: competencias('01/2025', '12/2025') }, HOJE)
    expect([r.atende, detalhe(r, 'Carência'), detalhe(r, 'Qualidade de segurado até')]).toEqual([true, '12 de 12 contribuições antes da DII', '15/02/2027'])
  })
  it('a qualidade vai até o dia 15 do 2º mês depois do fim da graça (Decreto 3.048, art. 14)', () => {
    const cnis = competencias('02/2024', '01/2025')
    expect(diiCarenciaQualidade({ dii: '2026-03-15', competencias: cnis }, HOJE).atende).toBe(true)
    const r = diiCarenciaQualidade({ dii: '2026-03-16', competencias: cnis }, HOJE)
    expect([r.atende, detalhe(r, 'Qualidade de segurado até')]).toEqual([false, '15/03/2026'])
  })
  it('mais de 120 contribuições sem perda: mais 12 meses; desemprego comprovado: mais 12; facultativo: 6', () => {
    const ate = (r: Parameters<typeof detalhe>[0]) => detalhe(r, 'Qualidade de segurado até')
    expect(ate(diiCarenciaQualidade({ dii: '2023-02-10', competencias: competencias('01/2010', '12/2020') }, HOJE))).toBe('15/02/2023')
    expect(ate(diiCarenciaQualidade({ dii: '2026-08-01', competencias: competencias('01/2025', '12/2025'), desempregado: true }, HOJE))).toBe('15/02/2028')
    expect(ate(diiCarenciaQualidade({ dii: '2026-08-01', competencias: competencias('01/2025', '01/2026'), facultativo: true }, HOJE))).toBe('15/09/2026')
  })
  it('depois de perder a qualidade, a carência é 6 desde a nova filiação; a isenção marcada pela advogada dispensa', () => {
    const cnis = [...competencias('01/2015', '12/2016'), ...competencias('01/2026', '04/2026')]
    const r = diiCarenciaQualidade({ dii: '2026-05-20', competencias: cnis }, HOJE)
    expect([r.atende, detalhe(r, 'Carência'), detalhe(r, 'Perdeu a qualidade antes')]).toEqual([
      false,
      '4 de 6 contribuições antes da DII (depois da nova filiação)',
      'sim',
    ])
    expect(diiCarenciaQualidade({ dii: '2026-05-20', competencias: cnis, isentaDeCarencia: true }, HOJE).atende).toBe(true)
  })
  it('contribuição no mês da DII: em atividade', () => {
    const r = diiCarenciaQualidade({ dii: '2026-05-20', competencias: competencias('01/2025', '05/2026') }, HOJE)
    expect([r.atende, detalhe(r, 'Qualidade de segurado até')]).toEqual([true, 'em atividade no mês da DII'])
  })
})

describe('CA6, CA8 · entradas, regra e versão; mesmo insumo, mesmo resultado', () => {
  it('o resultado traz as entradas, o fundamento e a versão, e recalcular dá o mesmo', () => {
    const entrada = { inicio: '2024-03-10', persiste: true }
    const r = calcular('loas_24_meses', entrada, HOJE)
    expect([r.versao, r.hoje, r.entradas, r.fundamento]).toEqual([1, HOJE, entrada, 'Impedimento de longo prazo: efeitos por 2 anos ou mais (Lei 8.742, art. 20, §10)'])
    expect(calcular('loas_24_meses', entrada, HOJE)).toEqual(r)
  })
})
