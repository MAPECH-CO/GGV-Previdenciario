import { describe, expect, it } from 'vitest'
import { AdiamentoDaCobranca, DecisaoDaCobranca, TentativaDaCobranca } from './recepcao.ts'

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
