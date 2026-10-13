// A leitura dos documentos pela IA (GGVP-81): confiança, dono do documento, divergência com o cadastro e a trava de
// "Arquivar". Regra numérica é código com teste, nunca resposta de modelo.
import { formatarCpf, normalizarCpf } from '../campos.ts'
import type { Arquivo, Ficha } from '../dados/tipos.ts'
import { semAcento } from './busca.ts'
import { umaLetraDeDiferenca } from './pasta.ts'

/** Abaixo disto (em %), a leitura aparece marcada para a pessoa conferir com atenção (CA7). Levar ao Lucas. */
export const CONFIANCA_MINIMA = 80

/** Documentos médicos: a Documentação confirma que estão ok sem ver o conteúdo, e nunca são apagados (CA16). Os sete do fim são da GGVP-95. */
export const TIPOS_MEDICOS = ['laudo', 'receita', 'prontuario', 'atestado', 'relatorio-medico', 'exame', 'cat', 'boletim-ocorrencia', 'relatorio-escolar', 'relatorio-terapia', 'aso', 'ficha-pronto-socorro', 'exame-imagem-epoca', 'exame-pos-alta', 'exame-evolucao', 'relatorio-caps', 'relatorio-neurologia', 'relatorio-fono', 'relatorio-to', 'relatorio-psicologia']

export type CampoLido = 'nome' | 'cpf' | 'rg' | 'endereco'

/** O que a IA extraiu do documento (CA3). */
export type DadosLidos = Partial<Record<CampoLido, string>>

export const ROTULOS_DOS_CAMPOS: Record<CampoLido, string> = { nome: 'Nome', cpf: 'CPF', rg: 'RG', endereco: 'Endereço' }

export const baixaConfianca = (confianca: number) => confianca < CONFIANCA_MINIMA

export const ehMedico = (tipo: string) => TIPOS_MEDICOS.includes(tipo)

const palavras = (nome: string) => semAcento(nome).split(' ').filter(Boolean)

/**
 * O nome lido é da mesma pessoa do cadastro: igual sem acento, com uma letra de diferença (o OCR erra) ou com mais
 * palavras que contêm todas as do outro ("Rita de Cássia Exemplo" e "Rita Exemplo").
 */
export function mesmaPessoa(lido: string, cadastro: string): boolean {
  const a = palavras(lido)
  const b = palavras(cadastro)
  if (a.length === 0 || b.length === 0) return false
  if (umaLetraDeDiferenca(a.join(' '), b.join(' '))) return true
  const [menor, maior] = a.length <= b.length ? [a, b] : [b, a]
  return menor.every((p) => maior.includes(p))
}

/** Por que o documento não parece do cliente do caso; sendo dele, undefined (CA10). */
export function motivoDaQuarentena(lidos: DadosLidos, cliente: Pick<Ficha, 'nome' | 'cpf'>): string | undefined {
  const cpf = normalizarCpf(lidos.cpf)
  if (cpf && cliente.cpf && cpf !== cliente.cpf) return `o CPF lido (${formatarCpf(cpf)}) não é o do cliente`
  if (lidos.nome && !mesmaPessoa(lidos.nome, cliente.nome)) return `o nome lido é ${lidos.nome}, não ${cliente.nome}`
  return undefined
}

export type Comparacao = {
  campo: CampoLido
  lido: string
  cadastro: string
  /** 'novo': o cadastro não tem; 'diverge': tem outro valor (CA8). */
  situacao: 'igual' | 'novo' | 'diverge'
}

const comparavel: Record<CampoLido, (v: string) => string> = {
  nome: (v) => palavras(v).join(' '),
  cpf: (v) => normalizarCpf(v),
  rg: (v) => v.replace(/[^0-9a-z]/gi, '').toLowerCase(),
  endereco: (v) => semAcento(v).replace(/[^a-z0-9]+/g, ' ').trim(),
}

/** Cada dado lido ao lado do cadastro (CA3), com a divergência marcada (CA8). */
export function compararComCadastro(lidos: DadosLidos, ficha: Pick<Ficha, CampoLido>): Comparacao[] {
  return (Object.keys(ROTULOS_DOS_CAMPOS) as CampoLido[]).flatMap((campo) => {
    const lido = lidos[campo]
    if (!lido) return []
    const cadastro = ficha[campo] ?? ''
    const situacao = !cadastro ? 'novo' : comparavel[campo](lido) === comparavel[campo](cadastro) ? 'igual' : 'diverge'
    return [{ campo, lido, cadastro, situacao }]
  })
}

/** CPF como a tela mostra; os outros campos como vieram. */
export const valorLegivel = (campo: CampoLido, valor: string) => (campo === 'cpf' && valor ? formatarCpf(valor) : valor)

/** Da dupla de duplicados, a cópia que sai: a de confiança menor; empatou, a que chegou depois (a cópia) (CA9). */
export function menosLegivel<T extends { confianca: number }>(original: T, copia: T): T {
  return copia.confianca <= original.confianca ? copia : original
}

/** Por que "Arquivar" ainda não habilita; pronto, null (CA7, CA9). */
export function motivoParaNaoArquivar(situacao: { aConferir: number; duplicados: number; decisao?: 'manter' | 'descartar'; conferi: boolean; datasValidas: boolean }): string | null {
  if (situacao.aConferir === 0) return 'Nenhum documento para arquivar.'
  if (!situacao.datasValidas) return 'Corrija a data do documento (dd/mm/aaaa).'
  if (situacao.duplicados > 0 && !situacao.decisao) return 'Decida o que fazer com o documento duplicado.'
  if (!situacao.conferi) return 'Marque "Conferi os documentos lidos pela IA".'
  return null
}

/** Um dia, em milissegundos: a quarentena mais velha que isso entra no relatório (CA12). */
export const UM_DIA = 24 * 60 * 60 * 1000

/** Em quarentena há mais de um dia (CA12). `lidoEm` é data e hora ISO. */
export function quarentenaAntiga<T extends { situacao: string; lidoEm: string }>(documentos: T[], agora: Date): T[] {
  return documentos.filter((d) => d.situacao === 'quarentena' && agora.getTime() - new Date(d.lidoEm).getTime() > UM_DIA)
}

// A leitura de cada documento (GGVP-81), a mesma nas telas e no servidor (GGVP-125, bloco 5b).

/** 'ilegivel': a leitura falhou; o original fica guardado e o Atendimento pede de novo (GGVP-95, CA3). */
export type SituacaoDoLido = 'a-conferir' | 'quarentena' | 'arquivado' | 'descartado' | 'movido' | 'ilegivel'

/** Um documento que a IA leu. O arquivo original fica guardado na pasta: o OCR não o substitui (CA13). */
export type DocumentoLido = {
  /** `${fichaId}/${arquivo}`: uma leitura por arquivo, então ler de novo não duplica (CA13). */
  id: string
  fichaId: string
  /** O nome do arquivo na pasta do cliente. */
  arquivo: string
  origem: Arquivo['origem']
  /** Tipo sugerido pela IA; depois de arquivar, o que a pessoa confirmou (CA7). */
  tipo: string
  /** aaaa-mm-dd: a data do documento. */
  data: string
  /** De 0 a 100 (CA7). */
  confianca: number
  lidos: DadosLidos
  /** O id do documento que este parece repetir (CA9). */
  duplicadoDe?: string
  /** Por que não parece do cliente (CA10). */
  quarentena?: string
  situacao: SituacaoDoLido
  /** Data e hora ISO em que a leitura terminou: conta a idade da quarentena (CA12). */
  lidoEm: string
  /** A IA não achou a assinatura do cliente, ou achou a data em branco: o item do checklist fica pendente (GGVP-91, G1). */
  semAssinatura?: boolean
  dataEmBranco?: boolean
  /** Data e hora ISO do "Arquivar": o checklist é conferido de novo depois disso (GGVP-91). */
  arquivadoEm?: string
  /** Documento médico: quem emitiu e o registro profissional (CRM, CRP...), se constarem (GGVP-95, CA1). Nunca o conteúdo. */
  emitente?: string
  registro?: string
  /** O tipo que a IA sugeriu, guardado quando a Documentação corrige (GGVP-95, CA2). */
  sugerido?: string
}

/** Quem emite cada documento médico, na leitura simulada: nomes de exemplo, registro zerado (GGVP-95, CA1). */
const EMITENTES: Record<string, { emitente: string; registro?: string }> = {
  laudo: { emitente: 'Dr. Exemplo Silva', registro: 'CRM-SP 000000' },
  'relatorio-medico': { emitente: 'Dr. Exemplo Silva', registro: 'CRM-SP 000000' },
  atestado: { emitente: 'Dr. Exemplo Silva', registro: 'CRM-SP 000000' },
  receita: { emitente: 'Dr. Exemplo Silva', registro: 'CRM-SP 000000' },
  prontuario: { emitente: 'Hospital Exemplo' },
  exame: { emitente: 'Laboratório Exemplo' },
  cat: { emitente: 'Empresa Exemplo Ltda' },
  'boletim-ocorrencia': { emitente: 'Delegacia Exemplo' },
  'relatorio-escolar': { emitente: 'Escola Exemplo' },
  'relatorio-terapia': { emitente: 'Clínica Exemplo de Terapias', registro: 'CREFITO-3 000000' },
}

/**
 * EXEMPLO. A leitura simulada da IA: o tipo e a data que vieram, o nome do cliente, o CPF do CNIS e o endereço do
 * comprovante. As telas e o servidor usam a mesma (GGVP-125, bloco 5b).
 */
export function lerComIADeExemplo(ficha: Ficha, arquivo: Arquivo, leituras: DocumentoLido[], lidoEm: string): DocumentoLido {
  const lidos: DadosLidos = {}
  if (['rg', 'cpf', 'cnis', 'comprovante-residencia', 'ctps', 'certidao'].includes(arquivo.tipo)) lidos.nome = ficha.nome
  if (['cpf', 'cnis'].includes(arquivo.tipo) && ficha.cpf) lidos.cpf = ficha.cpf
  if (arquivo.tipo === 'comprovante-residencia') lidos.endereco = ficha.endereco ?? 'Rua Exemplo, 100 · São Paulo/SP'
  // O mesmo conteúdo (SHA-256) já estava na pasta: a IA aponta o duplicado (CA9).
  const original = arquivo.repetido
    ? ficha.arquivos.find((a) => a !== arquivo && a.hash !== undefined && a.hash === arquivo.hash)
    : undefined
  const quarentena = motivoDaQuarentena(lidos, ficha)
  // ponytail: a falta de assinatura e a data em branco vêm do nome do arquivo, como o tipo na GGVP-17; a IA de verdade lê o papel.
  const nome = semAcento(arquivo.nome)
  // A leitura que falhou (GGVP-95, CA3): pela mesma pista no nome do arquivo.
  const ilegivel = nome.includes('ilegivel')
  return {
    id: `${ficha.id}/${arquivo.nome}`,
    fichaId: ficha.id,
    arquivo: arquivo.nome,
    origem: arquivo.origem,
    tipo: arquivo.tipo,
    data: arquivo.data,
    confianca: ilegivel ? 0 : 90,
    lidos,
    duplicadoDe: original && leituras.some((l) => l.id === `${ficha.id}/${original.nome}`) ? `${ficha.id}/${original.nome}` : undefined,
    quarentena,
    situacao: ilegivel ? 'ilegivel' : quarentena ? 'quarentena' : 'a-conferir',
    lidoEm,
    ...(nome.includes('sem assinatura') && { semAssinatura: true }),
    ...(nome.includes('sem data') && { dataEmBranco: true }),
    ...(ehMedico(arquivo.tipo) && !ilegivel && EMITENTES[arquivo.tipo]),
  }
}
