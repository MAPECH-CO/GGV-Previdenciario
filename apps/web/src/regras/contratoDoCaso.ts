// O contrato do caso (GGVP-65 em diante): os tipos e as regras puras que as telas e o servidor usam iguais (GGVP-125,
// bloco 4a). Sem o banco de exemplo: o servidor importa daqui sem carregar as telas.
import { nomeBeneficio } from '../dados/catalogos.ts'
import { somarDias } from './agenda.ts'
import type { Ficha, Processo } from '../dados/tipos.ts'
import {
  HONORARIOS_DO_MODELO,
  SEM_CONDICOES,
  camposDoModelo,
  montarKit,
  preencherModelo,
  type CampoDoModelo,
  type CampoPreenchido,
  type CanalDaTentativa,
  type CondicoesDoKit,
  type DadosDoContrato,
  type DocumentoDoKit,
  type FormaDeAssinar,
  type IdDaConferencia,
  type KitMontado,
  type LeituraDoContrato,
} from './contrato.ts'

// Espelho do contrato (Zod) da spec de cada história; vai para packages/contratos/contrato.ts.

/**
 * Onde o contrato do caso está: preparar (D1.16), colher a assinatura (D1.17), a leitura do assinado pela Documentação (D1.18,
 * GGVP-81) e, nas histórias seguintes, conferir e a cópia.
 */
export type EtapaDoContrato = 'preparar' | 'assinatura' | 'leitura' | 'conferir' | 'copia' | 'entregue'

/** O documento gerado pelo modelo: os campos e o texto de cada documento do kit (GGVP-69). */
export type DocumentoGerado = {
  versao: number
  /** Data e hora ISO. */
  geradoEm: string
  campos: CampoPreenchido[]
  textos: { documento: string; texto: string }[]
}

export type Contrato = {
  processoId: string
  fichaId: string
  etapa: EtapaDoContrato
  /** O que o caso diz e muda o kit do LOAS (GGVP-65, CA2 e CA8). */
  condicoes: CondicoesDoKit
  /** Guardado no caso; nulo quando o benefício não tem kit na tabela. */
  kit: KitMontado | null
  /** Data e hora ISO em que o caso fechou. */
  abertoEm: string
  /** O RG, a parte contrária escrita e o representante: a ficha não tem (GGVP-69). */
  dados?: DadosDoContrato
  /** Os campos corrigidos na conferência (GGVP-69, CA5). */
  corrigidos?: CampoDoModelo[]
  documento?: DocumentoGerado
  /** Toda versão gerada fica, com o motivo (GGVP-69, CA3). */
  versoes?: { versao: number; geradoEm: string; motivo: string }[]
  /** Como o cliente assina e o que já aconteceu (GGVP-72). */
  assinatura?: Assinatura
  /** O que a IA leu do contrato assinado (GGVP-81 lê; GGVP-85 confere). */
  leitura?: LeituraDoContrato & { lidoEm: string }
  /** A conferência do Atendimento: "Está tudo certo?" (GGVP-85, CA5). */
  verificacao?: { tudoCerto: boolean; oQueCorrigir?: string; paginaCorrigida?: string; quem: string; quando: string }
  /** As versões assinadas que voltaram para corrigir: ficam no histórico (GGVP-85, CA6). */
  anteriores?: { versao: number; arquivo?: string; motivo: string; quando: string }[]
  /** A cópia para o cliente levar (GGVP-89): a impressão, a visita marcada e a entrega. */
  copia?: {
    impressaEm?: string
    /** O compromisso "Entregar cópia do contrato" na agenda (CA4). */
    visitaId?: string
    entrega?: { entregueEm: string; quemRecebeu: string; observacao?: string; quem: string; quando: string }
  }
}

/** Uma tentativa de contato para o cliente assinar: o link enviado e os lembretes (GGVP-72, CA5). */
export type TentativaDeAssinatura = {
  /** aaaa-mm-dd */
  data: string
  /** Data e hora ISO. */
  quando: string
  canal: CanalDaTentativa
  quem: string
}

export type Assinatura = {
  forma: FormaDeAssinar
  /** Um documento no ZapSign por kit; o identificador fica no caso (GGVP-72, CA4). */
  zapsign?: {
    documentoId: string
    link: string
    /** O status que a integração informa. */
    status: 'enviado' | 'assinado'
    criadoEm: string
    /** Os eventos do retorno já recebidos: o mesmo evento repetido não anexa duas vezes (CA7). */
    eventos: string[]
  }
  tentativas: TentativaDeAssinatura[]
  /** Limite de tentativas atingido: o caso subiu para a advogada sênior (G15, CA11). */
  naSenior?: boolean
  /** A última falha ao gerar no ZapSign, com a opção de tentar de novo (CA9). */
  erro?: string
  /** Data e hora ISO em que o documento assinado voltou. */
  assinadoEm?: string
  /** O arquivo assinado, anexado no card: o do ZapSign ou a digitalização do papel. */
  arquivo?: string
  /** Papel na hora: quando o kit foi impresso (GGVP-77, CA1). */
  impressoEm?: string
}

export type ContratoDoCaso = { ficha: Ficha; processo: Processo; contrato: Contrato }

export const ROTULOS_DAS_CONDICOES: Record<keyof CondicoesDoKit, string> = {
  representado: 'representado por genitor(a)',
  moradia: 'comprovante de residência em nome de outra pessoa',
  uniaoEstavel: 'união estável',
  separacaoDeFato: 'separação de fato',
}

/** O RG e o representante que a ficha já tem desde o cadastro do lead (GGVP-43). Mãe e Pai do cadastro são genitora e genitor aqui. */
export function dadosDaFicha(ficha: Ficha): DadosDoContrato {
  const r = ficha.representante
  const parentesco = r?.parentesco === 'Mãe' ? 'genitora' : r?.parentesco === 'Pai' ? 'genitor' : undefined
  const dados = { rg: ficha.rg, representanteNome: r?.nome, representanteCpf: r?.cpf, representanteRg: r?.rg, representanteParentesco: parentesco }
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v)) as DadosDoContrato
}

/** Os campos do modelo para o caso, com o valor e de onde veio (CA1, CA5). O que o contrato guardou vale mais que a ficha. */
export function camposDoCaso({ ficha, processo, contrato }: ContratoDoCaso): CampoPreenchido[] {
  return camposDoModelo({
    ficha,
    beneficio: processo.beneficio,
    nomeDoBeneficio: nomeBeneficio(processo.beneficio),
    condicoes: contrato.condicoes,
    dados: { ...dadosDaFicha(ficha), ...contrato.dados },
    corrigidos: contrato.corrigidos ?? [],
  })
}

/**
 * EXEMPLO. Os modelos convertidos, simulados: um texto curto por documento, com os campos {{...}}. Os de verdade estão na
 * pasta "MODELOS ZAPSIGN · PREV" e no ZapSign (CA10); entram ao ligar no servidor.
 */
export const TEXTOS_DOS_MODELOS: Record<DocumentoDoKit, string> = {
  contrato:
    'CONTRATO DE HONORÁRIOS. {{nome}}, {{estadoCivil}}, {{profissao}}, CPF {{cpf}}, RG {{rg}}, residente em {{endereco}}, telefone ' +
    '{{telefone}}, contrata o escritório para o pedido de {{beneficio}}. Honorários: {{honorarios}}.',
  procuracao: 'PROCURAÇÃO. {{nome}}, CPF {{cpf}}, RG {{rg}}, nomeia os advogados do escritório para o pedido de {{beneficio}}.',
  hipossuficiencia: 'DECLARAÇÃO DE HIPOSSUFICIÊNCIA. {{nome}}, CPF {{cpf}}, declara que não pode pagar as custas sem prejuízo do sustento.',
  residencia: 'DECLARAÇÃO DE RESIDÊNCIA. {{nome}}, CPF {{cpf}}, declara residir em {{endereco}}.',
  'termo-inss': 'TERMO DE REPRESENTAÇÃO NO INSS. {{nome}}, CPF {{cpf}}, autoriza o escritório no pedido de {{beneficio}}.',
  'codigo-penal': 'CÓDIGO PENAL. {{nome}}, CPF {{cpf}}, declara saber que declaração falsa é crime. Esta página vai sem assinatura.',
  'grupo-familiar': 'FICHA DE GRUPO FAMILIAR. {{nome}}, CPF {{cpf}}, residente em {{endereco}}.',
  'declaracao-moradia': 'DECLARAÇÃO DE MORADIA. {{nome}}, CPF {{cpf}}, declara morar em {{endereco}}.',
  'declaracao-uniao-estavel': 'DECLARAÇÃO DE UNIÃO ESTÁVEL. {{nome}}, CPF {{cpf}}, declara viver em união estável.',
  'declaracao-separacao': 'DECLARAÇÃO DE SEPARAÇÃO DE FATO. {{nome}}, CPF {{cpf}}, declara estar separado(a) de fato.',
}

/** EXEMPLO. O cliente de exemplo que os Contratos Completos traziam antes de convertidos: não pode sobrar no texto (CA8). */
export const CLIENTE_DO_EXEMPLO_DOS_MODELOS = ['Fulana Exemplo do Modelo']

export function textosDoKit(kit: KitMontado, campos: CampoPreenchido[]): { documento: string; texto: string }[] {
  const valores: Record<string, string> = Object.fromEntries(campos.map((c) => [c.campo, c.valor]))
  valores.honorarios = HONORARIOS_DO_MODELO
  const temParte = campos.some((c) => c.campo === 'parteContraria')
  const representado = campos.some((c) => c.campo === 'representanteNome')
  return kit.documentos.map((d) => {
    let modelo = TEXTOS_DOS_MODELOS[d.id]
    if (d.id === 'contrato' || d.id === 'procuracao') {
      if (temParte) modelo += ' Parte contrária: {{parteContraria}}.'
      if (representado) modelo += ' Representado por {{representanteParentesco}} {{representanteNome}}, CPF {{representanteCpf}}, RG {{representanteRg}}.'
    }
    return { documento: d.nome, texto: preencherModelo(modelo, valores) }
  })
}

export type EnvioDoContrato = {
  /** "Os documentos foram aprovados?" */
  aprovados: boolean
  /** Obrigatório com "Não, corrigir campos" (CA6). */
  oQueCorrigir?: string
  conferencias: Record<IdDaConferencia, boolean>
  /** Os campos corrigidos na tela, só com "Não, corrigir campos" (CA3). */
  correcoes: Partial<Record<CampoDoModelo, string>>
}

export type RespostaGerar =
  | { resultado: 'gerado'; contrato: Contrato }
  | { resultado: 'faltam'; campos: CampoDoModelo[] }
  | { resultado: 'cpf-de-outra-ficha'; nome: string }
  | { resultado: 'sobrou-do-exemplo'; restos: string[] }
  /** O kit não tem modelo do Word: a linha não tem, ou a Sênior ainda não subiu o arquivo (GGVP-136). `modelo` é o nome do que falta. */
  | { resultado: 'sem-modelo'; modelo?: string }

export const DA_FICHA = ['nome', 'estadoCivil', 'profissao', 'cpf', 'endereco', 'telefone'] as const
export type CampoDaFichaNoContrato = (typeof DA_FICHA)[number]
export const daFicha = (c: CampoDoModelo): c is CampoDaFichaNoContrato => (DA_FICHA as readonly string[]).includes(c)

export const juntar = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`)

/** EXEMPLO. O ZapSign simulado: o link é obviamente falso e não abre nada. */
export const linkDoZapSign = (documentoId: string) => `https://zapsign.exemplo/assinar/${documentoId}`

/** A visita marcada para entregar a cópia, ainda em aberto (GGVP-89, CA4). */
export function visitaDaCopia(ficha: Ficha, contrato: Contrato) {
  const visita = ficha.agendamentos.find((a) => a.id === contrato.copia?.visitaId)
  return visita && visita.estado !== 'realizado' && visita.estado !== 'remarcado' ? visita : undefined
}

/**
 * EXEMPLO. A leitura da IA simulada: o papel da primeira versão vem com a página da assinatura cortada (Figma 10:202); o resto
 * a IA reconhece. A leitura de verdade é da GGVP-81.
 */
export function leituraDeExemploDoContrato(contrato: Contrato): LeituraDoContrato {
  const assinatura = { reconhecida: true, texto: 'reconhecida (nome e CPF conferem)' }
  if (contrato.assinatura?.forma === 'papel' && (contrato.documento?.versao ?? 1) === 1) {
    return { reconhecido: true, assinatura, faltam: ['pág. 4 (rubrica)'], pendencias: ['a página da assinatura veio cortada'] }
  }
  return { reconhecido: true, assinatura, faltam: [], pendencias: [] }
}

/**
 * Os contratos da semente, só com processos que já existem em exemplo.ts: a Cleide fechou a Aposentadoria PCD e o contrato
 * está para preparar (Figma step_D1.16 `10:143`); a Nair recebeu o link do ZapSign há 9 dias e ainda não assinou.
 */
export function contratosDeExemplo(fichas: Ficha[], hoje: string): Contrato[] {
  const novo = (processoId: string, etapa: EtapaDoContrato, resto: Partial<Contrato> = {}): Contrato | null => {
    const ficha = fichas.find((f) => f.processos.some((p) => p.id === processoId))
    const processo = ficha?.processos.find((p) => p.id === processoId)
    if (!ficha || !processo) return null
    return { processoId, fichaId: ficha.id, etapa, condicoes: SEM_CONDICOES, kit: montarKit(processo.beneficio), abertoEm: `${hoje}T09:00:00.000Z`, ...resto }
  }
  const enviadoEm = somarDias(hoje, -9)
  return [
    novo('cleide-exemplo-1', 'preparar'),
    novo('nair-exemplo-1', 'assinatura', {
      assinatura: {
        forma: 'digital',
        zapsign: {
          documentoId: 'zapsign-exemplo-nair-exemplo-1',
          link: linkDoZapSign('zapsign-exemplo-nair-exemplo-1'),
          status: 'enviado',
          criadoEm: `${enviadoEm}T13:00:00.000Z`,
          eventos: [],
        },
        tentativas: [{ data: enviadoEm, quando: `${enviadoEm}T13:00:00.000Z`, canal: 'whatsapp', quem: 'Atendimento' }],
      },
    }),
    // A Cleide assinou a Aposentadoria Especial pelo ZapSign em 12/07 e vem buscar a cópia hoje (Figma step_D1.20 `2106:69`).
    novo('cleide-exemplo-2', 'copia', {
      assinatura: {
        forma: 'digital',
        zapsign: {
          documentoId: 'zapsign-exemplo-cleide-exemplo-2',
          link: linkDoZapSign('zapsign-exemplo-cleide-exemplo-2'),
          status: 'assinado',
          criadoEm: '2026-07-10T13:00:00.000Z',
          eventos: ['zapsign-exemplo-cleide-exemplo-2-assinado'],
        },
        tentativas: [{ data: '2026-07-10', quando: '2026-07-10T13:00:00.000Z', canal: 'whatsapp', quem: 'Atendimento' }],
        assinadoEm: '2026-07-12T15:00:00.000Z',
        arquivo: 'Contrato assinado - Cleide Exemplo - 2026-07-12 (ZapSign, com evidências).pdf',
      },
      leitura: {
        reconhecido: true,
        assinatura: { reconhecida: true, texto: 'reconhecida (nome e CPF conferem)' },
        faltam: [],
        pendencias: [],
        lidoEm: '2026-07-12T16:00:00.000Z',
      },
      copia: { visitaId: 'cleide-retirada' },
    }),
  ].filter((c): c is Contrato => c !== null)
}
