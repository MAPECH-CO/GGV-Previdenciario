import { describe, expect, it } from 'vitest'
import {
  DIAS_ENTRE_COBRANCAS,
  TENTATIVAS_DE_COBRANCA,
  ateQuando,
  limiteDeTentativas,
  mensagemDeCobranca,
  motivoParaNaoAdiar,
  motivoParaNaoCobrar,
  motivoParaNaoDecidir,
  naSenior,
  proximaTentativa,
  urgente,
  type EstadoDaCobranca,
  type TentativaDeCobranca,
} from './cobranca.ts'

const HOJE = '2026-10-05'
const tentativa = (dia: string, resultado: TentativaDeCobranca['resultado'] = 'sem-resposta'): TentativaDeCobranca => ({ dia, canal: 'chatwoot', resultado, quem: 'x' })
const cobranca = (resto: Partial<EstadoDaCobranca> = {}): EstadoDaCobranca => ({ abertaEm: HOJE, tentativas: [], decisoes: [], ...resto })

describe('Cobrança dos documentos pendentes (GGVP-101)', () => {
  it('CA3 · são 2 tentativas, com 3 dias entre elas', () => {
    expect(TENTATIVAS_DE_COBRANCA).toBe(2)
    expect(DIAS_ENTRE_COBRANCAS).toBe(3)
    expect(proximaTentativa(cobranca())).toBe(HOJE)
    expect(proximaTentativa(cobranca({ tentativas: [tentativa(HOJE)] }))).toBe('2026-10-08')
  })

  it('CA3 e CA7 · na segunda sem resposta, sobe para a sênior; respondeu, sobe só se o lembrete passar sem o documento', () => {
    expect(naSenior(cobranca({ tentativas: [tentativa('2026-10-02')] }), HOJE)).toBe(false)
    expect(naSenior(cobranca({ tentativas: [tentativa('2026-10-02'), tentativa(HOJE)] }), HOJE)).toBe(true)
    const respondeu = cobranca({ tentativas: [tentativa('2026-10-02'), tentativa(HOJE, 'respondeu')] })
    expect(naSenior(respondeu, HOJE)).toBe(false)
    expect(naSenior(respondeu, '2026-10-08')).toBe(true)
  })

  it('CA8 · nova tentativa ou visita da sênior dá mais uma tentativa ao Atendimento; a terceira sem resposta volta à sênior', () => {
    const decisao = { opcao: 'nova-tentativa' as const, justificativa: 'cliente viajando', prazo: '2026-10-09', quando: `${HOJE}T15:00:00.000Z`, quem: 'x' }
    const c = cobranca({ tentativas: [tentativa('2026-10-02'), tentativa(HOJE)], decisoes: [decisao], adiadaPara: '2026-10-09' })
    expect(limiteDeTentativas(c)).toBe(3)
    expect(naSenior(c, HOJE)).toBe(false)
    expect(proximaTentativa(c)).toBe('2026-10-09')
    expect(naSenior({ ...c, tentativas: [...c.tentativas, tentativa('2026-10-09')] }, '2026-10-09')).toBe(true)
  })

  it('CA5 · o lembrete vence no dia: antes, o Atendimento não cobra de novo e vê a data', () => {
    const c = cobranca({ tentativas: [tentativa('2026-10-02')] })
    expect(urgente(c, HOJE)).toBe(true)
    expect(motivoParaNaoCobrar(c, HOJE)).toBeNull()
    expect(motivoParaNaoCobrar(cobranca({ tentativas: [tentativa(HOJE)] }), HOJE)).toBe('A próxima tentativa é em 08/10, 3 dias depois da última.')
    expect(urgente(cobranca({ tentativas: [tentativa(HOJE)] }), HOJE)).toBe(false)
    expect(motivoParaNaoCobrar(cobranca({ tentativas: [tentativa('2026-10-01'), tentativa(HOJE)] }), HOJE)).toBe('Passou do limite de 2 tentativas: a sênior decide (G15).')
  })

  it('CA12 · com prazo do juiz, a próxima cabe antes dele e a tarefa é urgente', () => {
    const prazo = { de: 'juiz' as const, data: '2026-10-07' }
    const c = cobranca({ tentativas: [tentativa(HOJE)], prazo })
    expect(proximaTentativa(c)).toBe('2026-10-06')
    expect(urgente(c, HOJE)).toBe(true)
    // O prazo é amanhã: a próxima não fica antes da última; é hoje mesmo.
    expect(proximaTentativa(cobranca({ tentativas: [tentativa(HOJE)], prazo: { de: 'INSS', data: '2026-10-06' } }))).toBe(HOJE)
    // Sem prazo externo, o calendário normal.
    expect(proximaTentativa(cobranca({ tentativas: [tentativa(HOJE)] }))).toBe('2026-10-08')
    expect(ateQuando(HOJE, prazo)).toBe('2026-10-06')
    expect(ateQuando(HOJE)).toBe('2026-10-08')
  })

  it('CA10 · adiar pede a nova data, depois de hoje e antes do prazo; o contador não volta', () => {
    expect(motivoParaNaoAdiar(null, HOJE)).toBe('Informe a nova data (dd/mm/aaaa).')
    expect(motivoParaNaoAdiar(HOJE, HOJE)).toBe('A nova data tem de ser depois de hoje.')
    expect(motivoParaNaoAdiar('2026-10-07', HOJE, { de: 'juiz', data: '2026-10-07' })).toBe('O prazo do juiz é 07/10: a nova data tem de ser antes dele.')
    expect(motivoParaNaoAdiar('2026-10-06', HOJE)).toBeNull()
    const adiada = cobranca({ tentativas: [tentativa('2026-10-01')], adiadaPara: '2026-10-09' })
    expect(proximaTentativa(adiada)).toBe('2026-10-09')
    expect(adiada.tentativas).toHaveLength(1)
    // Depois da tentativa no dia adiado, volta o intervalo de 3 dias.
    expect(proximaTentativa({ ...adiada, tentativas: [...adiada.tentativas, tentativa('2026-10-09')] })).toBe('2026-10-12')
  })

  it('CA8 · decidir pede a opção, a justificativa e, na nova tentativa, o novo prazo', () => {
    expect(motivoParaNaoDecidir({ justificativa: 'x', prazo: null }, HOJE)).toBe('Escolha a decisão.')
    expect(motivoParaNaoDecidir({ opcao: 'nova-tentativa', justificativa: 'cliente viajando', prazo: null }, HOJE)).toBe('Informe o novo prazo, depois de hoje (dd/mm/aaaa).')
    expect(motivoParaNaoDecidir({ opcao: 'visita', justificativa: '  ', prazo: null }, HOJE)).toBe('A justificativa é obrigatória.')
    expect(motivoParaNaoDecidir({ opcao: 'suspender', justificativa: 'cliente desistiu', prazo: null }, HOJE)).toBeNull()
  })

  it('CA11 · a mensagem diz o que falta e até quando, em linguagem simples', () => {
    expect(mensagemDeCobranca({ nome: 'Rita Exemplo', beneficio: 'LOAS Deficiente', faltam: ['Comprovante de renda', 'Ficha de grupo familiar'], ate: '2026-10-08', hoje: HOJE })).toBe(
      'Olá, Rita! Aqui é do escritório GGV. Para o seu caso de LOAS Deficiente andar, ainda faltam: Comprovante de renda e Ficha de grupo familiar. ' +
        'Pode mandar foto por aqui ou trazer ao escritório até 08/10. Qualquer dúvida, é só responder esta mensagem.',
    )
  })
})
