import { describe, expect, it } from 'vitest'
import { ConferirDesfecho, DESFECHOS_DO_ACERVO, ROTULO_DESFECHO_DO_ACERVO } from './acervo.ts'

describe('conferência dos desfechos do acervo (GGVP-55)', () => {
  it('CA7 · o desfecho conferido é um da lista, cada um com o rótulo da tela', () => {
    expect(ConferirDesfecho.parse({ desfecho: 'extinto_sem_merito' })).toEqual({ desfecho: 'extinto_sem_merito' })
    expect(DESFECHOS_DO_ACERVO.map((d) => ROTULO_DESFECHO_DO_ACERVO[d])).toEqual(['Procedente', 'Procedente em parte', 'Acordo', 'Improcedente', 'Extinto sem mérito', 'Desistência'])
  })

  it('CA7 · desfecho fora da lista volta com a mensagem', () => {
    const erro = ConferirDesfecho.safeParse({ desfecho: 'ganhou' })
    expect(erro.success ? '' : erro.error.issues[0].message).toBe('Escolha o desfecho')
  })
})
