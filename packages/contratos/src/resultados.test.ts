import { describe, expect, it } from 'vitest'
import { Indicador, PainelDeResultados, PedidoDoPainel, RAIO_X } from './resultados.ts'

describe('painel de resultado para os sócios (GGVP-75)', () => {
  it('o período vem em dd/mm/aaaa, pela biblioteca campos, e sai em AAAA-MM-DD; tudo é opcional', () => {
    expect(PedidoDoPainel.parse({ de: '01/01/2026', ate: '07/10/2026', recorte: 'juizo' })).toEqual({ de: '2026-01-01', ate: '2026-10-07', recorte: 'juizo' })
    expect(PedidoDoPainel.parse({})).toEqual({})
  })

  it('data inválida e recorte fora da lista são recusados', () => {
    const erro = PedidoDoPainel.safeParse({ de: '31/02/2026' })
    expect(erro.success ? '' : erro.error.issues[0].message).toBe('Informe a data inicial (dd/mm/aaaa)')
    expect(PedidoDoPainel.safeParse({ recorte: 'cliente' }).success).toBe(false)
  })

  it('CA8 · sem amostra mínima: "amostra insuficiente" não existe mais (G22 de 07/10); CA5 · o Raio-X traz só agregados de 979 processos', () => {
    const indicador = { chave: 'x', rotulo: 'X', casos: 3, valor: 2 / 3, unidade: 'taxa', situacao: 'amostra_insuficiente' }
    expect(Indicador.safeParse(indicador).success).toBe(false)
    expect(Indicador.parse({ ...indicador, situacao: 'ok' }).valor).toBeCloseTo(0.667, 3)
    expect([RAIO_X.processos, RAIO_X.geradoEm, RAIO_X.indicadores.length]).toEqual([979, '2026-09-21', 6])
    expect([RAIO_X.cartorioCobra.processos, RAIO_X.cartorioCobra.itens.length, RAIO_X.ondeJulgam.length]).toEqual([588, 7, 6])
  })

  it('CA4 · o painel aceita os totais nulos (quem não pode ver valores)', () => {
    const indicador = { chave: 'x', rotulo: 'X', casos: 0, valor: null, unidade: 'taxa' as const, situacao: 'sem_dados' as const }
    const painel = {
      periodo: { de: '2026-01-01', ate: '2026-10-07' },
      indicadores: [indicador],
      recorte: null,
      extincoes: { casos: 0, decididos: 0, porCausa: [] },
      pareceres: { dispensados: 0, exitoComDispensa: indicador, exitoComSuficiente: indicador },
      motivos: { indeferimento: [], derrota: [] },
      totais: null,
      operacao: 'sem_dados' as const,
      baseDoAcervo: { situacao: 'sem_dados' as const },
    }
    expect(PainelDeResultados.parse(painel).totais).toBeNull()
    const base = { situacao: 'com_dados' as const, processos: 12, conferidos: 9, aguardandoConferencia: 3, dataDaBase: '2026-10-06' }
    expect(PainelDeResultados.parse({ ...painel, baseDoAcervo: base }).baseDoAcervo).toEqual(base)
  })
})
