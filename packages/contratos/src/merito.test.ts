import { describe, expect, it } from 'vitest'
import { ConfirmarDesfecho } from './merito.ts'

const erro = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message

describe('GGVP-90 · confirmar o desfecho de mérito', () => {
  it('CA3 · as quatro opções; fora delas, o motivo', () => {
    for (const desfecho of ['procedente_total', 'procedente_parcial', 'improcedente', 'extinto_sem_merito'])
      expect(ConfirmarDesfecho.safeParse({ desfecho, causa: 'Não cumpriu determinação do juízo' }).success).toBe(true)
    expect(erro(ConfirmarDesfecho.safeParse({ desfecho: 'deferido' }))).toBe('Escolha o desfecho da decisão')
  })

  it('CA3 · a extinção sem mérito pede a causa', () => {
    expect(erro(ConfirmarDesfecho.safeParse({ desfecho: 'extinto_sem_merito', causa: '  ' }))).toBe('Escreva a causa da extinção sem mérito')
  })

  it('CA4 · a forma de pagamento vale só para o procedente, e é opcional', () => {
    expect(ConfirmarDesfecho.parse({ desfecho: 'procedente_parcial', forma: 'rpv' }).forma).toBe('rpv')
    expect(ConfirmarDesfecho.parse({ desfecho: 'procedente_total' }).forma).toBeUndefined()
    expect(erro(ConfirmarDesfecho.safeParse({ desfecho: 'improcedente', forma: 'precatorio' }))).toBe('A forma de pagamento vale só para o procedente')
  })
})
