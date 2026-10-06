// O checklist de documentos obrigatórios do benefício (GGVP-91). A lista de cada benefício vem da configuração do
// escritório (GGVP-104), nunca desta regra (CA10). Trava de liberação é código com teste, nunca resposta de modelo.
import { nomeTipo } from '../dados/catalogos.ts'
import type { Complementar, Exigencia } from './acidente.ts'

/** Condições do caso que puxam as declarações do LOAS (CA7). */
export type Condicao = 'moradia' | 'uniao-estavel' | 'separacao-de-fato'

export const CONDICOES: Record<Condicao, string> = {
  moradia: 'mora em casa de outra pessoa',
  'uniao-estavel': 'vive em união estável',
  'separacao-de-fato': 'é casado(a), mas separado(a) de fato',
}

/** A lista de um benefício na configuração do escritório: tipos da lista única de documentos (CA10). */
export type ListaDoBeneficio = { obrigatorios: string[]; condicionais: { tipo: string; quando: Condicao }[] }

/** Um documento classificado no caso, como a leitura deixou (GGVP-81). */
export type DocumentoDoCaso = { tipo: string; quarentena?: boolean; semAssinatura?: boolean; dataEmBranco?: boolean }

export type SituacaoDoItem = 'recebido' | 'pendente' | 'problema'

export type ItemDoChecklist = {
  tipo: string
  nome: string
  situacao: SituacaoDoItem
  /** Por que não está recebido: "falta", "sem assinatura (G1)", "em quarentena". */
  motivo?: string
  /** De onde o item veio. */
  de: 'contrato' | 'beneficio' | 'condicao' | 'entrevista' | 'complementar'
  /** A condição do caso que puxou a declaração (CA7). */
  condicao?: Condicao
  /** No Auxílio-Acidente e no LOAS da criança: obrigatório, desejável ou condicional (GGVP-47, GGVP-50). */
  exigencia?: Exigencia
  /** Aparece, mas não conta para o completo: desejável, condicional que não se aplica, recusa do empregador (GGVP-47, CA3). */
  naoConta?: true
}

export type Checklist = {
  /** O benefício tem lista aprovada pelo escritório (CA6). */
  temLista: boolean
  itens: ItemDoChecklist[]
  /** Calculado dos documentos, nunca marcado à mão (CA5). */
  completo: boolean
  /** Nome de cada item que não está recebido. */
  faltam: string[]
  /** O que trava o checklist além dos documentos: a categoria do segurado, a circunstância não marcada (GGVP-47). */
  bloqueio?: string
}

export type EntradaDoChecklist = {
  /** Undefined: o benefício ainda não tem lista aprovada (CA6). */
  lista: ListaDoBeneficio | undefined
  condicoes: Condicao[]
  /** O que a IA listou da entrevista e a advogada conferiu (CA8, GGVP-46). */
  daEntrevista: string[]
  documentos: DocumentoDoCaso[]
  /** O contrato do kit foi assinado (D1.17, grupo contrato). */
  contratoAssinado: boolean
  /** Os complementares: os da circunstância do acidente (GGVP-47) e os relatórios da criança (GGVP-50). */
  complementares?: Complementar[]
  bloqueio?: string
}

function situacao(tipo: string, documentos: DocumentoDoCaso[]): Pick<ItemDoChecklist, 'situacao' | 'motivo'> {
  const doTipo = documentos.filter((d) => d.tipo === tipo)
  const valem = doTipo.filter((d) => !d.quarentena)
  if (valem.some((d) => !d.semAssinatura && !d.dataEmBranco)) return { situacao: 'recebido' }
  // G1: sem assinatura ou com data em branco não vale (CA2).
  if (valem.some((d) => d.semAssinatura)) return { situacao: 'pendente', motivo: 'chegou sem assinatura (G1)' }
  if (valem.length > 0) return { situacao: 'pendente', motivo: 'chegou com a data em branco (G1)' }
  // Em quarentena não conta (GGVP-81, CA10).
  if (doTipo.length > 0) return { situacao: 'problema', motivo: 'chegou, mas está em quarentena: confira de quem é' }
  return { situacao: 'pendente', motivo: 'falta' }
}

/** O complementar: a exigência e por que não conta (GGVP-47, CA1 e CA3). */
function doComplementar(c: Complementar): Omit<ItemDoChecklist, 'nome' | 'situacao' | 'motivo'> {
  const naoConta = c.exigencia === 'desejavel' || !c.aplica || c.recusado
  return { tipo: c.tipo, de: 'complementar', exigencia: c.exigencia, ...(naoConta && { naoConta: true as const }) }
}

/** Por que o complementar pendente não conta: a recusa do empregador vira pendência (válvula) e o condicional pode não se aplicar. */
function motivoDoAcidente(c: Complementar): string | undefined {
  if (c.recusado) return 'o empregador recusou: pendência que não trava'
  if (!c.aplica) return 'só com internação ou cirurgia: não se aplica'
  return undefined
}

/** Monta o checklist do caso: o contrato, a lista do benefício, as condicionais do caso e o que a entrevista pediu. */
export function montarChecklist(e: EntradaDoChecklist): Checklist {
  const pedidos: Omit<ItemDoChecklist, 'nome' | 'situacao' | 'motivo'>[] = [
    ...(e.lista?.obrigatorios.map((tipo) => ({ tipo, de: 'beneficio' as const })) ?? []),
    ...(e.lista?.condicionais.filter((c) => e.condicoes.includes(c.quando)).map((c) => ({ tipo: c.tipo, de: 'condicao' as const, condicao: c.quando })) ?? []),
    ...(e.complementares?.map(doComplementar) ?? []),
    ...e.daEntrevista.map((tipo) => ({ tipo, de: 'entrevista' as const })),
  ].filter((p, i, todos) => p.tipo !== 'contrato' && todos.findIndex((q) => q.tipo === p.tipo) === i)

  const contrato: ItemDoChecklist = e.contratoAssinado
    ? { tipo: 'contrato', nome: 'Contrato assinado (kit)', situacao: 'recebido', de: 'contrato' }
    : { tipo: 'contrato', nome: 'Contrato assinado (kit)', situacao: 'pendente', motivo: 'falta a assinatura do cliente (D1.17)', de: 'contrato' }
  const itens = [
    contrato,
    ...pedidos.map((p) => {
      const item: ItemDoChecklist = { ...p, nome: nomeTipo(p.tipo), ...situacao(p.tipo, e.documentos) }
      const c = p.de === 'complementar' ? e.complementares?.find((x) => x.tipo === p.tipo) : undefined
      const motivo = c && item.situacao === 'pendente' && item.motivo === 'falta' && motivoDoAcidente(c)
      return motivo ? { ...item, motivo } : item
    }),
  ]
  const faltam = itens.filter((i) => i.situacao !== 'recebido' && !i.naoConta).map((i) => i.nome)
  const completo = e.lista !== undefined && faltam.length === 0 && !e.bloqueio
  return { temLista: e.lista !== undefined, itens, completo, faltam, ...(e.bloqueio && { bloqueio: e.bloqueio }) }
}

/** "a, b e c". */
export function juntar(itens: string[]): string {
  return itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}

/** Por que o caso não pode ser liberado ao Jurídico; pronto, null (CA3, CA6). */
export function motivoParaNaoLiberar(checklist: Checklist, beneficio: string): string | null {
  if (!checklist.temLista) {
    return `${beneficio} ainda não tem lista de documentos obrigatórios aprovada pelo escritório (configuração, GGVP-104): o caso não pode ser liberado.`
  }
  if (checklist.bloqueio) return checklist.bloqueio
  if (!checklist.completo) return `O checklist está incompleto. Falta: ${juntar(checklist.faltam)}.`
  return null
}
