// O checklist de documentos obrigatórios do benefício (GGVP-91). A lista de cada benefício vem da configuração do
// escritório (GGVP-104), nunca desta regra (CA10). Trava de liberação é código com teste, nunca resposta de modelo.
import { nomeTipo } from '../dados/catalogos.ts'
import type { Ficha, Processo } from '../dados/tipos.ts'
import { bloqueioDoAcidente, complementares, type Complementar, type DadosDoAcidente, type Exigencia, type TabelaDoAcidente } from './acidente.ts'
import { relatoriosDaCrianca, type DadosDaCrianca } from './infantil.ts'
import type { DocumentoLido } from './leitura.ts'

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
  if (!c.aplica) return 'só se houve auxílio por incapacidade temporária antes: não se aplica'
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

/** Uma conferência do checklist: quem conferiu fica no histórico da ficha. */
export type ConferenciaDoChecklist = { processoId: string; quando: string; completo: boolean; faltam: string[] }

export type ChecklistDoCaso = {
  ficha: Ficha
  processo: Processo
  beneficio: string
  checklist: Checklist
  /** As condições do caso que puxaram declarações (CA7). */
  condicoes: Condicao[]
  /** A última conferência, se já houve. */
  conferencia?: ConferenciaDoChecklist
}

/** O checklist de um caso do servidor na cópia das telas: o do caso, sem a ficha e o processo, que a cópia já tem. */
export type ChecklistNaCopia = Omit<ChecklistDoCaso, 'ficha' | 'processo'> & { processoId: string }

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

// O que as telas e o servidor calculam igual (GGVP-125, bloco 5c): o servidor monta o checklist dos casos do banco.

/**
 * Os nomes do kit que o escritório configura no servidor (GGVP-104) na lista única das telas. A semente do kit do LOAS
 * nasceu com os nomes do banco, e o card grava o documento com o nome da tela; o que não está aqui já é o da tela.
 */
export const NOME_NAS_TELAS: Record<string, string> = {
  documento_de_identidade: 'rg',
  comprovante_de_residencia: 'comprovante-residencia',
  ficha_de_grupo_familiar: 'grupo-familiar',
  declaracao_de_moradia: 'declaracao-moradia',
  declaracao_de_uniao_estavel: 'declaracao-uniao-estavel',
  declaracao_de_separacao_de_fato: 'declaracao-separacao',
}

export const nomeNasTelas = (tipo: string) => NOME_NAS_TELAS[tipo] ?? tipo

/** As declarações do LOAS que só entram quando a condição do caso pede (CA7), marcadas ou não como obrigatórias no kit. */
const DECLARACOES: Record<string, Condicao> = { 'declaracao-moradia': 'moradia', 'declaracao-uniao-estavel': 'uniao-estavel', 'declaracao-separacao': 'separacao-de-fato' }

/** O kit vigente do benefício como a lista do checklist; kit vazio é benefício sem lista aprovada (CA6). O opcional não entra. */
export function listaDoKit(kit: { tipoDocumento: string; obrigatorio: boolean }[]): ListaDoBeneficio | undefined {
  if (kit.length === 0) return undefined
  const tipos = kit.map((k) => ({ tipo: nomeNasTelas(k.tipoDocumento), obrigatorio: k.obrigatorio }))
  return {
    obrigatorios: tipos.filter((k) => k.obrigatorio && !DECLARACOES[k.tipo]).map((k) => k.tipo),
    condicionais: tipos.filter((k) => DECLARACOES[k.tipo]).map((k) => ({ tipo: k.tipo, quando: DECLARACOES[k.tipo] })),
  }
}

/** O contrato do caso já foi assinado (GGVP-72, GGVP-77): da leitura em diante. Sem contrato no portal, vale a etapa do processo. */
export function contratoAssinadoDo(contrato: { etapa: string } | undefined, etapaDoProcesso: string): boolean {
  if (!contrato) return !etapaDoProcesso.startsWith('Contrato ·')
  return ['leitura', 'conferir', 'copia', 'entregue'].includes(contrato.etapa)
}

/** As miniaturas da semente ("RG", "CNIS"...), com o tipo da lista única. */
const LEGADO: Record<string, string> = { RG: 'rg', CPF: 'cpf', 'Comp. residência': 'comprovante-residencia', CNIS: 'cnis', CTPS: 'ctps', Procuração: 'procuracao' }

/**
 * Os documentos classificados do caso: Documentos pessoais, que valem para todo processo do cliente (CA9), a subpasta deste
 * processo e a quarentena. `leituras` são as da ficha; `daSemente`, os documentos médicos da semente do parecer (GGVP-47).
 */
export function documentosDoCaso(
  ficha: Pick<Ficha, 'documentos' | 'arquivos'>,
  leituras: Pick<DocumentoLido, 'arquivo' | 'tipo' | 'situacao' | 'semAssinatura' | 'dataEmBranco'>[],
  processoId: string,
  daSemente: string[] = [],
): DocumentoDoCaso[] {
  const legado = ficha.documentos.flatMap((d) => (LEGADO[d.nome] ? [{ tipo: LEGADO[d.nome] }] : []))
  const daPasta = ficha.arquivos
    .filter((a) => !a.aguardaLeitura && (a.local === 'pessoais' || a.local === processoId))
    .map((a) => {
      const lido = leituras.find((l) => l.arquivo === a.nome)
      return { tipo: a.tipo, semAssinatura: lido?.semAssinatura, dataEmBranco: lido?.dataEmBranco }
    })
  const quarentena = leituras.filter((l) => l.situacao === 'quarentena').map((l) => ({ tipo: l.tipo, quarentena: true }))
  return [...legado, ...daPasta, ...daSemente.map((tipo) => ({ tipo })), ...quarentena]
}

/**
 * Os complementares do Auxílio-Acidente por circunstância (GGVP-47): respostas do Lucas de 01/10 (Q19) e de 07/10, no grupo.
 * O prontuário vale para todos os casos, mesmo sem internação ou cirurgia, porque mostra a evolução e as sequelas. No
 * trânsito e no doméstico o boletim de ocorrência é obrigatório e entram as fotos do acidente. A cópia do processo do auxílio
 * por incapacidade temporária entra se houve um antes (o condicional).
 */
const obrigatorio = (tipo: string) => ({ tipo, exigencia: 'obrigatorio' as const })
const BOLETIM_DESEJAVEL = { tipo: 'boletim-ocorrencia', exigencia: 'desejavel' as const }
const PROCESSO_ANTERIOR = { tipo: 'processo-auxilio-anterior', exigencia: 'condicional' as const }
const DE_TRABALHO = [
  obrigatorio('cat'),
  BOLETIM_DESEJAVEL,
  obrigatorio('ficha-pronto-socorro'),
  obrigatorio('prontuario'),
  obrigatorio('exame-imagem-epoca'),
  obrigatorio('exame-pos-alta'),
  PROCESSO_ANTERIOR,
]
const PREVIDENCIARIO = [
  obrigatorio('boletim-ocorrencia'),
  obrigatorio('fotos-acidente'),
  obrigatorio('ficha-pronto-socorro'),
  obrigatorio('prontuario'),
  obrigatorio('exame-imagem-epoca'),
  obrigatorio('exame-pos-alta'),
]

export const TABELA_DO_ACIDENTE: TabelaDoAcidente = {
  trabalho: DE_TRABALHO,
  trajeto: DE_TRABALHO,
  // Na doença ocupacional o nexo pode vir pelo NTEP: o PPP é obrigatório, não há pronto-socorro, e os exames mostram o quadro e a evolução.
  ocupacional: [obrigatorio('cat'), obrigatorio('ppp'), BOLETIM_DESEJAVEL, obrigatorio('prontuario'), obrigatorio('exame-evolucao'), PROCESSO_ANTERIOR],
  transito: PREVIDENCIARIO,
  domestico: PREVIDENCIARIO,
}

const SEM_CIRCUNSTANCIA = 'Marque a circunstância do acidente: o que é obrigatório depende dela.'

const SEM_CONDICAO = 'A advogada marca a condição da criança no parecer: os relatórios que o caso pede dependem dela.'

/** Os complementares e o bloqueio do caso: a circunstância do acidente (GGVP-47) ou a condição da criança (GGVP-50). */
export function complementaresDoCaso(c: { beneficio: string; infantil: boolean; acidente?: DadosDoAcidente; crianca?: DadosDaCrianca }): {
  complementares?: Complementar[]
  bloqueio?: string
} {
  if (c.beneficio === 'auxilio-acidente') {
    if (!c.acidente) return { bloqueio: SEM_CIRCUNSTANCIA }
    const bloqueio = bloqueioDoAcidente(c.acidente)
    return { complementares: complementares(TABELA_DO_ACIDENTE, c.acidente), ...(bloqueio && { bloqueio }) }
  }
  if (c.infantil) {
    // Sem a condição, nenhum relatório entra ainda, e o checklist espera a advogada.
    const relatorios = relatoriosDaCrianca(c.crianca ?? { condicoes: [], terapias: [], escola: false })
    const pedidos = relatorios.map((tipo) => ({ tipo, exigencia: 'obrigatorio' as const, aplica: true, recusado: false }))
    return { complementares: pedidos, ...(!c.crianca && { bloqueio: SEM_CONDICAO }) }
  }
  return {}
}
