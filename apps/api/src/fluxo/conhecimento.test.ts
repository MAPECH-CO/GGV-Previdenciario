import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { cnjDeTeste, instalarConhecimentoDeTeste, recarregarBaseDeTeste } from '../banco/conhecimento-de-teste.ts'
import { baseHistorica, baseHistoricaDoBeneficio, fundamentosDoJuizo, juizosComFundamentos, laudosHistoricosDoPerito, temBaseHistorica, textosDosFundamentos, trechosHistoricos } from './conhecimento.ts'

// GGVP-163 R1 a R5: a leitura da base histórica, só pelas vistas, com dados inventados no banco embutido.
let banco: Banco
let fechar: () => Promise<void>
beforeEach(async () => ({ banco, fechar } = await abrirBancoEmbutido()))
afterEach(() => fechar())

describe('GGVP-163 R1 · a base histórica, só pelas vistas', () => {
  it('sem o schema, nada quebra: a base é nula, e cada leitura devolve vazio', async () => {
    expect(await temBaseHistorica(banco)).toBe(false)
    expect(await baseHistorica(banco)).toBeNull()
    expect(await laudosHistoricosDoPerito(banco, { nome: 'Helio de Tal Perito' })).toBeNull()
    expect(await fundamentosDoJuizo(banco, 'TRF3 · 6301')).toBeNull()
    expect(await trechosHistoricos(banco)).toEqual([])
    expect(await juizosComFundamentos(banco)).toEqual([])
    expect(await baseHistoricaDoBeneficio(banco, 'bpc_loas_deficiente')).toEqual({ beneficio: 'bpc_loas_deficiente', nome: 'BPC/LOAS Deficiente', dataDaBase: null, sintese: [], indicadores: [] })
  })

  it('CA4 · a data da base vem da tabela a cada leitura: recarregada, a data nova aparece sem subir o portal', async () => {
    await instalarConhecimentoDeTeste(banco)
    expect(await baseHistorica(banco)).toEqual({ dataDaBase: '2026-10-16', carregadoEm: '2026-10-16T17:47:04.438Z', raioX: '21/09/2026' })
    await recarregarBaseDeTeste(banco, '2026-10-20')
    expect((await baseHistorica(banco))?.dataDaBase).toBe('2026-10-20')
    expect((await baseHistoricaDoBeneficio(banco, 'bpc_loas_deficiente')).dataDaBase).toBe('2026-10-20')
  })
})

describe('GGVP-163 R2 · os laudos históricos do perito', () => {
  beforeEach(() => instalarConhecimentoDeTeste(banco))

  it('CA1 · o perito de registro 190895 casa pelo nome normalizado: 38 laudos, 11 favoráveis, cada um com a referência do processo e sem cliente', async () => {
    const h = await laudosHistoricosDoPerito(banco, { nome: 'Helio de Tal Perito', nomeNormalizado: 'helio de tal perito' })
    expect(h).toMatchObject({ nome: 'HELIO DE TAL PERITO', registro: '190895', laudosNaBase: 38, favoraveisNaBase: 11 })
    expect(h!.laudos).toHaveLength(38)
    expect(h!.laudos.filter((l) => l.resultado === 'favoravel')).toHaveLength(11)
    expect(h!.laudos[0]).toEqual({
      id: `conhecimento:${cnjDeTeste(100, 2023)}`,
      caso: cnjDeTeste(100, 2023),
      data: '2026-10-16',
      tipo: 'medica',
      assunto: 'BPC/LOAS Deficiente',
      beneficio: 'loas-deficiente',
      resultado: 'favoravel',
      dias: 0,
      historico: true,
      observou: ['rotina relatada e documentos médicos coerentes'],
      perguntou: [],
      pediu: [],
    })
  })

  it('casa por uma grafia da base ou do portal, sem o título; sem par, nulo', async () => {
    expect((await laudosHistoricosDoPerito(banco, { nome: 'Dr. Helio Perito' }))?.registro).toBe('190895')
    expect((await laudosHistoricosDoPerito(banco, { nome: 'Outro Nome', grafias: ['Dra. Maria Social de Teste'] }))?.registro).toBe('CRESS 12345')
    expect((await laudosHistoricosDoPerito(banco, { nome: 'Maria Social de Teste' }))?.laudos.map((l) => l.tipo)).toEqual(Array(5).fill('social'))
    expect(await laudosHistoricosDoPerito(banco, { nome: 'Ninguém da Base' })).toBeNull()
  })
})

describe('GGVP-163 R3 · os fundamentos históricos do juízo', () => {
  beforeEach(() => instalarConhecimentoDeTeste(banco))

  it('CA2 · o "TRF3 · 6301" tem fundamentos de 552 processos, por tipo e benefício, com até 3 exemplos cada', async () => {
    const f = await fundamentosDoJuizo(banco, 'TRF3 · 6301')
    expect(f?.processos).toBe(552)
    expect(f?.grupos.map((g) => [g.tipo, g.nome, g.processos])).toEqual([
      ['fundamento', 'Auxílio por Incapacidade Temporária', 184],
      ['fundamento', 'BPC/LOAS Deficiente', 184],
      ['fundamento', 'BPC/LOAS Idoso', 184],
      ['acordao', 'Auxílio por Incapacidade Temporária', 44],
      ['acordao', 'BPC/LOAS Deficiente', 44],
      ['acordao', 'BPC/LOAS Idoso', 44],
    ])
    expect(f?.grupos[0].exemplos).toHaveLength(3)
    expect(f?.grupos[1].exemplos[0]).toEqual({ processo: cnjDeTeste(0, 2022), texto: expect.stringContaining('Fundamento de teste 1') })
    expect(await fundamentosDoJuizo(banco, 'TRF3 · 9999')).toEqual({ processos: 0, grupos: [] })
    expect((await juizosComFundamentos(banco)).sort()).toEqual(['TRF3 · 6100', 'TRF3 · 6301'])
    expect(await textosDosFundamentos(banco, 'TRF3 · 6100', 2)).toHaveLength(2)
  })
})

describe('GGVP-163 R4 e R5 · os trechos e a página do benefício', () => {
  beforeEach(() => instalarConhecimentoDeTeste(banco))

  it('R4 · os trechos saem na forma do acervo, com a origem visível, a referência do processo e o hash da vista', async () => {
    const t = await trechosHistoricos(banco)
    expect(t).toHaveLength(4)
    expect(t[0]).toEqual({
      origem: 'Base histórica · fundamento',
      referencia: `processo:${cnjDeTeste(7, 2024).replace(/\D/g, '')}`,
      beneficio: 'bpc_loas_deficiente',
      texto: expect.stringContaining('renda per capita'),
      soJuridico: false,
      hash: 'a1'.repeat(32),
    })
    expect(t[3].referencia).toBe('conhecimento:bpc_loas_deficiente')
  })

  it('CA3 · a página do LOAS deficiente: a síntese na ordem e as taxas do geral e por ano, nunca por juiz; "4 de 115" com a data da base', async () => {
    const p = await baseHistoricaDoBeneficio(banco, 'bpc_loas_deficiente')
    expect(p.nome).toBe('BPC/LOAS Deficiente')
    expect(p.dataDaBase).toBe('2026-10-16')
    expect(p.sintese.map((s) => s.ordem)).toEqual([1, 2])
    expect(p.indicadores.map((i) => [i.recorte, i.nome, i.n, i.sim])).toEqual([
      ['geral', 'Êxito no mérito', 192, 63],
      ['geral', 'Extinção sem mérito', 351, 159],
      ['geral', 'Êxito com laudo favorável', 72, 55],
      ['geral', 'Êxito com laudo desfavorável', 115, 4],
      ['ano', 'Êxito no mérito · 2023', 80, 20],
    ])
    expect(p.indicadores.find((i) => i.indicador === 'exito_com_laudo_desfavoravel')).toMatchObject({ n: 115, sim: 4, baseEm: '2026-10-16' })
    expect((await baseHistoricaDoBeneficio(banco, 'pensao_morte')).indicadores).toEqual([])
  })
})
