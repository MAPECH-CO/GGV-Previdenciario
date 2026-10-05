// O contrato do caso, do kit à cópia (GGVP-65 em diante). Regra do escritório é código com teste, nunca resposta de modelo.
// A tabela dos kits é a do cartão GGVP-65 (board do escritório); a manutenção pela gestão vem com a GGVP-104.
import { formatarCpf, formatarTelefone, normalizarCpf, normalizarNome, normalizarTelefone } from '../campos.ts'
import type { TipoDeEntrevista } from '../dados/tipos.ts'
import { somarDias } from './agenda.ts'
import { erroCpf, erroNome, erroTelefone } from './formularios.ts'

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

// GGVP-69 · preencher o modelo com os dados do cliente e do processo e conferir antes de mandar assinar.

export type CampoDoModelo =
  | 'nome'
  | 'estadoCivil'
  | 'profissao'
  | 'cpf'
  | 'rg'
  | 'endereco'
  | 'telefone'
  | 'beneficio'
  | 'parteContraria'
  | 'representanteNome'
  | 'representanteCpf'
  | 'representanteRg'
  | 'representanteParentesco'

export const ROTULOS_DOS_CAMPOS: Record<CampoDoModelo, string> = {
  nome: 'Nome completo',
  estadoCivil: 'Estado civil',
  profissao: 'Profissão',
  cpf: 'CPF',
  rg: 'RG',
  endereco: 'Endereço',
  telefone: 'Telefone',
  beneficio: 'Benefício',
  parteContraria: 'Parte contrária',
  representanteNome: 'Nome do representante',
  representanteCpf: 'CPF do representante',
  representanteRg: 'RG do representante',
  representanteParentesco: 'Parentesco do representante',
}

/** De onde veio cada campo (CA5). */
export type Origem = 'cadastro' | 'ficha' | 'documento' | 'caso' | 'corrigido'

export const ROTULOS_DAS_ORIGENS: Record<Origem, string> = {
  cadastro: 'cadastro',
  ficha: 'ficha de atendimento',
  documento: 'documento na pasta',
  caso: 'caso',
  corrigido: 'corrigido aqui',
}

export type CampoPreenchido = { campo: CampoDoModelo; rotulo: string; valor: string; origem: Origem; obrigatorio: boolean }

/** O que o contrato guarda e a ficha não tem: o RG, a parte contrária escrita e o representante (CA1). */
export type DadosDoContrato = Partial<
  Record<'rg' | 'parteContraria' | 'representanteNome' | 'representanteCpf' | 'representanteRg' | 'representanteParentesco', string>
>

export const PARENTESCOS = [
  { id: 'genitora', nome: 'Genitora' },
  { id: 'genitor', nome: 'Genitor' },
]

/** A parte contrária dos kits do INSS. */
export const INSS = 'Instituto Nacional do Seguro Social (INSS)'

/** Nos kits do INSS, o INSS; no empréstimo e no seguro, a pessoa escreve; na curatela, não há. */
export function parteContrariaDoKit(linha: LinhaDoKit | undefined): 'inss' | 'escrever' | 'nao-ha' {
  if (linha?.termoInss) return 'inss'
  return linha?.acaoContra ? 'escrever' : 'nao-ha'
}

/** O que a montagem dos campos precisa da ficha: os dados pessoais e o que já está na pasta. */
export type FichaParaOModelo = {
  nome: string
  cpf?: string
  telefone: string
  estadoCivil?: string
  profissao?: string
  endereco?: string
  /** A ficha de atendimento foi preenchida no portal (GGVP-24). */
  fichaAtendimento?: unknown
  documentos: { nome: string }[]
  arquivos: { tipo: string }[]
}

const formatar = (campo: CampoDoModelo, valor: string) =>
  campo === 'cpf' || campo === 'representanteCpf' ? formatarCpf(valor) : campo === 'telefone' ? formatarTelefone(valor) : valor

/**
 * Os campos do modelo, com o valor e de onde veio (CA1, CA5). O representante só entra no LOAS representado (CA9); a parte
 * contrária, quando o kit tem uma.
 */
export function camposDoModelo(entrada: {
  ficha: FichaParaOModelo
  beneficio: string
  nomeDoBeneficio: string
  condicoes: CondicoesDoKit
  dados: DadosDoContrato
  corrigidos: CampoDoModelo[]
}): CampoPreenchido[] {
  const { ficha, beneficio, nomeDoBeneficio, condicoes, dados, corrigidos } = entrada
  const linha = linhaDoBeneficio(beneficio)
  const daTriagem = ficha.fichaAtendimento !== undefined
  const cpfNaPasta = ficha.documentos.some((d) => d.nome === 'CPF') || ficha.arquivos.some((a) => a.tipo === 'cpf')
  const rgNaPasta = ficha.documentos.some((d) => d.nome === 'RG') || ficha.arquivos.some((a) => a.tipo === 'rg')
  const campos: [CampoDoModelo, string | undefined, Origem][] = [
    ['nome', ficha.nome, daTriagem ? 'ficha' : 'cadastro'],
    ['estadoCivil', ficha.estadoCivil, 'cadastro'],
    ['profissao', ficha.profissao, 'cadastro'],
    ['cpf', ficha.cpf, cpfNaPasta ? 'documento' : daTriagem ? 'ficha' : 'cadastro'],
    ['rg', dados.rg, rgNaPasta ? 'documento' : 'cadastro'],
    ['endereco', ficha.endereco, daTriagem ? 'ficha' : 'cadastro'],
    ['telefone', ficha.telefone, daTriagem ? 'ficha' : 'cadastro'],
    ['beneficio', nomeDoBeneficio, 'caso'],
  ]
  const parte = parteContrariaDoKit(linha)
  if (parte !== 'nao-ha') campos.push(['parteContraria', parte === 'inss' ? INSS : dados.parteContraria, 'caso'])
  if (linha?.loas && condicoes.representado) {
    const parentesco = PARENTESCOS.find((p) => p.id === dados.representanteParentesco)?.nome
    campos.push(
      ['representanteNome', dados.representanteNome, 'caso'],
      ['representanteCpf', dados.representanteCpf, 'caso'],
      ['representanteRg', dados.representanteRg, 'caso'],
      ['representanteParentesco', parentesco, 'caso'],
    )
  }
  return campos.map(([campo, valor, origem]) => ({
    campo,
    rotulo: ROTULOS_DOS_CAMPOS[campo],
    valor: valor ? formatar(campo, valor) : '',
    origem: corrigidos.includes(campo) ? 'corrigido' : origem,
    obrigatorio: true,
  }))
}

export const faltando = (campos: CampoPreenchido[]) => campos.filter((c) => c.obrigatorio && c.valor.trim() === '').map((c) => c.campo)

/** O que a pessoa corrige na tela: o benefício não (ele muda o kit), nem a parte contrária dos kits do INSS. */
export const corrigivel = (c: CampoPreenchido) => c.campo !== 'beneficio' && !(c.campo === 'parteContraria' && c.valor === INSS)

const TAMANHOS: Partial<Record<CampoDoModelo, number>> = { estadoCivil: 40, profissao: 200, endereco: 200, parteContraria: 120 }

export const MENSAGENS_DO_CONTRATO = {
  rg: 'RG com 5 a 20 letras e números.',
  texto: 'Preencha este campo.',
  parentesco: 'Escolha genitora ou genitor.',
} as const

/** RG: letras, números e a pontuação, de 5 a 20. A biblioteca campos não tem RG. */
export function erroRg(valor: string): string | undefined {
  return /^[0-9A-Za-z.\-/ ]{5,20}$/.test(valor.trim()) ? undefined : MENSAGENS_DO_CONTRATO.rg
}

/** A mensagem embaixo de cada campo corrigido, pela biblioteca campos; o servidor valida de novo (CA3, CA7). */
export function erroDoCampo(campo: CampoDoModelo, valor: string): string | undefined {
  if (campo === 'nome' || campo === 'representanteNome') return erroNome(valor)
  if (campo === 'cpf' || campo === 'representanteCpf') return erroCpf(valor, true)
  if (campo === 'telefone') return erroTelefone(valor)
  if (campo === 'rg' || campo === 'representanteRg') return erroRg(valor)
  if (campo === 'representanteParentesco') return PARENTESCOS.some((p) => p.id === valor) ? undefined : MENSAGENS_DO_CONTRATO.parentesco
  const tamanho = TAMANHOS[campo] ?? 200
  return valor.trim() !== '' && valor.trim().length <= tamanho ? undefined : MENSAGENS_DO_CONTRATO.texto
}

/** O valor que fica guardado: CPF e telefone só com números, nome sem espaço sobrando. */
export function normalizarCampo(campo: CampoDoModelo, valor: string): string {
  if (campo === 'cpf' || campo === 'representanteCpf') return normalizarCpf(valor)
  if (campo === 'telefone') return normalizarTelefone(valor)
  if (campo === 'nome' || campo === 'representanteNome') return normalizarNome(valor)
  return valor.trim()
}

/** As quatro conferências antes de "Gerar contrato" (CA6, Figma 10:143). */
export const CONFERENCIAS = [
  { id: 'campos', rotulo: 'Campos certos e completos' },
  { id: 'datas', rotulo: 'Datas feitas à mão serão preenchidas na assinatura' },
  { id: 'fichaLoas', rotulo: 'Ficha LOAS: cliente ou representante legal (se aplicável)' },
  { id: 'codigoPenal', rotulo: 'A página do Código Penal não tem assinatura' },
] as const

export type IdDaConferencia = (typeof CONFERENCIAS)[number]['id']

/** A lista "O que conferir" (CA2). */
export const O_QUE_CONFERIR = [
  'As datas feitas à mão: no papel saem em branco, para preencher na assinatura, menos o contrato de honorários; no ZapSign, vale a data da assinatura.',
  'Na ficha LOAS: se quem assina é o cliente ou o representante legal.',
  'A página do Código Penal vai sem assinatura.',
]

const juntar = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`)

/** Por que "Gerar contrato" ainda não habilita; nulo quando habilita (CA6, CA7). */
export function motivoParadoDoGerar(estado: {
  aprovados: boolean | null
  oQueCorrigir: string
  conferencias: Partial<Record<IdDaConferencia, boolean>>
  faltam: CampoDoModelo[]
}): string | null {
  if (estado.aprovados === null) return 'Responda se os documentos foram aprovados.'
  if (!estado.aprovados && estado.oQueCorrigir.trim().length < 3) return 'Escreva o que corrigir.'
  if (estado.faltam.length > 0) return `Falta: ${juntar(estado.faltam.map((c) => ROTULOS_DOS_CAMPOS[c]))}.`
  if (CONFERENCIAS.some((c) => !estado.conferencias[c.id])) return 'Marque as quatro conferências.'
  return null
}

export type FormaDeAssinar = 'digital' | 'papel'

/**
 * A data de cada documento do kit (CA4): no papel, em branco para preencher à mão na assinatura, menos o contrato de
 * honorários, que sai com a data de hoje; no ZapSign, a data da assinatura.
 */
export function datasDoKit(kit: KitMontado, forma: FormaDeAssinar, hoje: string): { documento: string; data: string }[] {
  const [a, m, d] = hoje.split('-')
  return kit.documentos.map((doc) => ({
    documento: doc.nome,
    data: forma === 'digital' ? 'data da assinatura no ZapSign' : doc.id === 'contrato' ? `${d}/${m}/${a}` : 'em branco, à mão na assinatura',
  }))
}

/** O identificador do modelo, o mesmo na pasta "MODELOS ZAPSIGN · PREV" e no ZapSign (CA10). */
export const identificadorDoModelo = (m: Modelo) => `${m.id}-v${m.versao}`

export const caminhoDoModelo = (m: Modelo) => `${PASTA_DOS_MODELOS}/${identificadorDoModelo(m)}`

/** Os honorários vêm do modelo, sem campo para digitar (CA11). */
export const honorariosDoModelo = (m: Modelo) => m.honorarios ?? `os do ${m.nome}`

/** Troca cada {{campo}} do modelo pelo valor; o que não tem valor fica como está, para a verificação achar. */
export function preencherModelo(texto: string, valores: Record<string, string>): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (marca, campo: string) => valores[campo] || marca)
}

/** O que sobrou do modelo no texto gerado: campo {{...}} sem valor ou dado do cliente de exemplo do modelo (CA8). */
export function restosDoModelo(texto: string, dadosDoExemplo: string[]): string[] {
  const campos = texto.match(/\{\{\w+\}\}/g) ?? []
  const exemplo = dadosDoExemplo.filter((d) => texto.toLowerCase().includes(d.toLowerCase()))
  return [...new Set([...campos, ...exemplo])]
}

// GGVP-72 · assinatura digital pelo ZapSign.

/** Quantas tentativas de contato sem assinatura antes de o caso subir para a advogada sênior (G15; Lucas e Pedro, 05/10). */
export const TENTATIVAS_DE_ASSINATURA = 2

/** Dias entre uma tentativa e a próxima (Lucas e Pedro, 05/10): a mesma regra de cobrar documentos e confirmar a entrevista. */
export const DIAS_ENTRE_TENTATIVAS_DE_ASSINATURA = 3

export type CanalDaTentativa = 'whatsapp' | 'ligacao'

export const NOMES_DOS_CANAIS: Record<CanalDaTentativa, string> = { whatsapp: 'WhatsApp', ligacao: 'Ligação' }

/**
 * Onde a cobrança da assinatura está (CA2, CA5, CA11): a tentativa de agora, a data da próxima e se hoje é dia de tentar.
 * A primeira tentativa é o link enviado; a segunda, 3 dias depois; com a segunda sem assinatura, o limite foi atingido.
 */
export function cobrancaDaAssinatura(tentativas: { data: string }[], hoje: string): { feitas: number; proximaEm?: string; lembrar: boolean; noLimite: boolean } {
  const feitas = tentativas.length
  if (feitas === 0) return { feitas, lembrar: false, noLimite: false }
  if (feitas >= TENTATIVAS_DE_ASSINATURA) return { feitas, lembrar: false, noLimite: true }
  const proximaEm = somarDias(tentativas[feitas - 1].data, DIAS_ENTRE_TENTATIVAS_DE_ASSINATURA)
  return { feitas, proximaEm, lembrar: hoje >= proximaEm, noLimite: false }
}

/** A mensagem do WhatsApp com o link do ZapSign (CA12). */
export function mensagemDoLink(nome: string, link: string, lembrete: boolean): string {
  const primeiro = nome.split(' ')[0]
  return lembrete
    ? `Olá, ${primeiro}! Passando para lembrar do contrato do escritório que ainda falta assinar. O link é o mesmo: ${link}. Se tiver dúvida, é só responder aqui.`
    : `Olá, ${primeiro}! Aqui está o link para assinar o contrato do escritório pelo celular: ${link}. Leva poucos minutos. Assim que assinar, a cópia chega para você aqui pelo WhatsApp.`
}

// GGVP-77 · assinatura em papel na entrevista.

/**
 * Como foi a entrevista do caso: a mais recente que não foi remarcada. Sem entrevista registrada (cliente antigo, nova demanda
 * no balcão), é presencial.
 */
export function entrevistaDoCaso(agendamentos: { oQue: string; data: string; tipo?: TipoDeEntrevista; estado?: string }[]): TipoDeEntrevista {
  const entrevistas = agendamentos.filter((a) => a.oQue === 'Entrevista' && a.estado !== 'remarcado').sort((a, b) => b.data.localeCompare(a.data))
  return entrevistas[0]?.tipo ?? 'presencial'
}

/** Papel na hora só na entrevista presencial; por vídeo ou telefone, a assinatura vai pelo ZapSign (CA4). */
export const papelNaHora = (entrevista: TipoDeEntrevista) => entrevista === 'presencial'
