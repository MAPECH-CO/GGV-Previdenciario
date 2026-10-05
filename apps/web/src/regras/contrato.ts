// O contrato do caso, do kit à cópia (GGVP-65 em diante). Regra do escritório é código com teste, nunca resposta de modelo.
// A tabela dos kits é a do cartão GGVP-65 (board do escritório); a manutenção pela gestão vem com a GGVP-104.

export type DocumentoDoKit =
  | 'contrato'
  | 'procuracao'
  | 'hipossuficiencia'
  | 'residencia'
  | 'termo-inss'
  | 'codigo-penal'
  | 'grupo-familiar'
  | 'declaracao-moradia'
  | 'declaracao-uniao-estavel'
  | 'declaracao-separacao'

export const NOMES_DOS_DOCUMENTOS: Record<DocumentoDoKit, string> = {
  contrato: 'Contrato de honorários',
  procuracao: 'Procuração',
  hipossuficiencia: 'Declaração de hipossuficiência',
  residencia: 'Declaração de residência',
  'termo-inss': 'Termo INSS',
  'codigo-penal': 'Código Penal',
  'grupo-familiar': 'Ficha de grupo familiar',
  'declaracao-moradia': 'Declaração de moradia',
  'declaracao-uniao-estavel': 'Declaração de união estável',
  'declaracao-separacao': 'Declaração de separação de fato',
}

export type IdDoModelo = 'contrato-completo-2026' | 'modelo-6' | 'modelo-7' | 'modelo-8' | 'modelo-10'

/** Onde os modelos convertidos ficam, no Drive e no ZapSign, com o mesmo identificador (GGVP-69, CA10). */
export const PASTA_DOS_MODELOS = 'MODELOS ZAPSIGN · PREV'

export type Modelo = {
  id: IdDoModelo
  nome: string
  /** Versão publicada do modelo convertido. */
  versao: number
  /** O que o modelo traz de honorários, sem campo para digitar (GGVP-69, CA11). Só o Contrato Completo 2026 está no Figma. */
  honorarios?: string
}

export const MODELOS: Modelo[] = [
  { id: 'contrato-completo-2026', nome: 'Contrato Completo 2026', versao: 1, honorarios: '20% do êxito (ad exitum)' },
  { id: 'modelo-6', nome: 'modelo 6', versao: 1 },
  { id: 'modelo-7', nome: 'modelo 7', versao: 1 },
  { id: 'modelo-8', nome: 'modelo 8', versao: 1 },
  { id: 'modelo-10', nome: 'modelo 10', versao: 1 },
]

export const modeloPorId = (id: IdDoModelo): Modelo => MODELOS.find((m) => m.id === id)!

/** Uma linha da tabela "Kits por benefício". */
export type LinhaDoKit = {
  id: string
  nome: string
  /** Ids do catálogo BENEFICIOS (catalogos.ts): o mesmo da ficha, do checklist e das Centrais (CA6). */
  beneficios: string[]
  documentos: DocumentoDoKit[]
  /** Para que serve o Termo INSS desta linha. */
  termoInss?: string
  modelo: IdDoModelo
  /** Contra quem é a ação, quando não é o INSS. */
  acaoContra?: string
  /** LOAS: ficha de grupo familiar, declarações condicionais e o representado (CA2, CA8). */
  loas?: boolean
}

const BASE: DocumentoDoKit[] = ['contrato', 'procuracao', 'hipossuficiencia', 'residencia', 'termo-inss', 'codigo-penal']

export const KITS: LinhaDoKit[] = [
  {
    id: 'aposentadorias',
    nome: 'Aposentadorias',
    beneficios: ['aposentadoria-especial', 'aposentadoria-contribuicao', 'aposentadoria-idade', 'aposentadoria-rural', 'aposentadoria-pcd', 'aposentadoria-pcd-idade'],
    documentos: BASE,
    termoInss: 'aposentadorias, CTC, recursos',
    modelo: 'contrato-completo-2026',
  },
  {
    id: 'auxilio-acidentario',
    nome: 'Auxílio acidentário',
    beneficios: ['auxilio-acidente'],
    documentos: BASE,
    termoInss: 'auxílio-acidente, acréscimo de 25%',
    modelo: 'contrato-completo-2026',
  },
  {
    id: 'auxilio-incapacidade',
    nome: 'Auxílio incapacidade',
    // A aposentadoria por incapacidade permanente, acidentária ou não, vai pelo termo de incapacidade temporária e permanente.
    beneficios: ['incapacidade-temporaria', 'incapacidade-permanente', 'incapacidade-permanente-acidentaria'],
    documentos: BASE,
    termoInss: 'incapacidade temporária e permanente, 25%',
    modelo: 'contrato-completo-2026',
  },
  {
    id: 'loas',
    nome: 'LOAS idoso ou deficiente',
    beneficios: ['loas-idoso', 'loas-deficiente'],
    documentos: BASE,
    termoInss: 'BPC idoso e PcD, recursos',
    modelo: 'contrato-completo-2026',
    loas: true,
  },
  {
    id: 'curatela',
    nome: 'Curatela',
    beneficios: ['curatela'],
    documentos: ['contrato', 'procuracao', 'hipossuficiencia', 'residencia'],
    modelo: 'modelo-6',
  },
  {
    id: 'isencao-ir',
    nome: 'Isenção de IR',
    beneficios: ['isencao-ir'],
    documentos: ['contrato', 'procuracao', 'termo-inss', 'codigo-penal', 'residencia'],
    termoInss: 'isenção de IR',
    modelo: 'modelo-7',
  },
  {
    id: 'emprestimo-fraudulento',
    nome: 'Empréstimo fraudulento',
    beneficios: ['emprestimo-indevido'],
    documentos: ['contrato', 'procuracao', 'hipossuficiencia'],
    modelo: 'modelo-8',
    acaoContra: 'o banco',
  },
  {
    id: 'seguro-vida',
    nome: 'Seguro de vida',
    beneficios: ['seguro-vida'],
    documentos: ['contrato', 'procuracao', 'hipossuficiencia'],
    modelo: 'modelo-10',
    acaoContra: 'a seguradora',
  },
]

/** O que o caso diz e muda o kit do LOAS (CA2, CA8). Ajusta com a tabela da GGVP-104. */
export type CondicoesDoKit = {
  /** LOAS representado por genitor(a): dados e assinatura do representado e de quem o representa. */
  representado: boolean
  /** O comprovante de residência não está no nome do cliente. */
  moradia: boolean
  uniaoEstavel: boolean
  /** Casado(a) no papel, separado(a) de fato. */
  separacaoDeFato: boolean
}

export const SEM_CONDICOES: CondicoesDoKit = { representado: false, moradia: false, uniaoEstavel: false, separacaoDeFato: false }

export type ItemDoKit = {
  id: DocumentoDoKit
  nome: string
  /** "aposentadorias, CTC, recursos", "obrigatória em todo LOAS", "condição do caso"... */
  detalhe?: string
  /** Entrou pela condição do caso (CA8). */
  condicional?: boolean
}

/** O kit montado para um caso, guardado no caso. */
export type KitMontado = {
  linha: string
  nome: string
  modelo: IdDoModelo
  documentos: ItemDoKit[]
  /** Quem assina: o cliente, ou o representado e quem o representa (CA2). */
  assinam: string[]
  acaoContra?: string
}

export const linhaDoBeneficio = (beneficio: string): LinhaDoKit | undefined => KITS.find((k) => k.beneficios.includes(beneficio))

/**
 * O kit do benefício, com exatamente os documentos da tabela (CA1, CA3, CA4) e o modelo da coluna "Modelo" (CA5).
 * LOAS leva a ficha de grupo familiar sempre e as declarações quando a condição do caso pede (CA8); representado leva o
 * representado e o genitor ou a genitora (CA2). Benefício fora da tabela não tem kit: nada é gerado.
 */
export function montarKit(beneficio: string, condicoes: CondicoesDoKit = SEM_CONDICOES): KitMontado | null {
  const linha = linhaDoBeneficio(beneficio)
  if (!linha) return null
  const documentos: ItemDoKit[] = linha.documentos.map((id) => ({
    id,
    nome: NOMES_DOS_DOCUMENTOS[id],
    ...(id === 'termo-inss' && linha.termoInss && { detalhe: linha.termoInss }),
    ...(id === 'hipossuficiencia' && linha.acaoContra && { detalhe: `ação contra ${linha.acaoContra}` }),
  }))
  const representado = linha.loas === true && condicoes.representado
  if (linha.loas) {
    documentos.push({ id: 'grupo-familiar', nome: NOMES_DOS_DOCUMENTOS['grupo-familiar'], detalhe: 'obrigatória em todo LOAS' })
    const condicionais: [boolean, DocumentoDoKit, string][] = [
      [condicoes.moradia, 'declaracao-moradia', 'o comprovante de residência não está no nome do cliente'],
      [condicoes.uniaoEstavel, 'declaracao-uniao-estavel', 'vive em união estável'],
      [condicoes.separacaoDeFato, 'declaracao-separacao', 'casado(a) no papel, separado(a) de fato'],
    ]
    for (const [vale, id, detalhe] of condicionais) if (vale) documentos.push({ id, nome: NOMES_DOS_DOCUMENTOS[id], detalhe, condicional: true })
  }
  return {
    linha: linha.id,
    nome: representado ? 'LOAS representado (genitor)' : linha.nome,
    modelo: linha.modelo,
    documentos,
    assinam: representado ? ['o representado (cliente)', 'o genitor ou a genitora (representante legal)'] : ['o cliente'],
    ...(linha.acaoContra && { acaoContra: linha.acaoContra }),
  }
}
