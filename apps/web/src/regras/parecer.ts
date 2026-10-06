// O parecer de suficiência da documentação médica (GGVP-20): a IA cruza o roteiro do benefício (GGVP-93) com os documentos
// e sugere; a advogada confere item a item e registra (G17). Contradição bloqueia (G18). A orientação ao médico não sugere
// diagnóstico, CID, grau, conclusão nem frase pronta (G20). Regra numérica é código com teste, nunca resposta de modelo (G19).
import type { ItemDoRoteiro } from './roteiro.ts'

export type SituacaoDoItem = 'presente' | 'ausente' | 'contraditorio'

export const SITUACOES_DO_ITEM: Record<SituacaoDoItem, string> = { presente: 'presente', ausente: 'ausente', contraditorio: 'contraditório' }

/** De onde a IA tirou: o documento, a página e o trecho (CA1). Só o Jurídico vê. */
export type Evidencia = { documentoId: string; documento: string; pagina: number; trecho: string }

/** Um item do roteiro na matriz. No item de contradição, "ausente" quer dizer "não encontrada". */
export type ItemAnalisado = {
  id: string
  tipo: 'obrigatorio' | 'contradicao'
  texto: string
  pergunta?: string
  situacao: SituacaoDoItem
  evidencia?: Evidencia
}

export type SituacaoDoParecer = 'suficiente' | 'insuficiente' | 'contraditorio'

/** O que a IA sugere; "sem-roteiro": o benefício não tem roteiro e a conferência é manual (GGVP-93, CA3). */
export type Sugestao = SituacaoDoParecer | 'sem-roteiro'

export const NOMES_DO_PARECER: Record<Sugestao | 'pendente', string> = {
  suficiente: 'Suficiente',
  insuficiente: 'Insuficiente',
  contraditorio: 'Contraditório',
  'sem-roteiro': 'Sem roteiro',
  pendente: 'Pendente',
}

/** O que a IA leu num documento médico: os itens que ele cobre e as contradições, com a página e o trecho. */
export type LeituraMedica = {
  documentoId: string
  /** Como a tela cita: "Laudo médico · 20/08/2026". */
  documento: string
  /** aaaa-mm-dd */
  data: string
  cobre: Record<string, { pagina: number; trecho: string }>
  contradiz: Record<string, { pagina: number; trecho: string }>
}

/**
 * A matriz (CA1) e a sugestão (CA2): cada item obrigatório presente (com a evidência do documento mais novo que o cobre)
 * ou ausente; cada contradição encontrada ou não. Complementar fica fora da matriz.
 */
export function analisar(itens: ItemDoRoteiro[], leituras: LeituraMedica[]): { itens: ItemAnalisado[]; sugestao: SituacaoDoParecer } {
  const maisNovas = [...leituras].sort((a, b) => b.data.localeCompare(a.data))
  const evidencia = (achou: (l: LeituraMedica) => { pagina: number; trecho: string } | undefined): Evidencia | undefined => {
    for (const l of maisNovas) {
      const e = achou(l)
      if (e) return { documentoId: l.documentoId, documento: l.documento, ...e }
    }
    return undefined
  }
  const analisados = itens.flatMap((i): ItemAnalisado[] => {
    if (i.tipo === 'complementar') return []
    const e = i.tipo === 'obrigatorio' ? evidencia((l) => l.cobre[i.id]) : evidencia((l) => l.contradiz[i.id])
    const situacao: SituacaoDoItem = !e ? 'ausente' : i.tipo === 'obrigatorio' ? 'presente' : 'contraditorio'
    return [{ id: i.id, tipo: i.tipo, texto: i.texto, ...(i.pergunta && { pergunta: i.pergunta }), situacao, ...(e && { evidencia: e }) }]
  })
  return { itens: analisados, sugestao: sugestaoDos(analisados) }
}

/** Contradição manda (G18); todo obrigatório presente, Suficiente; senão, Insuficiente. */
export function sugestaoDos(itens: Pick<ItemAnalisado, 'tipo' | 'situacao'>[]): SituacaoDoParecer {
  if (itens.some((i) => i.situacao === 'contraditorio')) return 'contraditorio'
  return itens.filter((i) => i.tipo === 'obrigatorio').every((i) => i.situacao === 'presente') ? 'suficiente' : 'insuficiente'
}

/** O que mudou de uma análise para a outra (CA4): os documentos novos e cada item que mudou. */
export function mudancas(antes: ItemAnalisado[] | undefined, depois: ItemAnalisado[], documentosNovos: string[]): string[] {
  const linhas = documentosNovos.map((d) => `Documento novo: ${d}`)
  if (!antes) return linhas
  const era = new Map(antes.map((i) => [i.id, i.situacao]))
  for (const i of depois) {
    const anterior = era.get(i.id)
    if (anterior === undefined || anterior === i.situacao) continue
    if (i.tipo === 'obrigatorio') linhas.push(`${i.situacao === 'presente' ? 'Passa a cobrir' : 'Deixa de cobrir'}: ${i.texto}`)
    else linhas.push(`${i.situacao === 'contraditorio' ? 'Nova contradição' : 'Contradição resolvida'}: ${i.texto}`)
  }
  return linhas
}

/** Meses inteiros entre duas datas aaaa-mm ou aaaa-mm-dd (G19). */
export function mesesEntre(inicio: string, fim: string): number {
  const [ai, mi, di = 1] = inicio.split('-').map(Number)
  const [af, mf, df = 1] = fim.split('-').map(Number)
  return (af - ai) * 12 + (mf - mi) - (df < di ? 1 : 0)
}

/** O impedimento de longo prazo do LOAS dura no mínimo 24 meses (roteiro de laudos, G19). */
export const MESES_MINIMOS_LOAS = 24

/** Contradição do LOAS (CA2): do início até a cessação prevista, menos de 24 meses. Sem cessação prevista, não há. */
export const abaixoDe24Meses = (inicio: string, cessacaoPrevista: string | undefined) =>
  cessacaoPrevista !== undefined && mesesEntre(inicio, cessacaoPrevista) < MESES_MINIMOS_LOAS

const REGRAS_G20: [RegExp, string][] = [
  [/\b[A-Z]\d{2}(\.\d{1,2})?\b/, 'Tire o código de doença (CID): a orientação não sugere diagnóstico (G20).'],
  [/\bcid\b/i, 'Não peça nem sugira CID: a orientação diz só o que o documento deve abordar (G20).'],
  [/diagn[oó]stic/i, 'Não sugira diagnóstico: a orientação diz só o que o documento deve abordar (G20).'],
  [/\bgrau\s+(leve|moderad|grave)/i, 'Não sugira o grau: quem avalia é o médico (G20).'],
  [/\bincapacidade\s+(total|permanente|parcial|definitiva)/i, 'Não sugira a conclusão: quem conclui é o médico (G20).'],
  [/\bconclu(a|ir|são|sao)\b/i, 'Não sugira a conclusão: quem conclui é o médico (G20).'],
  [/["“”]/, 'Sem frase pronta entre aspas para o médico copiar (G20).'],
  [/\b(escrev|declar|atest|coloqu|const)\w*\s+que\b/i, 'Sem frase pronta: a orientação pergunta, não dita o que escrever (G20).'],
]

/** Por que o texto ao médico ou ao cliente fere o G20; sem problema, null (CA8). */
export function problemaG20(texto: string): string | null {
  return REGRAS_G20.find(([regra]) => regra.test(texto))?.[1] ?? null
}

/**
 * O que o documento deve abordar, sugerido pela IA (resposta do Lucas, 01/10, na GGVP-29): as perguntas do roteiro para os
 * itens ausentes e, se há contradição, os documentos complementares. A advogada confirma ou ajusta.
 */
export function abordarSugerido(itens: ItemAnalisado[], complementares: string[]): string {
  const perguntas = itens.filter((i) => i.tipo === 'obrigatorio' && i.situacao !== 'presente').map((i) => `• ${i.pergunta ?? i.texto}`)
  const contradicao = itens.some((i) => i.situacao === 'contraditorio')
  const partes = [
    perguntas.length > 0 ? `O relatório médico precisa responder:\n${perguntas.join('\n')}` : '',
    contradicao && complementares.length > 0 ? `Documentos que ajudam: ${complementares.join('; ')}.` : '',
  ].filter(Boolean)
  return partes.join('\n\n')
}

/** A conferência da advogada: a situação de cada item, confirmada ou corrigida (CA3). */
export type Conferidos = Record<string, SituacaoDoItem | undefined>

/** O parecer que fica: com contradição conferida, Contraditório, qualquer que seja a decisão (CA2, G18). */
export function situacaoFinal(itens: ItemAnalisado[], conferidos: Conferidos, decisao: 'suficiente' | 'insuficiente'): SituacaoDoParecer {
  return itens.some((i) => conferidos[i.id] === 'contraditorio') ? 'contraditorio' : decisao
}

export const ABORDAR_MINIMO = 10
export const TEXTO_MAXIMO_DO_PARECER = 1000

/** Por que "Registrar parecer" não habilita; pronto, null (CA3, CA8; GGVP-93 CA3). */
export function motivoParaNaoRegistrar(d: {
  itens: ItemAnalisado[]
  conferidos: Conferidos
  decisao?: 'suficiente' | 'insuficiente'
  abordar: string
  semRoteiro: boolean
  conferenciaManual: string
}): string | null {
  if (d.semRoteiro && d.conferenciaManual.trim().length < ABORDAR_MINIMO) {
    return 'O benefício não tem roteiro: escreva o que você conferiu nos documentos (conferência manual).'
  }
  if (d.itens.some((i) => !d.conferidos[i.id])) return 'Confira cada item: confirme o que a IA achou ou corrija.'
  if (!d.decisao) return 'Responda: a documentação médica é suficiente para o benefício?'
  if ([d.abordar, d.conferenciaManual].some((t) => t.length > TEXTO_MAXIMO_DO_PARECER)) return `Cada texto vai até ${TEXTO_MAXIMO_DO_PARECER} letras.`
  const final = situacaoFinal(d.itens, d.conferidos, d.decisao)
  if (d.decisao === 'suficiente') {
    if (final === 'contraditorio') return 'Há contradição conferida: o parecer fica Contraditório e o caso não avança (G18).'
    if (d.itens.some((i) => i.tipo === 'obrigatorio' && d.conferidos[i.id] !== 'presente')) return 'Para "Suficiente", todo item obrigatório tem de estar presente.'
    return null
  }
  if (d.abordar.trim().length < ABORDAR_MINIMO) return 'Escreva o que o documento deve abordar (G20).'
  return problemaG20(d.abordar)
}
