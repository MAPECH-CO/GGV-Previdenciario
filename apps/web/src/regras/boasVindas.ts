// As boas-vindas ao cliente novo (GGVP-97): quem recebe e a mensagem. O modelo aprovado é da GGVP-102; até lá, este.
import type { Ficha } from '../dados/tipos.ts'
import { juntar } from './checklist.ts'

/**
 * Já era cliente do escritório: tem outro processo, inclusive o processo novo de quem já é cliente (GGVP-124, CA3).
 * ponytail: o processo ainda não tem data de abertura; ao ligar no servidor, compara a data do primeiro processo.
 */
export function jaEraCliente(ficha: Pick<Ficha, 'processos'>, processoId: string): boolean {
  return ficha.processos.some((p) => p.id !== processoId)
}

/** "a" e "b" com o artigo: "do contrato e da procuração". */
const COM_ARTIGO: Record<string, string> = { contrato: 'do contrato', procuração: 'da procuração' }

/** A mensagem de boas-vindas pelo modelo de exemplo, com as cópias e as pendências do checklist (CA1, CA5). */
export function mensagemDeBoasVindas(d: { nome: string; beneficio: string; copias: string[]; faltam: string[] }): string {
  const primeiro = d.nome.split(' ')[0]
  const copias = d.copias.length > 0 ? ` Junto com esta mensagem vão as cópias ${juntar(d.copias.map((c) => COM_ARTIGO[c] ?? `de ${c}`))} que você assinou.` : ''
  const faltam =
    d.faltam.length > 0
      ? ` Para o seu caso andar, ainda precisamos destes documentos: ${juntar(d.faltam)}. Pode mandar foto por aqui ou trazer ao escritório.`
      : ' Todos os documentos de que precisamos já chegaram.'
  return `Olá, ${primeiro}! Boas-vindas ao escritório GGV. Seu caso de ${d.beneficio} está aberto e a nossa equipe cuida dele daqui em diante.${copias}${faltam} Qualquer dúvida, é só responder esta mensagem.`
}

/** Cada registro das boas-vindas: a que saiu e, no exemplo, a que falhou (CA6). */
export type RegistroDasBoasVindas = {
  fichaId: string
  processoId: string
  /** Data e hora ISO. */
  quando: string
  situacao: 'enviada' | 'falhou'
  mensagem: string
  motivo?: string
}

export type BoasVindas = {
  /** 'ja-era-cliente': não vai (CA3); 'aguardando-checklist': sai depois da conferência do checklist (CA1). */
  situacao: 'ja-era-cliente' | 'aguardando-checklist' | 'a-enviar' | 'enviada' | 'falhou'
  /** A mensagem pelo modelo, para conferir (CA4, CA5); enviada, a que saiu. */
  mensagem: string
  copias: string[]
  faltam: string[]
  /** A última tentativa deste caso. */
  registro?: RegistroDasBoasVindas
}

/** As boas-vindas do caso: uma única vez por cliente novo, depois do checklist conferido (CA1, CA3, CA4, CA6). */
export function boasVindasDoCaso(e: {
  ficha: Pick<Ficha, 'nome' | 'processos'>
  processoId: string
  beneficio: string
  copias: string[]
  faltam: string[]
  conferido: boolean
  /** Os registros da pessoa, de todos os processos dela. */
  registros: RegistroDasBoasVindas[]
}): BoasVindas {
  const registro = e.registros.filter((r) => r.processoId === e.processoId).at(-1)
  const enviada = e.registros.find((r) => r.situacao === 'enviada')
  const base = { copias: e.copias, faltam: e.faltam, registro }
  if (enviada?.processoId === e.processoId) return { ...base, situacao: 'enviada', mensagem: enviada.mensagem, registro: enviada }
  // Uma única vez por cliente: quem já recebeu, ou já tinha outro processo, já era cliente (CA3, CA4).
  if (enviada || jaEraCliente(e.ficha, e.processoId)) return { ...base, situacao: 'ja-era-cliente', mensagem: '' }
  const mensagem = mensagemDeBoasVindas({ nome: e.ficha.nome, beneficio: e.beneficio, copias: e.copias, faltam: e.faltam })
  if (registro?.situacao === 'falhou') return { ...base, situacao: 'falhou', mensagem }
  return { ...base, situacao: e.conferido ? 'a-enviar' : 'aguardando-checklist', mensagem }
}
