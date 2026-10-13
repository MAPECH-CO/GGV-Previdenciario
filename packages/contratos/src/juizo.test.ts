import { describe, expect, it } from 'vitest'
import { EntendimentosDoJuizo, JurimetriaDoJuizo } from './juizo.ts'
import { ClassificarPublicacao, LeituraDaPublicacaoPelaIa } from './justica.ts'

describe('jurimetria do juízo (GGVP-64)', () => {
  const exemplo = {
    juizo: 'TRF3 · 6301',
    vara: null,
    juiz: null,
    entendimentos: [],
    base: '2026-10-08',
    porBeneficio: [{ beneficio: 'bpc_loas_deficiente', nome: 'BPC/LOAS deficiente', procedentes: 7, decididos: 12, texto: '58% em 12 processos · base de 08/10/2026' }],
    tempoAteASentenca: null,
    processos: [{ numeroCnj: '50001014520234036301', desfecho: 'procedente_total' }],
  }

  it('CA4 · cada taxa vem com os processos e a data da base; o tempo até a sentença pode faltar', () => {
    expect(JurimetriaDoJuizo.parse(exemplo)).toEqual(exemplo)
    expect(JurimetriaDoJuizo.parse({ ...exemplo, tempoAteASentenca: { meses: 14, processos: 3 } }).tempoAteASentenca).toEqual({ meses: 14, processos: 3 })
  })

  it('CA5 · sem a data da base, não vale', () => {
    const { base: _, ...semBase } = exemplo
    expect(JurimetriaDoJuizo.safeParse(semBase).success).toBe(false)
  })

  it('parte 2 · CA1, CA2 · a vara, o juiz e os entendimentos, cada um com os processos de exemplo', () => {
    const entendimentos = [{ texto: 'Exige o estudo social atualizado para o BPC.', processos: ['50001014520234036301'] }]
    const com = JurimetriaDoJuizo.parse({ ...exemplo, vara: '1ª Vara-Gabinete do JEF de São Paulo', juiz: 'Dra. Exemplo', entendimentos })
    expect([com.vara, com.juiz, com.entendimentos]).toEqual(['1ª Vara-Gabinete do JEF de São Paulo', 'Dra. Exemplo', entendimentos])
    // CA5: entendimento sem processo de exemplo não vale; a IA devolve no máximo 5.
    expect(EntendimentosDoJuizo.safeParse({ entendimentos: [{ texto: 'Sem exemplo.', processos: [] }] }).success).toBe(false)
    expect(EntendimentosDoJuizo.safeParse({ entendimentos: Array(6).fill(entendimentos[0]) }).success).toBe(false)
  })

  it('parte 2 · CA1 · a IA lê a vara e o juiz quando estão escritos; a pessoa confere, e vazio não apaga', () => {
    const lida = LeituraDaPublicacaoPelaIa.parse({ classe: 'merito', dias: null, resumo: 'Sentença.', vara: '  ', juiz: 'x'.repeat(130) })
    expect([lida.vara, lida.juiz?.length]).toEqual([null, 120])
    expect(LeituraDaPublicacaoPelaIa.parse({ classe: 'andamento', dias: null, resumo: 'Conclusos.' })).toMatchObject({ vara: null, juiz: null })
    expect(ClassificarPublicacao.parse({ classe: 'andamento', vara: ' 1ª Vara ', juiz: '' })).toEqual({ classe: 'andamento', dias: null, vara: '1ª Vara', juiz: null })
    const longa = ClassificarPublicacao.safeParse({ classe: 'andamento', vara: 'x'.repeat(121) })
    expect(longa.success ? '' : longa.error.issues[0].message).toBe('A vara tem até 120 caracteres')
  })
})
