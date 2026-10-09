import { describe, expect, it } from 'vitest'
import { fonteDjen, URL_DJEN } from './djen.ts'
import { textoDoHtml } from './fontes.ts'

// Respostas gravadas no formato do DJEN (consulta de 07/10), com texto, nomes e processos inventados: nada de dado real.
const comunicacao = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  data_disponibilizacao: '2026-10-06',
  numero_processo: '00012349620264036301',
  siglaTribunal: 'TRF3',
  texto: `<p>Intime-se a parte autora (exemplo ${id}).</p>`,
  ativo: true,
  data_cancelamento: null,
  destinatarios: [{ nome: 'Fulano de Tal (exemplo)' }, { nome: 'INSTITUTO NACIONAL DO SEGURO SOCIAL' }],
  ...extra,
})
const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })

/** `fetch` trocado: devolve as respostas na ordem e guarda os pedidos e as esperas. */
function redeGravada(respostas: Response[]) {
  const pedidos: URL[] = []
  const esperas: number[] = []
  const buscar = (async (entrada: string | URL | Request) => {
    pedidos.push(new URL(String(entrada)))
    return respostas.shift() ?? json({ count: 0, items: [] })
  }) as typeof fetch
  return { pedidos, esperas, rede: { buscar, esperar: async (ms: number) => void esperas.push(ms) } }
}

const OAB = { numero: '123456', uf: 'SP' }
// Rodada das 08:00 de 07/10, em Brasília: a janela começa às 08:00 de 06/10.
const DE = new Date('2026-10-06T11:00:00Z')
const ATE = new Date('2026-10-07T11:00:00Z')

describe('fonte DJEN (grupo 4, decisões 44 e 47)', () => {
  it('consulta cada tribunal da vigília pela OAB, com os dias da janela e 50 por página', async () => {
    const { pedidos, rede } = redeGravada([json({ count: 1, items: [comunicacao(1)] }), json({ count: 0, items: [] })])
    const lista = await fonteDjen([OAB], ['TRF3', 'TJSP'], rede).buscar(DE, ATE)
    expect(pedidos.map((u) => `${u.origin}${u.pathname}`)).toEqual([URL_DJEN, URL_DJEN])
    expect(pedidos.map((u) => Object.fromEntries(u.searchParams))).toEqual(
      ['TRF3', 'TJSP'].map((siglaTribunal) => ({
        numeroOab: '123456',
        ufOab: 'SP',
        siglaTribunal,
        dataDisponibilizacaoInicio: '2026-10-06',
        dataDisponibilizacaoFim: '2026-10-07',
        pagina: '1',
        itensPorPagina: '50',
      })),
    )
    expect(lista).toEqual([
      {
        fonte: 'djen',
        numeroCnj: '00012349620264036301',
        disponibilizadaEm: '2026-10-06',
        texto: 'Intime-se a parte autora (exemplo 1).',
        partes: 'Fulano de Tal (exemplo), INSTITUTO NACIONAL DO SEGURO SOCIAL',
      },
    ])
  })

  it('a OAB vai só com dígitos e a UF em maiúsculas (com o ponto, o DJEN não acha nada)', async () => {
    const { pedidos, rede } = redeGravada([])
    await fonteDjen([{ numero: '123.456', uf: 'sp' }], ['TRF3'], rede).buscar(DE, ATE)
    expect(pedidos[0].searchParams.get('numeroOab')).toBe('123456')
    expect(pedidos[0].searchParams.get('ufOab')).toBe('SP')
  })

  it('os dias saem no horário de Brasília, mesmo quando em UTC já é o dia seguinte', async () => {
    const { pedidos, rede } = redeGravada([])
    // 22:30 de 06/10 a 22:30 de 07/10, em Brasília (em UTC, 07/10 e 08/10).
    await fonteDjen([OAB], ['TRF3'], rede).buscar(new Date('2026-10-07T01:30:00Z'), new Date('2026-10-08T01:30:00Z'))
    expect(pedidos[0].searchParams.get('dataDisponibilizacaoInicio')).toBe('2026-10-06')
    expect(pedidos[0].searchParams.get('dataDisponibilizacaoFim')).toBe('2026-10-07')
  })

  it('pagina até cobrir o count, com meio segundo entre as chamadas', async () => {
    const primeira = Array.from({ length: 50 }, (_, i) => comunicacao(i + 1))
    const segunda = Array.from({ length: 10 }, (_, i) => comunicacao(i + 51))
    const { pedidos, esperas, rede } = redeGravada([json({ count: 60, items: primeira }), json({ count: 60, items: segunda })])
    expect(await fonteDjen([OAB], ['TRF3'], rede).buscar(DE, ATE)).toHaveLength(60)
    expect(pedidos.map((u) => u.searchParams.get('pagina'))).toEqual(['1', '2'])
    expect(esperas).toEqual([500])
  })

  it('a cancelada fica de fora, e a mesma comunicação achada por duas OABs conta uma vez', async () => {
    const { rede } = redeGravada([
      json({ count: 3, items: [comunicacao(1), comunicacao(2, { ativo: false }), comunicacao(3, { data_cancelamento: '2026-10-06' })] }),
      json({ count: 1, items: [comunicacao(1)] }),
    ])
    const lista = await fonteDjen([OAB, { numero: '654321', uf: 'SP' }], ['TRF3'], rede).buscar(DE, ATE)
    expect(lista.map((p) => p.texto)).toEqual(['Intime-se a parte autora (exemplo 1).'])
  })

  it('erro do servidor do DJEN tenta de novo uma vez, depois de 2 s', async () => {
    const { pedidos, esperas, rede } = redeGravada([json({}, 500), json({ count: 1, items: [comunicacao(1)] })])
    expect(await fonteDjen([OAB], ['TRF3'], rede).buscar(DE, ATE)).toHaveLength(1)
    expect(pedidos).toHaveLength(2)
    expect(esperas).toEqual([2000])
  })

  it('sem resposta (rede fora ou tempo esgotado), também tenta de novo uma vez, depois de 2 s', async () => {
    let chamadas = 0
    const esperas: number[] = []
    const instavel = {
      buscar: (async () => {
        chamadas++
        if (chamadas === 1) throw new TypeError('fetch failed')
        return json({ count: 1, items: [comunicacao(1)] })
      }) as typeof fetch,
      esperar: async (ms: number) => void esperas.push(ms),
    }
    expect(await fonteDjen([OAB], ['TRF3'], instavel).buscar(DE, ATE)).toHaveLength(1)
    expect([chamadas, esperas]).toEqual([2, [2000]])
  })

  it('o erro que fica vira falha da API, que também avisa o suporte (GGVP-30 CA8)', async () => {
    const duasVezes = redeGravada([json({}, 500), json({}, 500)])
    await expect(fonteDjen([OAB], ['TRF3'], duasVezes.rede).buscar(DE, ATE)).rejects.toThrow('api: o DJEN respondeu 500')
    const recusa = redeGravada([json({}, 403)])
    await expect(fonteDjen([OAB], ['TRF3'], recusa.rede).buscar(DE, ATE)).rejects.toThrow('api: o DJEN respondeu 403')
    expect(recusa.pedidos).toHaveLength(1)
    let chamadas = 0
    const semRede = {
      buscar: (async () => {
        chamadas++
        throw new TypeError('fetch failed')
      }) as typeof fetch,
      esperar: async () => {},
    }
    await expect(fonteDjen([OAB], ['TRF3'], semRede).buscar(DE, ATE)).rejects.toThrow('api: o DJEN não respondeu')
    expect(chamadas).toBe(2)
  })
})

describe('texto do HTML (grupo 4, decisão 46)', () => {
  it('tira as tags, guarda as quebras de parágrafo e decodifica as entidades', () => {
    expect(textoDoHtml('<p>Intime-se&nbsp;a parte<br>autora &amp; o INSS.</p><p>Prazo: 15 dias &#8211; art. 219.</p><script>x</script>')).toBe(
      'Intime-se a parte\nautora & o INSS.\nPrazo: 15 dias – art. 219.',
    )
  })

  it('não decodifica duas vezes e deixa como está o que não conhece', () => {
    expect(textoDoHtml('&amp;lt;não é tag&amp;gt; &#xE9; &bogus; &#99999999;')).toBe('&lt;não é tag&gt; é &bogus; &#99999999;')
    expect(textoDoHtml('texto sem HTML')).toBe('texto sem HTML')
  })
})
