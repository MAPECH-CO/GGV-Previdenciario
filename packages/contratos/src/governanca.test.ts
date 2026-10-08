import { describe, expect, it } from 'vitest'
import { EntradaDii, EntradaIncapacidade, EntradaLoas24, MESES_LOAS, TentativasBloqueadas, mesesEntre, travaDoParecer } from './governanca.ts'

const erros = (r: { error?: { issues: { message: string }[] } }) => r.error?.issues.map((i) => i.message)

describe('TentativasBloqueadas (GGVP-109 CA9)', () => {
  it('quem, quando, caso e portão; portão fora da lista é recusado', () => {
    const t = { quando: '2026-10-06T12:00:00.000Z', quem: 'Gabi', perfil: 'advogada', casoId: null, cliente: null, portao: 'G8', descricao: 'Aviso' }
    expect(TentativasBloqueadas.parse({ tentativas: [t] }).tentativas[0].portao).toBe('G8')
    expect(TentativasBloqueadas.safeParse({ tentativas: [{ ...t, portao: 'G99' }] }).success).toBe(false)
  })
})

describe('meses do LOAS (G19): a mesma conta na tela e no servidor', () => {
  it('o mês só conta quando o dia chega; 24 meses é o mínimo', () => {
    expect(mesesEntre('2025-01', '2026-12')).toBe(23)
    expect(mesesEntre('2025-01-15', '2027-01-14')).toBe(23)
    expect(mesesEntre('2025-01-15', '2027-01-15')).toBe(MESES_LOAS)
  })
})

describe('entradas das regras (GGVP-25)', () => {
  it('CA4 · dado que falta passa (a regra responde "não calculável"); data errada não', () => {
    expect(EntradaLoas24.parse({})).toEqual({})
    expect(EntradaLoas24.parse({ inicio: '10/03/2024', persiste: true })).toEqual({ inicio: '2024-03-10', persiste: true })
    expect(erros(EntradaLoas24.safeParse({ inicio: '31/02/2024' }))).toEqual(['Informe a data de início do impedimento (dd/mm/aaaa)'])
  })

  it('atestado com dias inteiros e a correlação marcada', () => {
    expect(erros(EntradaIncapacidade.safeParse({ atestados: [{ inicio: '01/09/2026', dias: 0, correlacionado: true }] }))).toEqual([
      'Os dias do atestado são um número inteiro maior que zero',
    ])
    expect(erros(EntradaIncapacidade.safeParse({ atestados: [{ inicio: '01/09/2026', dias: 5 }] }))).toEqual([
      'Marque se a doença do atestado é clinicamente correlacionada',
    ])
  })

  it('competência no formato mm/aaaa', () => {
    expect(EntradaDii.parse({ dii: '15/08/2026', competencias: ['01/2026'] })).toEqual({ dii: '2026-08-15', competencias: ['01/2026'] })
    expect(erros(EntradaDii.safeParse({ competencias: ['13/2026'] }))).toEqual(['Competência no formato mm/aaaa'])
  })
})

describe('DecidirLaco (GGVP-94 CA9)', () => {
  it('o que o setor deve fazer é obrigatório', async () => {
    const { DecidirLaco } = await import('./exigencia.ts')
    expect(DecidirLaco.parse({ oQueFazer: ' Ligar para a filha ' })).toEqual({ oQueFazer: 'Ligar para a filha' })
    expect(DecidirLaco.safeParse({ oQueFazer: ' ' }).error?.issues.map((i) => i.message)).toEqual(['Escreva o que o setor deve fazer'])
  })
})

describe('histórico e cofre (GGVP-99, GGVP-103)', () => {
  it('o motivo da exportação é obrigatório; a senha do gov.br não perde espaço', async () => {
    const { CadastrarSenhaGovbr, PedirExportacao } = await import('./governanca.ts')
    expect(PedirExportacao.safeParse({ motivo: '  ' }).error?.issues.map((i) => i.message)).toEqual(['Escreva o motivo do pedido'])
    expect(CadastrarSenhaGovbr.parse({ senha: ' a b ' })).toEqual({ senha: ' a b ' })
    expect(CadastrarSenhaGovbr.safeParse({ senha: '' }).error?.issues.map((i) => i.message)).toEqual(['Digite a senha do gov.br'])
  })
})

describe('configuração do escritório (GGVP-104)', () => {
  it('parâmetro é número inteiro pelo campos; o kit não repete documento e não fica vazio; todo benefício tem rótulo', async () => {
    const { BENEFICIOS, PublicarKit, ROTULO_BENEFICIO, SalvarParametro } = await import('./governanca.ts')
    expect(SalvarParametro.parse({ valor: '3' })).toEqual({ valor: 3 })
    expect(SalvarParametro.safeParse({ valor: '3,5' }).error?.issues.map((i) => i.message)).toEqual(['Informe um número inteiro'])
    expect(PublicarKit.safeParse({ itens: [] }).error?.issues.map((i) => i.message)).toEqual(['O kit precisa de ao menos um documento'])
    const repetido = { itens: [{ tipoDocumento: 'rg', obrigatorio: true }, { tipoDocumento: 'rg', obrigatorio: false }] }
    expect(PublicarKit.safeParse(repetido).error?.issues.map((i) => i.message)).toEqual(['Cada documento entra uma vez no kit'])
    expect(BENEFICIOS.every((b) => ROTULO_BENEFICIO[b])).toBe(true)
  })
})

describe('travaDoParecer (G17, G18; GGVP-109 e GGVP-33)', () => {
  const LOAS = 'bpc_loas_deficiente'
  it('em ordem: "Suficiente" ou dispensado; benefício sem laudo não pede parecer', () => {
    expect(travaDoParecer('aprovar-inss', LOAS, { situacao: 'suficiente' })).toBeNull()
    expect(travaDoParecer('liberar', LOAS, { situacao: 'dispensado' })).toBeNull()
    expect(travaDoParecer('aprovar-inss', 'pensao_morte', null)).toBeNull()
  })

  it('cada motivo diz a ação e o que falta', () => {
    expect(travaDoParecer('aprovar-inss', LOAS, null)).toBe('Não dá para aprovar para o INSS: falta o parecer médico "Suficiente", confirmado por pessoa (G17).')
    expect(travaDoParecer('liberar', LOAS, { situacao: 'insuficiente' })).toMatch(/^Não dá para liberar ao Jurídico: o parecer médico está Insuficiente/)
    expect(travaDoParecer('pedir-peticao', LOAS, { situacao: 'contraditorio' })).toMatch(/^Não dá para pedir a petição: .*Contraditório \(G18\)/)
    expect(travaDoParecer('aprovar-inss', LOAS, { situacao: 'pendente' })).toMatch(/não foi confirmado por pessoa do Jurídico \(G17\)/)
    expect(travaDoParecer('aprovar-inss', LOAS, { situacao: 'suficiente', contradicoes: [{ id: 'x', texto: 'Menos de 24 meses' }] })).toMatch(/\(menos de 24 meses\).*\(G18\)/)
  })

  it('laudo novo esperando trava mesmo com o parecer em ordem; dispensa pedida espera a segunda Sênior', () => {
    expect(travaDoParecer('aprovar-inss', LOAS, { situacao: 'suficiente' }, { laudoNovoEsperando: true })).toMatch(/laudo novo esperando/)
    expect(travaDoParecer('aprovar-inss', LOAS, null, { dispensaPedida: true })).toMatch(/espera a aprovação de outra Sênior/)
  })

  it('benefício ainda não definido pede parecer: na dúvida, fechado', () => {
    expect(travaDoParecer('aprovar-inss', null, null)).not.toBeNull()
  })
})
