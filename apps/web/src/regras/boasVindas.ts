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
