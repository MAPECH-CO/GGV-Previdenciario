import { describe, expect, it } from 'vitest'
import type { Agendamento, Arquivo, Demanda } from '../dados/tipos.ts'
import { precisaRegistrarFechamento } from './fechamento.ts'
import {
  TAMANHO_DO_PEDIDO,
  demandaAberta,
  documentosAPedir,
  entrevistaDaDemanda,
  mandaBoasVindas,
  motivoParadoDaDemanda,
  nomeDaSubpasta,
  pessoaisNaPasta,
  precisaLigar,
  type EstadoDaDemanda,
} from './novaDemanda.ts'

const demanda = (d: Partial<Demanda>): Demanda => ({
  id: 'd1',
  pretende: 'auxílio-acidente pelo braço',
  beneficio: 'auxilio-acidente',
  tipo: 'outro-pedido',
  abertaPor: 'atendimento',
  data: '2026-10-05',
  quem: 'Você (Atendimento)',
  situacao: 'aberta',
  ...d,
})
const estado = (e: Partial<EstadoDaDemanda>): EstadoDaDemanda => ({ tipo: 'outro-pedido', pretende: 'seguro do consignado', beneficio: 'nao-sei', ...e })
const cliente = { situacao: 'cliente' as const, demandas: [] as Demanda[] }
const entrevista = (a: Partial<Agendamento>): Agendamento => ({ id: 'e1', data: '2026-10-07', hora: '10:00', oQue: 'Entrevista', ...a })
const arquivo = (a: Partial<Arquivo>): Arquivo => ({ nome: 'x.pdf', tipo: 'rg', local: 'pessoais', data: '2026-09-01', origem: 'card', repetido: false, aguardaLeitura: false, ...a })

describe('GGVP-124 · nova demanda de quem já é cliente', () => {
  it('CA1 e CA8 · abre para o cliente com o pedido e o benefício; recurso e defesa seguem no mesmo processo', () => {
    expect(motivoParadoDaDemanda(estado({}), cliente)).toBeNull()
    expect(motivoParadoDaDemanda(estado({}), { situacao: 'lead' })).toBe('Nova demanda é para quem já é cliente.')
    expect(motivoParadoDaDemanda(estado({ tipo: null }), cliente)).toBe('Responda o que a pessoa veio fazer.')
    expect(motivoParadoDaDemanda(estado({ tipo: 'recurso-ou-defesa' }), cliente)).toBe('Recurso e defesa seguem no mesmo processo: não abre processo novo.')
    expect(motivoParadoDaDemanda(estado({ tipo: 'tentar-de-novo' }), cliente)).toBeNull()
    expect(motivoParadoDaDemanda(estado({ pretende: '  ' }), cliente)).toBe('Escreva o que a pessoa quer.')
    expect(motivoParadoDaDemanda(estado({ pretende: 'a'.repeat(TAMANHO_DO_PEDIDO + 1) }), cliente)).toBe('O que a pessoa quer: até 500 caracteres.')
    expect(motivoParadoDaDemanda(estado({ beneficio: '' }), cliente)).toBe('Escolha o benefício de interesse.')
    expect(motivoParadoDaDemanda(estado({}), { ...cliente, demandas: [demanda({})] })).toBe('Já há uma nova demanda aberta: siga com ela.')
    expect(motivoParadoDaDemanda(estado({}), { ...cliente, demandas: [demanda({ situacao: 'fechou' })] })).toBeNull()
  })

  it('CA2 · a entrevista da demanda é a marcada no dia em que ela foi aberta ou depois', () => {
    const d = demanda({})
    expect(demandaAberta({ demandas: [demanda({ situacao: 'nao-fechou' }), d] })).toBe(d)
    expect(entrevistaDaDemanda({ agendamentos: [entrevista({ data: '2025-07-10', estado: 'realizado' })] }, d)).toBeUndefined()
    expect(entrevistaDaDemanda({ agendamentos: [entrevista({ estado: 'remarcado' })] }, d)).toBeUndefined()
    expect(entrevistaDaDemanda({ agendamentos: [entrevista({})] }, d)?.id).toBe('e1')
  })

  it('CA3 · com a entrevista da demanda feita, o cliente passa pelo "Fechou com o escritório?"', () => {
    const d = demanda({})
    const antiga = entrevista({ id: 'e0', data: '2025-07-10', estado: 'realizado' })
    expect(precisaRegistrarFechamento({ situacao: 'cliente', agendamentos: [antiga] })).toBe(false)
    expect(precisaRegistrarFechamento({ situacao: 'cliente', agendamentos: [antiga], demandas: [d] })).toBe(false)
    expect(precisaRegistrarFechamento({ situacao: 'cliente', agendamentos: [antiga, entrevista({})], demandas: [d] })).toBe(false)
    expect(precisaRegistrarFechamento({ situacao: 'cliente', agendamentos: [antiga, entrevista({ estado: 'realizado' })], demandas: [d] })).toBe(true)
    expect(
      precisaRegistrarFechamento({ situacao: 'cliente', agendamentos: [entrevista({ estado: 'realizado' })], demandas: [demanda({ situacao: 'fechou' })] }),
    ).toBe(false)
  })

  it('CA9 · aberta pela advogada, o Atendimento liga até a entrevista ser marcada', () => {
    const d = demanda({ abertaPor: 'advogada', tipo: 'tentar-de-novo' })
    expect(precisaLigar({ demandas: [d], agendamentos: [] })).toBe(true)
    expect(precisaLigar({ demandas: [d], agendamentos: [entrevista({})] })).toBe(false)
    expect(precisaLigar({ demandas: [demanda({})], agendamentos: [] })).toBe(false)
  })

  it('CA5 · o documento pessoal que já está na pasta não é pedido de novo; o do processo, sim', () => {
    const ficha = {
      documentos: [
        { nome: 'RG', detalhe: 'frente e verso' },
        { nome: 'Comp. residência', detalhe: '08/2026' },
        { nome: 'Procuração', detalhe: '26/09' },
      ],
      arquivos: [arquivo({ tipo: 'cnis' }), arquivo({ tipo: 'laudo', local: 'antonio-exemplo-1' })],
    }
    expect(pessoaisNaPasta(ficha)).toEqual(['rg', 'comprovante-residencia', 'cnis'])
    expect(documentosAPedir(['rg', 'cpf', 'comprovante-residencia', 'cnis', 'procuracao', 'laudo'], ficha)).toEqual(['cpf', 'procuracao', 'laudo'])
  })

  it('CA7 · a subpasta do processo novo leva o benefício e o ano', () => {
    expect(nomeDaSubpasta('auxilio-acidente', '2026-10-05')).toBe('AUXÍLIO ACIDENTÁRIO 2026')
    expect(nomeDaSubpasta('loas-idoso', '2027-01-02')).toBe('LOAS IDOSO 2027')
  })

  it('CA10 · a boas-vindas vai só no primeiro processo da ficha', () => {
    const ficha = { processos: [{ id: 'p1', beneficio: 'loas-idoso', etapa: '' }, { id: 'p2', beneficio: 'auxilio-acidente', etapa: '' }] }
    expect(mandaBoasVindas(ficha, 'p1')).toBe(true)
    expect(mandaBoasVindas(ficha, 'p2')).toBe(false)
  })
})
