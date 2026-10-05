import { describe, expect, it } from 'vitest'
import { Pessoa, Saude } from './index.ts'

const id = '6f1c2a8e-3b4d-4c5e-8f60-718293a4b5c6'

describe('Saude', () => {
  it('aceita a resposta da API e recusa outra forma', () => {
    expect(Saude.parse({ ok: true, servico: 'api' })).toEqual({ ok: true, servico: 'api' })
    expect(Saude.safeParse({ ok: false, servico: 'api' }).success).toBe(false)
  })
})

describe('Pessoa', () => {
  it('normaliza nome e CPF com as funções de @ggv/campos', () => {
    expect(Pessoa.parse({ id, nome: '  Ana   Lima ', cpf: '529.982.247-25' })).toEqual({
      id,
      nome: 'Ana Lima',
      cpf: '52998224725',
    })
  })

  it('recusa CPF com dígito errado e nome com número', () => {
    const cpf = Pessoa.safeParse({ id, nome: 'Ana Lima', cpf: '529.982.247-26' })
    expect(cpf.success).toBe(false)
    expect(cpf.error?.issues[0]?.message).toBe('CPF inválido')

    const nome = Pessoa.safeParse({ id, nome: 'Jo4o' })
    expect(nome.error?.issues[0]?.message).toBe('Nome inválido')
  })

  it('aceita pessoa sem CPF', () => {
    expect(Pessoa.parse({ id, nome: 'Ana Lima' })).toEqual({ id, nome: 'Ana Lima' })
  })
})
