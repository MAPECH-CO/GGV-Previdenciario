import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ROTULO_BENEFICIO } from '@ggv/contratos'
import { abrirBancoEmbutido, type Banco } from '../banco/conexao.ts'
import { caso, eventoAuditoria, exigencia, exigenciaItem, identificadorCaso, parecerMedico, pericia, perito, pessoa, prestacaoContas, processoAcervo, resultadoInss, usuario } from '../banco/esquema.ts'
import { painelDeResultados } from './resultados.ts'

let banco: Banco
let fechar: () => Promise<void>
beforeEach(async () => {
  ;({ banco, fechar } = await abrirBancoEmbutido())
})
afterEach(() => fechar())

const PERIODO = { de: '2026-01-01', ate: '2026-10-07', recorte: null, verTotais: false }
const as = (dia: string) => new Date(`${dia}T15:00:00Z`)
let sequencia = 0
async function novoCaso(extra: Partial<typeof caso.$inferInsert> = {}) {
  const [p] = await banco.insert(pessoa).values({ nome: `Pessoa ${++sequencia} (exemplo)` }).returning()
  const [c] = await banco.insert(caso).values({ pessoaId: p.id, beneficio: 'bpc_loas_deficiente', ...extra }).returning()
  return c.id
}
const decisaoInss = (casoId: string, resultado: 'deferido' | 'indeferido', dataDecisao = '2026-05-10') =>
  banco.insert(resultadoInss).values({ casoId, resultado, dataDecisao })
const indicador = (painel: Awaited<ReturnType<typeof painelDeResultados>>, chave: string) => painel.indicadores.find((i) => i.chave === chave)

describe('GGVP-75 · painel de resultado para os sócios', () => {
  it('CA5 · sem nenhum caso decidido, a operação aparece "sem dados ainda", e a base do acervo também', async () => {
    const painel = await painelDeResultados(banco, PERIODO)
    expect(painel.operacao).toBe('sem_dados')
    expect(painel.indicadores.filter((i) => i.unidade === 'taxa').map((i) => i.situacao)).toEqual(['sem_dados', 'sem_dados', 'sem_dados'])
    expect([painel.extincoes.casos, painel.extincoes.decididos, painel.baseDoAcervo.situacao, painel.totais]).toEqual([0, 0, 'sem_dados', null])
  })

  it('CA1, CA8 · cada indicador traz o número de casos; sem amostra mínima, a taxa sai mesmo com poucos casos (G22 de 07/10)', async () => {
    for (const r of ['deferido', 'deferido', 'deferido', 'deferido', 'deferido', 'deferido', 'indeferido', 'indeferido'] as const) await decisaoInss(await novoCaso(), r)
    for (const desfecho of ['procedente_total', 'procedente_parcial', 'improcedente'] as const) await novoCaso({ desfecho, encerradoEm: as('2026-08-01') })
    const painel = await painelDeResultados(banco, PERIODO)
    expect(indicador(painel, 'deferimento_inss')).toMatchObject({ casos: 8, valor: 0.75, situacao: 'ok' })
    expect(indicador(painel, 'procedencia')).toMatchObject({ casos: 3, valor: 2 / 3, situacao: 'ok' })
    expect(painel.operacao).toBe('com_dados')
  })

  it('CA7 · decisão fora do período e desfecho sem data de encerramento ficam fora; vale a última decisão do caso', async () => {
    await decisaoInss(await novoCaso(), 'deferido', '2025-12-20')
    await novoCaso({ desfecho: 'improcedente' })
    const mudou = await novoCaso()
    await decisaoInss(mudou, 'indeferido', '2026-03-01')
    await decisaoInss(mudou, 'deferido', '2026-06-01')
    const painel = await painelDeResultados(banco, PERIODO)
    expect(indicador(painel, 'deferimento_inss')?.casos).toBe(1)
    expect(indicador(painel, 'procedencia')?.casos).toBe(0)
  })

  it('CA2 · as extinções sem mérito aparecem em destaque, com a causa registrada', async () => {
    await novoCaso({ desfecho: 'extinto_sem_merito', causaDesfecho: 'não cumpriu determinação', encerradoEm: as('2026-07-01') })
    await novoCaso({ desfecho: 'extinto_sem_merito', causaDesfecho: 'não cumpriu determinação', encerradoEm: as('2026-07-02') })
    await novoCaso({ desfecho: 'extinto_sem_merito', encerradoEm: as('2026-07-03') })
    await decisaoInss(await novoCaso(), 'deferido')
    const painel = await painelDeResultados(banco, PERIODO)
    expect(painel.extincoes).toEqual({
      casos: 3,
      decididos: 4,
      porCausa: [
        { causa: 'não cumpriu determinação', casos: 2 },
        { causa: 'sem causa registrada', casos: 1 },
      ],
    })
    expect(indicador(painel, 'extincoes')).toMatchObject({ casos: 3, valor: 3, unidade: 'casos' })
  })

  it('exigência cumprida no prazo, pelo último item cumprido; vencida ou cumprida depois do prazo fica fora do prazo; sem prazo, fica fora da conta', async () => {
    const exigenciaCom = async (situacao: 'cumprida' | 'vencida', cumpridoEm: string | null, prazo: string | null = '2026-04-20') => {
      const [e] = await banco
        .insert(exigencia)
        .values({ casoId: await novoCaso(), origem: 'inss', descricao: 'Exigência (exemplo)', recebidaEm: '2026-04-01', prazo, situacao })
        .returning()
      await banco.insert(exigenciaItem).values({ exigenciaId: e.id, descricao: 'Item (exemplo)', perfilResponsavel: 'documentacao', cumpridoEm: cumpridoEm ? as(cumpridoEm) : null })
    }
    for (let i = 0; i < 5; i++) await exigenciaCom('cumprida', '2026-04-15')
    await exigenciaCom('cumprida', '2026-04-25')
    await exigenciaCom('vencida', null)
    await exigenciaCom('vencida', null)
    // CA7: cumprida, mas sem prazo, é dado incerto: não entra no numerador nem no denominador.
    await exigenciaCom('cumprida', '2026-04-15', null)
    const painel = await painelDeResultados(banco, PERIODO)
    expect(indicador(painel, 'exigencias_no_prazo')).toMatchObject({ casos: 8, valor: 5 / 8, situacao: 'ok' })
  })

  it('CA3 · quantos pareceres a Sênior dispensou, e o êxito desses casos contra os com parecer suficiente', async () => {
    const comParecer = async (resultado: 'dispensado' | 'suficiente', decisao: 'deferido' | 'indeferido') => {
      const id = await novoCaso()
      await banco
        .insert(parecerMedico)
        .values({ casoId: id, roteiroVersao: 1, resultado, justificativaDispensa: resultado === 'dispensado' ? 'Exemplo' : null, criadoEm: as('2026-05-01') })
      await decisaoInss(id, decisao)
    }
    await comParecer('dispensado', 'indeferido')
    await comParecer('dispensado', 'deferido')
    for (let i = 0; i < 8; i++) await comParecer('suficiente', i < 6 ? 'deferido' : 'indeferido')
    const painel = await painelDeResultados(banco, PERIODO)
    expect(painel.pareceres.dispensados).toBe(2)
    expect(painel.pareceres.exitoComDispensa).toMatchObject({ casos: 2, valor: 0.5, situacao: 'ok' })
    expect(painel.pareceres.exitoComSuficiente).toMatchObject({ casos: 8, valor: 0.75, situacao: 'ok' })
    expect(indicador(painel, 'pareceres_dispensados')).toMatchObject({ casos: 2, unidade: 'casos' })
  })

  it('CA1 · os pareceres dispensados também saem por grupo do recorte, mesmo no caso ainda sem decisão', async () => {
    const dispensar = (casoId: string) =>
      banco.insert(parecerMedico).values({ casoId, roteiroVersao: 1, resultado: 'dispensado', justificativaDispensa: 'Exemplo', criadoEm: as('2026-05-01') })
    const decidido = await novoCaso({ beneficio: 'aposentadoria_pcd' })
    await dispensar(decidido)
    await decisaoInss(decidido, 'deferido')
    await dispensar(await novoCaso({ beneficio: 'bpc_loas_idoso' }))
    const painel = await painelDeResultados(banco, { ...PERIODO, recorte: 'beneficio' })
    expect(painel.recorte?.grupos.map((g) => [g.nome, g.indicadores.find((i) => i.chave === 'pareceres_dispensados')?.casos])).toEqual([
      [ROTULO_BENEFICIO.aposentadoria_pcd, 1],
      [ROTULO_BENEFICIO.bpc_loas_idoso, 1],
    ])
    expect(indicador(painel, 'pareceres_dispensados')?.casos).toBe(2)
  })

  it('CA4 · os totais em dinheiro só saem para quem pode ver, somados em centavos, pela confirmação do recebimento', async () => {
    for (const [honorarios, cliente, confirmado] of [
      ['1500.50', '8499.50', true],
      ['499.50', '4500.50', true],
      // Lançada e ainda sem a ida ao banco: não é dinheiro na mão (GGVP-98 CA9).
      ['900.00', '2100.00', false],
    ] as const) {
      const id = await novoCaso({ criadoEm: as('2026-01-10') })
      await banco
        .insert(prestacaoContas)
        .values({ casoId: id, valorRecebido: (Number(honorarios) + Number(cliente)).toFixed(2), honorarios, valorCliente: cliente, recebidaEm: as('2026-03-01') })
      if (confirmado) await banco.insert(eventoAuditoria).values({ quem: 'financeiro', acao: 'recebimento_confirmado', alvo: `caso:${id}`, quando: as('2026-03-11') })
    }
    expect((await painelDeResultados(banco, PERIODO)).totais).toBeNull()
    const totais = (await painelDeResultados(banco, { ...PERIODO, verTotais: true })).totais
    expect(totais).toMatchObject({ honorariosRecebidos: '2000.00', recebimentos: 2 })
    expect(totais?.diasAteReceber).toMatchObject({ casos: 2, unidade: 'dias', valor: 60, situacao: 'ok' })
  })

  it('CA1 · o recorte por juízo (pelo número CNJ) e por advogada; caso sem o dado fica fora dos grupos', async () => {
    const [ana] = await banco.insert(usuario).values({ email: 'ana@exemplo.ggv', nome: 'Ana (exemplo)', senhaHash: 'x' }).returning()
    const doTrf3 = await novoCaso({ advogadaResponsavelId: ana.id })
    await banco.insert(identificadorCaso).values({ casoId: doTrf3, tipo: 'cnj', valor: '00012349620264036301' })
    await decisaoInss(doTrf3, 'deferido')
    const doTjsp = await novoCaso()
    await banco.insert(identificadorCaso).values({ casoId: doTjsp, tipo: 'cnj', valor: '10001234520268260100' })
    await decisaoInss(doTjsp, 'indeferido')
    await decisaoInss(await novoCaso(), 'deferido')
    const porJuizo = (await painelDeResultados(banco, { ...PERIODO, recorte: 'juizo' })).recorte
    expect(porJuizo?.grupos.map((g) => [g.nome, g.indicadores[0].casos])).toEqual([
      ['TJSP · 0100', 1],
      ['TRF3 · 6301', 1],
    ])
    const porAdvogada = (await painelDeResultados(banco, { ...PERIODO, recorte: 'advogada' })).recorte
    expect(porAdvogada?.grupos.map((g) => g.nome)).toEqual(['Ana (exemplo)'])
  })

  it('CA1 · o recorte por perito e por benefício usa o perito da perícia e o rótulo do catálogo', async () => {
    const [p] = await banco.insert(perito).values({ nome: 'Dr. Exemplo', nomeNormalizado: 'dr exemplo' }).returning()
    const id = await novoCaso({ beneficio: 'aposentadoria_pcd' })
    await banco.insert(pericia).values({ casoId: id, tipo: 'medica', peritoId: p.id })
    await decisaoInss(id, 'deferido')
    expect((await painelDeResultados(banco, { ...PERIODO, recorte: 'perito' })).recorte?.grupos.map((g) => g.nome)).toEqual(['Dr. Exemplo'])
    expect((await painelDeResultados(banco, { ...PERIODO, recorte: 'beneficio' })).recorte?.grupos).toHaveLength(1)
  })

  it('GGVP-41 CA3, CA5, CA7 · o recorte por tese usa só a ficha conferida pela Sênior; sem tese ou sem conferência, fora', async () => {
    const [helena] = await banco.insert(usuario).values({ email: 'helena@exemplo.ggv', nome: 'Helena (exemplo)', senhaHash: 'x' }).returning()
    const TESE = 'Renda per capita acima de 1/4 com gastos'
    const ganho = await novoCaso({ desfecho: 'procedente_total', encerradoEm: as('2026-08-01') })
    const perdido = await novoCaso({ desfecho: 'improcedente', encerradoEm: as('2026-08-02') })
    const semTese = await novoCaso({ desfecho: 'procedente_parcial', encerradoEm: as('2026-08-03') })
    const naoConferido = await novoCaso({ desfecho: 'procedente_total', encerradoEm: as('2026-08-04') })
    await banco.insert(processoAcervo).values([
      { casoId: ganho, desfecho: 'procedente_total', fonte: 'portal', tese: TESE, desfechoConferidoPor: helena.id },
      { casoId: perdido, desfecho: 'improcedente', fonte: 'portal', tese: TESE, desfechoConferidoPor: helena.id },
      { casoId: semTese, desfecho: 'procedente_parcial', fonte: 'portal', tese: null, desfechoConferidoPor: helena.id },
      { casoId: naoConferido, desfecho: 'procedente_total', fonte: 'portal', tese: 'Outra tese' },
    ])
    const porTese = (await painelDeResultados(banco, { ...PERIODO, recorte: 'tese' })).recorte
    expect(porTese?.grupos.map((g) => [g.nome, g.indicadores.find((i) => i.chave === 'procedencia')])).toEqual([
      [TESE, expect.objectContaining({ casos: 2, valor: 0.5, situacao: 'ok' })],
    ])
  })

  it('GGVP-55 CA3 · a base do acervo: processos, conferidos, os que aguardam conferência e a data da entrada mais recente', async () => {
    const [helena] = await banco.insert(usuario).values({ email: 'helena@exemplo.ggv', nome: 'Helena (exemplo)', senhaHash: 'x' }).returning()
    await banco.insert(processoAcervo).values([
      { numeroCnj: '00000011220204036301', desfecho: 'procedente_total', desfechoConferidoPor: helena.id, fonte: 'importacao', criadoEm: as('2026-09-21') },
      { numeroCnj: '00000021220204036301', desfecho: 'improcedente', fonte: 'lote', criadoEm: as('2026-10-02') },
      { numeroCnj: '00000031220204036301', fonte: 'lote', criadoEm: as('2026-10-02') },
    ])
    expect((await painelDeResultados(banco, PERIODO)).baseDoAcervo).toEqual({ situacao: 'com_dados', processos: 3, conferidos: 1, aguardandoConferencia: 1, dataDaBase: '2026-10-02' })
  })

  it('GGVP-55 CA3 · uma entrada nova soma à base: a anterior fica guardada, e a data da base passa a ser a da mais recente', async () => {
    await banco.insert(processoAcervo).values([
      { numeroCnj: '00000051220204036301', desfecho: 'improcedente', fonte: 'importacao', criadoEm: as('2026-09-21') },
      { numeroCnj: '00000061220204036301', desfecho: 'acordo', fonte: 'importacao', criadoEm: as('2026-09-21') },
    ])
    expect((await painelDeResultados(banco, PERIODO)).baseDoAcervo).toMatchObject({ processos: 2, dataDaBase: '2026-09-21' })
    await banco.insert(processoAcervo).values({ numeroCnj: '00000071220204036301', desfecho: 'procedente_total', fonte: 'lote', criadoEm: as('2026-10-02') })
    expect((await painelDeResultados(banco, PERIODO)).baseDoAcervo).toMatchObject({ processos: 3, aguardandoConferencia: 3, dataDaBase: '2026-10-02' })
  })
})
