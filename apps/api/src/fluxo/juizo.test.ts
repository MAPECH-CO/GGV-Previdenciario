import { ROTULO_BENEFICIO } from '@ggv/contratos'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, identificadorCaso, peticao, peticaoVersao, pessoa, processoAcervo, protocoloJudicial, publicacao, usuario } from '../banco/esquema.ts'
import { criarIa } from '../ia/ia.ts'
import { entendimentosDoJuizo, juizoDoCnj, juizosParaLer, jurimetriaDoJuizo } from './juizo.ts'

describe('juízo identificado (GGVP-64)', () => {
  it('CA1 · o juízo sai do número CNJ: tribunal e unidade de origem, com ou sem a máscara', () => {
    expect(juizoDoCnj('00012349620264036301')).toBe('TRF3 · 6301')
    expect(juizoDoCnj('0001234-96.2026.4.03.6301')).toBe('TRF3 · 6301')
    expect(juizoDoCnj('10012345620268260100')).toBe('TJSP · 0100')
    // Tribunal fora da tabela aparece pelo próprio código.
    expect(juizoDoCnj('00012345620265150001')).toBe('5.15 · 0001')
  })

  it('CA1 · número que não é CNJ não identifica juízo', () => {
    expect(juizoDoCnj('1234')).toBeNull()
  })
})

describe('jurimetria do juízo (GGVP-64)', () => {
  let banco: Banco
  let fechar: () => Promise<void>
  let senior: string
  const AGORA = new Date('2026-10-08T15:00:00Z')
  const JUIZO = 'TRF3 · 6301'
  beforeEach(async () => {
    ;({ banco, fechar } = await abrirBancoEmbutido())
    senior = (await banco.insert(usuario).values({ email: 'helena@exemplo.ggv', nome: 'Helena (exemplo)', senhaHash: 'x' }).returning())[0].id
  })
  afterEach(() => fechar())

  it('CA2, CA4, CA5 · procedência por benefício só com desfecho conferido e de mérito, cada taxa com os processos e a data da base', async () => {
    const conferido = (numeroCnj: string, desfecho: string) => ({ numeroCnj, beneficio: 'bpc_loas_deficiente', desfecho, desfechoConferidoPor: senior, fonte: 'importacao' })
    await banco.insert(processoAcervo).values([
      conferido('00000011220204036301', 'procedente_total'),
      conferido('00000021220204036301', 'procedente_parcial'),
      conferido('00000031220204036301', 'improcedente'),
      // Ficam fora: sem conferência, sem mérito (acordo) e de outra unidade.
      { numeroCnj: '00000041220204036301', beneficio: 'bpc_loas_deficiente', desfecho: 'improcedente', fonte: 'lote' },
      conferido('00000051220204036301', 'acordo'),
      conferido('00000061220204036183', 'improcedente'),
    ])
    const j = await jurimetriaDoJuizo(banco, JUIZO, AGORA)
    expect(j.porBeneficio).toEqual([
      { beneficio: 'bpc_loas_deficiente', nome: ROTULO_BENEFICIO.bpc_loas_deficiente, procedentes: 2, decididos: 3, texto: '67% em 3 processos · base de 08/10' },
    ])
    expect(j.processos.map((p) => p.numeroCnj)).toEqual(['00000011220204036301', '00000021220204036301', '00000031220204036301'])
    expect([j.juizo, j.base, j.tempoAteASentenca]).toEqual([JUIZO, '2026-10-08', null])
  })

  it('CA2 · tempo até a sentença: do protocolo da inicial à decisão, só com as duas datas; o CNJ pode vir do caso ligado', async () => {
    const [p] = await banco.insert(pessoa).values({ nome: 'Pessoa (exemplo)' }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'aposentadoria_pcd' }).returning()
    await banco.insert(identificadorCaso).values({ casoId: c.id, tipo: 'cnj', valor: '0001234-96.2025.4.03.6301' })
    const [inicial] = await banco.insert(peticao).values({ casoId: c.id, tipo: 'inicial' }).returning()
    const [v] = await banco.insert(peticaoVersao).values({ peticaoId: inicial.id, numero: 1, conteudo: 'Petição (exemplo)', hash: 'h', geradaPor: 'pessoa' }).returning()
    await banco.insert(protocoloJudicial).values({ peticaoVersaoId: v.id, tribunal: 'TRF3', protocoladoEm: new Date('2025-01-10T15:00:00Z'), protocoladoPor: senior })
    await banco.insert(processoAcervo).values([
      { casoId: c.id, beneficio: 'aposentadoria_pcd', desfecho: 'procedente_total', desfechoConferidoPor: senior, dataDecisao: '2026-01-10', fonte: 'portal' },
      // Com a decisão e sem o protocolo: entra na taxa e fica fora do tempo.
      { numeroCnj: '00000071220204036301', beneficio: 'aposentadoria_pcd', desfecho: 'improcedente', desfechoConferidoPor: senior, dataDecisao: '2026-02-01', fonte: 'importacao' },
    ])
    const j = await jurimetriaDoJuizo(banco, JUIZO, AGORA)
    expect(j.tempoAteASentenca).toEqual({ meses: 12, processos: 1 })
    expect(j.porBeneficio).toMatchObject([{ beneficio: 'aposentadoria_pcd', procedentes: 1, decididos: 2, texto: '50% em 2 processos · base de 08/10' }])
    expect(j.processos.map((x) => x.numeroCnj)).toEqual(['00000071220204036301', '00012349620254036301'])
  })

  it('CA4 · juízo sem processo conferido: nenhuma taxa, e nada trava', async () => {
    const j = await jurimetriaDoJuizo(banco, 'TRF3 · 6183', AGORA)
    expect([j.porBeneficio, j.tempoAteASentenca, j.processos, j.entendimentos, j.vara]).toEqual([[], null, [], [], null])
  })
})

describe('entendimentos recorrentes do juízo (GGVP-64 parte 2)', () => {
  let banco: Banco
  let fechar: () => Promise<void>
  const AGORA = new Date('2026-10-09T03:00:00Z')
  const ANTES = new Date('2026-10-01T15:00:00Z')
  let pedidos: string[] = []
  const iaFalsa = (resposta: object) =>
    criarIa({
      banco,
      ambiente: { OPENAI_API_KEY: 'chave-de-teste', IA_PERMITE_DADO_DE_SAUDE: 'sim' },
      agora: () => AGORA,
      fetch: async (_url: unknown, init?: RequestInit) => {
        pedidos.push(String(init?.body ?? ''))
        return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(resposta) } }] }))
      },
    })
  /** Uma decisão de mérito publicada no processo do cliente. */
  const decisao = async (cliente: string, numeroCnj: string, texto: string, criadoEm = ANTES) => {
    const [p] = await banco.insert(pessoa).values({ nome: cliente }).returning()
    const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', fase: 'judicial' }).returning()
    await banco.insert(publicacao).values({ fonte: 'aasp', casoId: c.id, numeroCnj, disponibilizadaEm: '2026-09-30', texto, classe: 'merito', hash: `h-${numeroCnj}`, criadoEm })
  }
  beforeEach(async () => {
    ;({ banco, fechar } = await abrirBancoEmbutido())
    pedidos = []
  })
  afterEach(() => fechar())

  it('CA2, CA5 · a IA lê as decisões do juízo sem o nome do cliente; só fica processo que estava no conteúdo', async () => {
    await decisao('Joana Ribeiro', '00011112220254036301', 'Joana Ribeiro: julgo procedente; o estudo social atualizado comprovou a renda da casa.')
    await decisao('Carlos Lima', '00022223320254036301', 'Carlos Lima: julgo improcedente; sem estudo social atualizado, não há prova da renda.')
    await decisao('Ana Souza', '00033334420254036100', 'Ana Souza: decisão de outro juízo.')
    expect((await juizosParaLer(banco)).sort()).toEqual(['TRF3 · 6100', 'TRF3 · 6301'])
    const ia = iaFalsa({
      entendimentos: [
        { texto: 'O juízo exige o estudo social atualizado para provar a renda.', processos: ['0001111-22.2025.4.03.6301', '00022223320254036301', '99999999999999999999'] },
        { texto: 'Entendimento sem processo do conteúdo.', processos: ['12345678901234567890'] },
      ],
    })
    const r = await entendimentosDoJuizo(banco, ia, 'TRF3 · 6301', AGORA)
    expect(r).toEqual([{ texto: 'O juízo exige o estudo social atualizado para provar a renda.', processos: ['00011112220254036301', '00022223320254036301'] }])
    for (const fora of ['Joana', 'Carlos', 'Ana Souza']) expect(pedidos[0]).not.toContain(fora)
    expect(pedidos[0]).toContain('sem estudo social atualizado')
    expect((await jurimetriaDoJuizo(banco, 'TRF3 · 6301', AGORA)).entendimentos).toEqual(r)
    expect(await juizosParaLer(banco)).toEqual(['TRF3 · 6100'])
  })

  it('CA2 · decisão nova no juízo: a rodada lê de novo; juízo sem decisão não chama a IA', async () => {
    await decisao('Joana Ribeiro', '00011112220254036301', 'Julgo procedente.')
    const ia = iaFalsa({ entendimentos: [{ texto: 'Concede com o laudo do perito judicial.', processos: ['00011112220254036301'] }] })
    await entendimentosDoJuizo(banco, ia, 'TRF3 · 6301', AGORA)
    expect(await juizosParaLer(banco)).toEqual([])
    await decisao('Carlos Lima', '00022223320254036301', 'Julgo improcedente.', new Date('2026-10-09T04:00:00Z'))
    expect(await juizosParaLer(banco)).toEqual(['TRF3 · 6301'])
    expect(await entendimentosDoJuizo(banco, ia, 'TJSP · 0100', AGORA)).toBeNull()
    expect(pedidos).toHaveLength(1)
  })
})
