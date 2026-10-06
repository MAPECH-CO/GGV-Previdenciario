// A leitura dos documentos pela IA (GGVP-81): confiança, dono do documento, divergência com o cadastro e a trava de
// "Arquivar". Regra numérica é código com teste, nunca resposta de modelo.
import { formatarCpf, normalizarCpf } from '../campos.ts'
import type { Ficha } from '../dados/tipos.ts'
import { semAcento } from './busca.ts'
import { umaLetraDeDiferenca } from './pasta.ts'

/** Abaixo disto (em %), a leitura aparece marcada para a pessoa conferir com atenção (CA7). Levar ao Lucas. */
export const CONFIANCA_MINIMA = 80

/** Documentos médicos: a Documentação confirma que estão ok sem ver o conteúdo, e nunca são apagados (CA16). Os sete do fim são da GGVP-95. */
export const TIPOS_MEDICOS = ['laudo', 'receita', 'prontuario', 'atestado', 'relatorio-medico', 'exame', 'cat', 'boletim-ocorrencia', 'relatorio-escolar', 'relatorio-terapia', 'aso']

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
