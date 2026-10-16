// Os widgets do chat (12/10): montados pelo código a partir do mesmo JSON que as ferramentas de leitura já leem das rotas
// da tela, com a sessão de quem pergunta. Número e data saem daqui; o modelo só escolhe, pelo marcador {{wN}}, quais
// mostrar e onde. `montarBlocos` troca os marcadores pelos widgets e descarta o que o modelo inventou.
import type { BlocoDaResposta, FonteDaIa, ProcessoDoCaso, TarefaDaCentral, WidgetDoChat } from '@ggv/contratos'
import { hojeEmBrasilia } from '../vigilia/fila.ts'

export type Oferta = { widget: WidgetDoChat; descricao: string }
export const MAX_WIDGETS = 4

/** A data do dia: a data pura como veio; o instante com hora (UTC) vira o dia em Brasília. */
export const dataDe = (s: string | null | undefined) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return null
  if (s.length <= 10) return s
  const instante = new Date(s)
  return Number.isNaN(instante.getTime()) ? s.slice(0, 10) : hojeEmBrasilia(instante)
}
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const maisDias = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

export function widgetsDasTarefas(tarefas: TarefaDaCentral[], hoje: string): Oferta[] {
  if (!tarefas.length) return []
  const nome = (t: TarefaDaCentral) => t.cliente?.nome ?? t.contexto ?? 'Sem cliente'
  const href = (t: TarefaDaCentral) => t.tela ?? (t.casoId ? `/casos/${t.casoId}` : undefined)
  const linhas = tarefas.map((t) => ({ t, prazo: dataDe(t.prazo) }))
  const urgentes = tarefas.filter((t) => t.urgente).length
  const vencemHoje = linhas.filter((x) => x.prazo === hoje).length
  const atrasadas = linhas.filter((x) => x.prazo && x.prazo < hoje).length
  const selo = (prazo: string | null) =>
    !prazo
      ? undefined
      : prazo < hoje
        ? { texto: 'atrasada', tom: 'erro' as const }
        : prazo === hoje
          ? { texto: 'hoje', tom: 'acento' as const }
          : { texto: `até ${ddmm(prazo)}`, tom: 'neutro' as const }
  const ordem = [...linhas].sort((a, b) => Number(b.t.urgente) - Number(a.t.urgente) || (a.prazo ?? '9999').localeCompare(b.prazo ?? '9999'))
  const ofertas: Oferta[] = [
    {
      descricao: 'números das suas tarefas (abertas, urgentes, vencem hoje)',
      widget: {
        tipo: 'numeros',
        itens: [
          { rotulo: 'Abertas', valor: tarefas.length },
          { rotulo: 'Urgentes', valor: urgentes, ...(urgentes ? { tom: 'erro' as const } : {}) },
          { rotulo: 'Vencem hoje', valor: vencemHoje, ...(vencemHoje ? { tom: 'alerta' as const } : {}) },
          ...(atrasadas ? [{ rotulo: 'Atrasadas', valor: atrasadas, tom: 'erro' as const }] : []),
        ],
      },
    },
    {
      descricao: 'lista das tarefas, as urgentes primeiro, com link',
      widget: {
        tipo: 'lista',
        titulo: urgentes ? 'Tarefas, as urgentes primeiro' : 'Suas tarefas',
        itens: ordem.slice(0, 8).map(({ t, prazo }) => {
          const s = selo(prazo)
          const h = href(t)
          return { titulo: `${nome(t)} · ${t.titulo}`, ...(t.detalhe ? { sub: t.detalhe } : {}), ...(h ? { href: h } : {}), ...(s ? { selo: s } : {}) }
        }),
      },
    },
  ]
  const fim = maisDias(hoje, 7)
  const naSemana = ordem.filter((x) => x.prazo && x.prazo >= hoje && x.prazo < fim)
  if (naSemana.length)
    ofertas.push({
      descricao: 'prazos dos próximos 7 dias',
      widget: {
        tipo: 'prazos',
        titulo: 'Prazos da semana',
        inicio: hoje,
        itens: naSemana.slice(0, 20).map(({ t, prazo }) => {
          const h = href(t)
          return { data: prazo!, oQue: `${nome(t)} · ${t.titulo}`, ...(h ? { href: h } : {}), urgente: t.urgente }
        }),
      },
    })
  const porCliente = new Map<string, number>()
  for (const t of tarefas) porCliente.set(nome(t), (porCliente.get(nome(t)) ?? 0) + 1)
  if (porCliente.size >= 4)
    ofertas.push({
      descricao: 'barras: tarefas por cliente',
      widget: {
        tipo: 'barras',
        titulo: 'Tarefas por cliente',
        itens: [...porCliente]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([rotulo, valor]) => ({ rotulo, valor })),
      },
    })
  return ofertas
}

const ETAPAS = [
  ['entrevista', 'Entrevista'],
  ['inss', 'INSS'],
  ['justica', 'Justiça'],
  ['vigilia', 'Vigília'],
  ['desfecho', 'Desfecho'],
] as const

export function widgetsDoCaso(p: ProcessoDoCaso, hoje: string): Oferta[] {
  const atual = ETAPAS.findIndex(([id]) => id === p.etapaAtual)
  const ofertas: Oferta[] = [
    {
      descricao: 'etapas do processo, com a atual',
      widget: {
        tipo: 'etapas',
        itens: ETAPAS.map(([, rotulo], i) => ({ rotulo, estado: i < atual ? ('feita' as const) : i === atual ? ('atual' as const) : ('futura' as const) })),
      },
    },
  ]
  const recentes = p.linha
    .flatMap((e) => {
      const data = dataDe(e.quando)
      return data ? [{ e, data }] : []
    })
    .slice(-6)
    .reverse()
  if (recentes.length)
    ofertas.push({
      descricao: 'linha do tempo: os 6 últimos acontecimentos do caso',
      widget: { tipo: 'linha-do-tempo', titulo: 'Últimos acontecimentos', itens: recentes.map(({ e, data }) => ({ quando: data, quem: e.quem, texto: e.descricao })) },
    })
  const prazos = [...p.prazos.map((x) => ({ data: dataDe(x.fim), oQue: x.regra })), ...p.exigencias.map((x) => ({ data: dataDe(x.prazo), oQue: `Exigência: ${x.descricao}` }))]
    .filter((x): x is { data: string; oQue: string } => Boolean(x.data && x.data >= hoje))
    .sort((a, b) => a.data.localeCompare(b.data))
  if (prazos.length)
    ofertas.push({
      descricao: 'prazos do caso, a partir de hoje',
      widget: {
        tipo: 'prazos',
        titulo: 'Prazos do caso',
        inicio: hoje,
        itens: prazos.slice(0, 20).map((x) => ({ ...x, href: `/casos/${p.casoId}`, urgente: x.data <= maisDias(hoje, 2) })),
      },
    })
  return ofertas
}

export function widgetDoAcervo(achados: FonteDaIa[]): Oferta[] {
  const itens = achados.flatMap((f) => {
    if (!f.trecho) return []
    const corte = f.trecho.indexOf(': ')
    const titulo = corte > 0 ? f.trecho.slice(0, corte) : f.trecho.slice(0, 60)
    const resto = corte > 0 ? f.trecho.slice(corte + 2) : f.trecho.slice(60)
    const sub = resto.length > 160 ? `${resto.slice(0, 160)}…` : resto
    return [{ titulo, ...(sub ? { sub } : {}) }]
  })
  return itens.length ? [{ descricao: 'lista dos casos parecidos no acervo', widget: { tipo: 'lista', titulo: 'Casos parecidos no acervo', itens: itens.slice(0, 8) } }] : []
}

const MARCADOR = /\{\{(w\d+)\}\}/g

/** Troca os marcadores pelos widgets: só os que existem, cada um uma vez, até quatro. O texto volta sem marcadores. */
export function montarBlocos(texto: string, widgets: Map<string, WidgetDoChat>): { texto: string; blocos?: BlocoDaResposta[] } {
  const blocos: BlocoDaResposta[] = []
  const usados = new Set<string>()
  let ultimo = 0
  const empurrarTexto = (s: string) => {
    const limpo = s.replace(MARCADOR, '').trim()
    if (limpo) blocos.push({ tipo: 'texto', texto: limpo })
  }
  for (const m of texto.matchAll(MARCADOR)) {
    const w = widgets.get(m[1])
    if (!w || usados.has(m[1]) || usados.size >= MAX_WIDGETS) continue
    empurrarTexto(texto.slice(ultimo, m.index))
    blocos.push({ tipo: 'widget', widget: w })
    usados.add(m[1])
    ultimo = m.index + m[0].length
  }
  const semMarcadores = texto.replace(MARCADOR, '')
  if (!usados.size) return { texto: semMarcadores }
  empurrarTexto(texto.slice(ultimo))
  return { texto: semMarcadores, blocos }
}
