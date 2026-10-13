import { describe, expect, it } from 'vitest'
import { AdiamentoDaCobranca, CnisDigitado, DecisaoDaCobranca, TentativaDaCobranca } from './recepcao.ts'

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
