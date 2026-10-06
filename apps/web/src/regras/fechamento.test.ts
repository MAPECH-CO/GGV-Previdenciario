import { describe, expect, it } from 'vitest'
import { MOTIVOS_DE_NAO_FECHAR } from '../dados/catalogos.ts'
import type { Agendamento, Fechamento } from '../dados/tipos.ts'
import {
  DIAS_PARA_ESPERAR,
  DIAS_PARA_PENSAR,
  arquivado,
  beneficioDoFechamento,
  dataSugeridaDeRecontato,
  motivoParadoDoFechamento,
  podeRegistrarOMotivo,
  precisaRegistrarFechamento,
  recontatoDevido,
  type EstadoDoFechamento,
} from './fechamento.ts'

const HOJE = '2026-10-05'
const realizada: Agendamento = { id: 'e1', data: '2026-10-04', hora: '10:00', oQue: 'Entrevista', estado: 'realizado' }
const fechamento = (f: Partial<Fechamento>): Fechamento => ({ situacao: 'recontatar', papel: 'atendimento', quem: 'Você (Atendimento)', quando: '', ...f })
const estado = (e: Partial<EstadoDoFechamento>): EstadoDoFechamento => ({
  fechou: false,
  motivo: 'preco',
  detalhe: '',
  papel: 'atendimento',
  recontatar: false,
  data: '',
  beneficio: 'loas-idoso',
  ...e,
})

describe('junção com o benefício definido e o cálculo (GGVP-51 e GGVP-57)', () => {
  const definido = { beneficio: 'aposentadoria-idade', agendamentoId: 'e1', quem: '', quando: '', fontes: [], recusouSugestao: false }
  it('no lead, fecha o benefício que a advogada definiu; na nova demanda, o da demanda', () => {
    expect(beneficioDoFechamento({ beneficioInteresse: 'loas-idoso', beneficioDefinido: definido })).toBe('aposentadoria-idade')
    expect(beneficioDoFechamento({ beneficioInteresse: 'loas-idoso' })).toBe('loas-idoso')
    const demanda = { id: 'd1', pretende: '', beneficio: 'auxilio-acidente', tipo: 'outro-pedido' as const, abertaPor: 'atendimento' as const, data: HOJE, quem: '', situacao: 'aberta' as const }
    expect(beneficioDoFechamento({ beneficioInteresse: 'auxilio-acidente', beneficioDefinido: definido, demandas: [demanda] })).toBe('auxilio-acidente')
  })
  it('"Sim, fechou" espera o cálculo de tempo e pontos; "Não fechou" não espera', () => {
    expect(motivoParadoDoFechamento(estado({ fechou: true, calculoPendente: true }), HOJE)).toMatch(/calcular o tempo e os pontos/)
    expect(motivoParadoDoFechamento(estado({ fechou: true, calculoPendente: false }), HOJE)).toBeNull()
    expect(motivoParadoDoFechamento(estado({ fechou: false, calculoPendente: true }), HOJE)).toBeNull()
  })
})

describe('GGVP-60 · registrar por que não virou cliente e recontatar', () => {
  it('CA12 · a data sugerida: 15 dias para quem ficou de pensar, 30 para quem pediu para esperar', () => {
    expect(DIAS_PARA_PENSAR).toBe(15)
    expect(DIAS_PARA_ESPERAR).toBe(30)
    expect(dataSugeridaDeRecontato(HOJE, 'pensar')).toBe('2026-10-20')
    expect(dataSugeridaDeRecontato(HOJE, 'esperar')).toBe('2026-11-04')
    expect(dataSugeridaDeRecontato('2026-12-20', 'esperar')).toBe('2027-01-19')
  })

  it('CA6 · a lista de motivos do cartão, na ordem', () => {
    expect(MOTIVOS_DE_NAO_FECHAR.map((m) => m.nome)).toEqual([
      'Preço',
      'Desistiu',
      'Ainda não tem direito',
      'Foi a outro escritório',
      'Sem retorno',
      'Contato inválido',
      'Fez o processo sozinho',
      'Falecido',
      'Recusado pelo escritório',
      'Outro',
    ])
  })

  it('CA1, CA5 e CA6 · a decisão é obrigatória, e o "Não fechou" exige o motivo (G16)', () => {
    expect(motivoParadoDoFechamento(estado({ fechou: null }), HOJE)).toBe('Responda se fechou com o escritório.')
    expect(motivoParadoDoFechamento(estado({ motivo: '' }), HOJE)).toBe('Escolha o motivo: sem ele o lead não pode ser encerrado (G16).')
    expect(motivoParadoDoFechamento(estado({ recontatar: null }), HOJE)).toBe('Responda se vale recontatar numa data prevista.')
    expect(motivoParadoDoFechamento(estado({ detalhe: 'x'.repeat(501) }), HOJE)).toBe('Detalhe até 500 caracteres.')
    expect(motivoParadoDoFechamento(estado({}), HOJE)).toBeNull()
  })

  it('CA5 · "Sim, fechou" segue para o kit só com o benefício definido', () => {
    expect(motivoParadoDoFechamento(estado({ fechou: true, motivo: '' }), HOJE)).toBeNull()
    expect(motivoParadoDoFechamento(estado({ fechou: true, beneficio: 'nao-sei' }), HOJE)).toBe('Falta o benefício definido pela advogada (D1.12).')
    expect(motivoParadoDoFechamento(estado({ fechou: true, beneficio: undefined }), HOJE)).toBe('Falta o benefício definido pela advogada (D1.12).')
  })

  it('CA2 e CA12 · com recontato, a data é de hoje em diante', () => {
    expect(motivoParadoDoFechamento(estado({ recontatar: true, data: '' }), HOJE)).toBe('Escolha a data do recontato, de hoje em diante.')
    expect(motivoParadoDoFechamento(estado({ recontatar: true, data: '04/10/2026' }), HOJE)).toBe('Escolha a data do recontato, de hoje em diante.')
    expect(motivoParadoDoFechamento(estado({ recontatar: true, data: '20/10/2026' }), HOJE)).toBeNull()
  })

  it('CA11 · "Recusado pelo escritório" só pelo Atendimento sênior ou pela advogada do atendimento', () => {
    expect(podeRegistrarOMotivo('recusado', 'atendimento')).toBe(false)
    expect(podeRegistrarOMotivo('recusado', 'atendimento-senior')).toBe(true)
    expect(podeRegistrarOMotivo('recusado', 'advogada-atendimento')).toBe(true)
    expect(podeRegistrarOMotivo('preco', 'atendimento')).toBe(true)
    expect(motivoParadoDoFechamento(estado({ motivo: 'recusado' }), HOJE)).toBe(
      'A recusa do escritório é registrada pelo Atendimento sênior ou pela advogada do atendimento.',
    )
  })

  it('CA5 e CA10 · o fechamento é pedido ao lead entrevistado, e de novo quando o recontato volta ao cálculo', () => {
    expect(precisaRegistrarFechamento({ situacao: 'lead', agendamentos: [realizada] })).toBe(true)
    expect(precisaRegistrarFechamento({ situacao: 'lead', agendamentos: [{ ...realizada, estado: 'marcado' }] })).toBe(false)
    expect(precisaRegistrarFechamento({ situacao: 'cliente', agendamentos: [realizada] })).toBe(false)
    expect(precisaRegistrarFechamento({ situacao: 'lead', agendamentos: [realizada], fechamento: fechamento({}) })).toBe(false)
    expect(precisaRegistrarFechamento({ situacao: 'lead', agendamentos: [realizada], fechamento: fechamento({ situacao: 'recalcular' }) })).toBe(true)
  })

  it('CA8 e CA9 · o recontato aparece na data e continua aberto depois dela, atrasado', () => {
    const f = { fechamento: fechamento({ recontatarEm: '2026-10-20' }) }
    expect(recontatoDevido(f, '2026-10-19')).toEqual({ devido: false, atrasado: false })
    expect(recontatoDevido(f, '2026-10-20')).toEqual({ devido: true, atrasado: false })
    expect(recontatoDevido(f, '2026-10-22')).toEqual({ devido: true, atrasado: true })
    expect(recontatoDevido({ fechamento: fechamento({ situacao: 'arquivado' }) }, '2026-10-22').devido).toBe(false)
  })

  it('CA7 · arquivado', () => {
    expect(arquivado({ fechamento: fechamento({ situacao: 'arquivado' }) })).toBe(true)
    expect(arquivado({})).toBe(false)
  })
})
