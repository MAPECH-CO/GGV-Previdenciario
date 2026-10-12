import { describe, expect, it } from 'vitest'
import { WidgetDoChat, type ProcessoDoCaso, type TarefaDaCentral } from '@ggv/contratos'
import { montarBlocos, widgetDoAcervo, widgetsDasTarefas, widgetsDoCaso } from './widgetsDoChat.ts'

const HOJE = '2026-10-12'
let n = 0
const tarefa = (o: Partial<TarefaDaCentral>): TarefaDaCentral => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  casoId: null,
  passo: null,
  cliente: null,
  contexto: null,
  titulo: 'Tarefa',
  detalhe: '',
  tela: null,
  prazo: null,
  urgente: false,
  ...o,
})
const cliente = (nome: string) => ({ id: '00000000-0000-4000-8000-000000000999', nome })

describe('os widgets das tarefas', () => {
  const lista = [
    tarefa({ cliente: cliente('Ana'), titulo: 'Cobrar documento', prazo: '2026-10-11', urgente: true, tela: '/casos/a' }),
    tarefa({ cliente: cliente('Beto'), titulo: 'Conferir', prazo: HOJE }),
    tarefa({ contexto: 'Vigília das publicações', titulo: 'Reprocessar', urgente: true }),
    tarefa({ cliente: cliente('Caio'), titulo: 'Orientar', prazo: '2026-10-15' }),
    tarefa({ cliente: cliente('Duda'), titulo: 'Ligar', prazo: '2026-10-30' }),
  ]

  it('números, lista com as urgentes primeiro, prazos dos 7 dias e barras com 4 ou mais clientes', () => {
    const [numeros, itens, prazos, barras] = widgetsDasTarefas(lista, HOJE).map((o) => o.widget)
    expect(numeros).toEqual({
      tipo: 'numeros',
      itens: [
        { rotulo: 'Abertas', valor: 5 },
        { rotulo: 'Urgentes', valor: 2, tom: 'erro' },
        { rotulo: 'Vencem hoje', valor: 1, tom: 'alerta' },
        { rotulo: 'Atrasadas', valor: 1, tom: 'erro' },
      ],
    })
    expect(itens.tipo === 'lista' && itens.itens.map((i) => [i.titulo, i.selo?.texto, i.href])).toEqual([
      ['Ana · Cobrar documento', 'atrasada', '/casos/a'],
      ['Vigília das publicações · Reprocessar', undefined, undefined],
      ['Beto · Conferir', 'hoje', undefined],
      ['Caio · Orientar', 'até 15/10', undefined],
      ['Duda · Ligar', 'até 30/10', undefined],
    ])
    expect(prazos).toMatchObject({ tipo: 'prazos', inicio: HOJE, itens: [{ data: HOJE, oQue: 'Beto · Conferir' }, { data: '2026-10-15', oQue: 'Caio · Orientar' }] })
    expect(barras).toMatchObject({ tipo: 'barras', titulo: 'Tarefas por cliente' })
    for (const o of widgetsDasTarefas(lista, HOJE)) expect(WidgetDoChat.safeParse(o.widget).success, o.descricao).toBe(true)
  })

  it('sem tarefa, nenhum widget; com até 3 clientes, sem barras', () => {
    expect(widgetsDasTarefas([], HOJE)).toEqual([])
    expect(widgetsDasTarefas(lista.slice(0, 3), HOJE).map((o) => o.widget.tipo)).toEqual(['numeros', 'lista', 'prazos'])
  })
})

describe('os widgets do caso', () => {
  const processo = {
    casoId: '00000000-0000-4000-8000-000000000001',
    etapaAtual: 'vigilia',
    linha: Array.from({ length: 8 }, (_, i) => ({ quando: `2026-10-0${i + 1}T10:00:00Z`, quem: 'Ana', origem: 'pessoa', passo: null, descricao: `evento ${i + 1}` })),
    prazos: [
      { fim: '2026-10-13', regra: 'Manifestar (G12)' },
      { fim: '2026-10-01', regra: 'Vencido' },
    ],
    exigencias: [{ origem: 'juizo', descricao: 'Comprovar o vínculo', prazo: '2026-10-20', situacao: 'aberta', recebidaEm: '2026-10-01', itens: [] }],
  } as unknown as ProcessoDoCaso

  it('etapas pela atual, os 6 eventos mais recentes e os prazos a partir de hoje', () => {
    const [etapas, linha, prazos] = widgetsDoCaso(processo, HOJE).map((o) => o.widget)
    expect(etapas.tipo === 'etapas' && etapas.itens.map((e) => e.estado)).toEqual(['feita', 'feita', 'feita', 'atual', 'futura'])
    expect(linha.tipo === 'linha-do-tempo' && linha.itens.map((e) => e.texto)).toEqual(['evento 8', 'evento 7', 'evento 6', 'evento 5', 'evento 4', 'evento 3'])
    expect(prazos.tipo === 'prazos' && prazos.itens.map((p) => [p.data, p.urgente])).toEqual([
      ['2026-10-13', true],
      ['2026-10-20', false],
    ])
    for (const o of widgetsDoCaso(processo, HOJE)) expect(WidgetDoChat.safeParse(o.widget).success, o.descricao).toBe(true)
  })
})

describe('o widget do acervo', () => {
  it('título antes dos dois-pontos, o resto curto embaixo; sem trecho, nada', () => {
    const [o] = widgetDoAcervo([
      { tipo: 'acervo', referencia: 'caso:1', trecho: `Petição aprovada (BPC): ${'a'.repeat(300)}` },
      { tipo: 'acervo', referencia: 'caso:2' },
    ])
    expect(o.widget).toMatchObject({ tipo: 'lista', titulo: 'Casos parecidos no acervo', itens: [{ titulo: 'Petição aprovada (BPC)' }] })
    expect(o.widget.tipo === 'lista' && o.widget.itens[0].sub!.length).toBeLessThanOrEqual(161)
    expect(widgetDoAcervo([])).toEqual([])
  })
})

describe('montarBlocos', () => {
  const w = (t: string): WidgetDoChat => ({ tipo: 'barras', titulo: t, itens: [{ rotulo: 'a', valor: 1 }] })
  const widgets = new Map(['w1', 'w2', 'w3', 'w4', 'w5'].map((id) => [id, w(id)]))

  it('troca o marcador pelo widget, mesmo no meio da frase, e tira os marcadores do texto', () => {
    expect(montarBlocos('Hoje:\n{{w1}}\nveja {{w2}} abaixo.', widgets)).toEqual({
      texto: 'Hoje:\n\nveja  abaixo.',
      blocos: [
        { tipo: 'texto', texto: 'Hoje:' },
        { tipo: 'widget', widget: w('w1') },
        { tipo: 'texto', texto: 'veja' },
        { tipo: 'widget', widget: w('w2') },
        { tipo: 'texto', texto: 'abaixo.' },
      ],
    })
  })

  it('marcador inventado, repetido ou além do quarto some; sem marcador válido, sem blocos', () => {
    const r = montarBlocos('{{w9}}{{w1}}{{w1}}{{w2}}{{w3}}{{w4}}{{w5}}', widgets)
    expect(r.blocos?.map((b) => (b.tipo === 'widget' && b.widget.tipo === 'barras' ? b.widget.titulo : 'texto'))).toEqual(['w1', 'w2', 'w3', 'w4'])
    expect(montarBlocos('Sem widget {{w9}}.', widgets)).toEqual({ texto: 'Sem widget .' })
  })
})
