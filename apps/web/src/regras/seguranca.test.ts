import { describe, expect, it } from 'vitest'
import {
  COMO_VERIFICOU,
  erroDosDadosBancarios,
  ehProtegido,
  motivoParaNaoMudar,
  pertoDaPrestacao,
  podeConfirmarSegunda,
  retornoPeloContato,
  verificacaoDaConversa,
} from './seguranca.ts'

describe('Terceiro não se passa pelo cliente (GGVP-111)', () => {
  it('CA1 · telefone, e-mail e dados bancários só mudam com a verificação (vídeo ou no escritório) e em contrato novo', () => {
    expect(Object.values(COMO_VERIFICOU)).toEqual(['Chamada de vídeo com o cliente', 'Cliente no escritório'])
    expect(['telefone', 'email', 'dadosBancarios', 'endereco'].map(ehProtegido)).toEqual([true, true, true, false])
    expect(motivoParaNaoMudar('telefone', null)).toBe('Telefone, e-mail e dados bancários só mudam com o cliente verificado por chamada de vídeo ou no escritório.')
    expect(motivoParaNaoMudar('email', { como: 'video' })).toBe('A alteração vai em contrato novo: marque que ela vai no contrato novo.')
    expect(motivoParaNaoMudar('telefone', { como: 'video', contratoNovo: true })).toBeNull()
    expect(motivoParaNaoMudar('endereco', null)).toBeNull()
  })

  it('CA8 · na conversa presencial com o próprio cliente vale a verificação; na ligação ou com outra pessoa, não', () => {
    expect(verificacaoDaConversa({ canal: 'presencial', comQuem: 'cliente' })).toEqual({ como: 'presencial', contratoNovo: true })
    expect(verificacaoDaConversa({ canal: 'ligacao', comQuem: 'cliente' })).toBeNull()
    expect(verificacaoDaConversa({ canal: 'presencial', comQuem: 'familiar' })).toBeNull()
  })

  it('CA3 · sem verificação, o retorno pelo contato cadastrado', () => {
    expect(retornoPeloContato('(11) 90000-0004')).toBe('Sem a verificação, não passe dado do caso. Diga só: "Vou retornar pelo contato cadastrado", e ligue para (11) 90000-0004.')
  })

  it('CA5 · os dados bancários e a segunda confirmação, de outra pessoa do Atendimento líder ou do Jurídico', () => {
    expect(erroDosDadosBancarios({ banco: 'Banco Exemplo', agencia: '0001', conta: '12345-6' })).toBeNull()
    expect(erroDosDadosBancarios({ banco: 'Banco Exemplo', agencia: '1', conta: '12345-6' })).toMatch(/^Agência/)
    expect(erroDosDadosBancarios({ banco: 'Banco Exemplo', agencia: '0001', conta: '123456' })).toMatch(/^Conta/)
    expect(erroDosDadosBancarios({ banco: '', agencia: '0001', conta: '12345-6' })).toBe('Escreva o banco.')
    expect(podeConfirmarSegunda('atendimento-lider', 'Carla (exemplo)', 'Ana (exemplo)')).toBeNull()
    expect(podeConfirmarSegunda('advogada', 'Dra. Paula (exemplo)', 'Ana (exemplo)')).toBeNull()
    expect(podeConfirmarSegunda('atendimento', 'Ana (exemplo)', 'Ana (exemplo)')).toBe('A segunda confirmação é de outra pessoa, não de quem pediu.')
    expect(podeConfirmarSegunda('documentacao', 'Jéssica (exemplo)', 'Ana (exemplo)')).toBe('A segunda confirmação é do Atendimento líder, da advogada ou da Sênior.')
  })

  it('CA2 · perto da prestação de contas: ganho na sentença, RPV ou benefício deferido', () => {
    expect(['Judicial · sentença procedente', 'Benefício deferido', 'Judicial · RPV expedida', 'Administrativo · perícia em 02/10'].map(pertoDaPrestacao)).toEqual([true, true, true, false])
  })
})
