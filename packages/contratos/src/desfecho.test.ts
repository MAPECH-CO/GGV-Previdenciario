import { describe, expect, it } from 'vitest'
import { AprovarResumo, RegistrarContato } from './desfecho.ts'

const erro = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message

describe('GGVP-22 · explicar o resultado ao cliente', () => {
  it('CA3, CA5 · o resumo tem texto e diz quem fala com o cliente', () => {
    const ok = { texto: 'O juiz entendeu que a incapacidade não ficou provada no período pedido.', quemFala: 'atendimento' }
    expect(AprovarResumo.parse(ok).quemFala).toBe('atendimento')
    expect(erro(AprovarResumo.safeParse({ ...ok, texto: 'curto' }))).toBe('Escreva o resumo para o cliente (20 letras ou mais)')
    expect(erro(AprovarResumo.safeParse({ ...ok, quemFala: 'financeiro' }))).toBe('Escolha quem fala com o cliente')
  })

  it('CA4 · sem contato pede só o canal; explicado pede o que foi dito', () => {
    expect(RegistrarContato.parse({ resultado: 'sem_contato', canal: 'telefone' })).toEqual({ resultado: 'sem_contato', canal: 'telefone' })
    expect(erro(RegistrarContato.safeParse({ resultado: 'explicado', canal: 'telefone', explicado: ' ' }))).toBe('Escreva o que foi explicado ao cliente')
    expect(erro(RegistrarContato.safeParse({ resultado: 'sem_contato' }))).toBe('Escolha o canal do contato')
  })
})
