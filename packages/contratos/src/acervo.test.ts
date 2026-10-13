import { describe, expect, it } from 'vitest'
import { CompletarAcervo, ConferirDesfecho, DESFECHOS_DO_ACERVO, FichaDoDesfecho, ROTULO_DESFECHO_DO_ACERVO } from './acervo.ts'
import { PedidoDoPainel, ROTULO_RECORTE } from './resultados.ts'

describe('conferência dos desfechos do acervo (GGVP-55)', () => {
  it('CA7 · o desfecho conferido é um da lista, cada um com o rótulo da tela', () => {
    expect(ConferirDesfecho.parse({ desfecho: 'extinto_sem_merito' })).toEqual({ desfecho: 'extinto_sem_merito' })
    expect(DESFECHOS_DO_ACERVO.map((d) => ROTULO_DESFECHO_DO_ACERVO[d])).toEqual(['Procedente', 'Procedente em parte', 'Acordo', 'Improcedente', 'Extinto sem mérito', 'Desistência', 'Deferido no INSS'])
  })

  it('CA7 · desfecho fora da lista volta com a mensagem', () => {
    const erro = ConferirDesfecho.safeParse({ desfecho: 'ganhou' })
    expect(erro.success ? '' : erro.error.issues[0].message).toBe('Escolha o desfecho')
  })
})

describe('ficha do desfecho no acervo (GGVP-41)', () => {
  const ficha = { materia: 'BPC/LOAS da pessoa com deficiência', vara: '', tese: 'Impedimento de longo prazo com renda acima de 1/4', resumo: 'O juiz concedeu.', licao: 'O laudo social decidiu.' }

  it('CA6 · matéria, resumo e lição obrigatórios; vara e tese vazias viram nulas (CA5)', () => {
    expect(FichaDoDesfecho.parse({ ...ficha, tese: '  ' })).toEqual({ ...ficha, vara: null, tese: null })
    expect(FichaDoDesfecho.safeParse({ ...ficha, licao: '' }).success).toBe(false)
  })

  it('CA3 · a tese longa é cortada no tamanho da Gestão; a Sênior escreve até 80 caracteres', () => {
    expect(FichaDoDesfecho.parse({ ...ficha, tese: 'x'.repeat(100) }).tese).toHaveLength(80)
    const longa = ConferirDesfecho.safeParse({ desfecho: 'procedente_total', tese: 'x'.repeat(81) })
    expect(longa.success ? '' : longa.error.issues[0].message).toBe('A tese tem até 80 caracteres')
    expect(ConferirDesfecho.parse({ desfecho: 'procedente_total', tese: ' Renda per capita ' })).toEqual({ desfecho: 'procedente_total', tese: 'Renda per capita' })
  })

  it('CA3 · a Gestão recorta por tese', () => {
    expect([PedidoDoPainel.parse({ recorte: 'tese' }).recorte, ROTULO_RECORTE.tese]).toEqual(['tese', 'Tese'])
  })
})

describe('pergunta de um clique (GGVP-153)', () => {
  it('CA1 · completa vara, juiz e tese, cada um no tamanho dele; vazio é o mesmo que não mandar', () => {
    expect(CompletarAcervo.parse({ vara: ' 1ª Vara do JEF (exemplo) ', tese: '' })).toEqual({ vara: '1ª Vara do JEF (exemplo)', juiz: undefined, tese: undefined })
    expect(CompletarAcervo.safeParse({ tese: 'x'.repeat(81) }).error?.issues[0].message).toBe('A tese tem até 80 caracteres')
    expect(CompletarAcervo.safeParse({ juiz: 'x'.repeat(121) }).error?.issues[0].message).toBe('O nome do juiz tem até 120 caracteres')
    expect(CompletarAcervo.safeParse({ vara: '  ' }).error?.issues[0].message).toBe('Escolha ou escreva o que falta.')
  })
})
