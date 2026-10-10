// A cobrança dos documentos pendentes (GGVP-101, G15). Regra numérica é código com teste, nunca resposta de modelo.
import type { Ficha, Processo } from '../dados/tipos.ts'
import { somarDias } from './agenda.ts'
import { juntar } from './checklist.ts'
import { dataCurta } from './datas.ts'

/** Tentativas antes de a cobrança passar para a advogada sênior (Lucas, 05/10, pergunta 6 do GGVP-122). */
export const TENTATIVAS_DE_COBRANCA = 2

/** Dias entre uma tentativa e a próxima (Lucas, 05/10). */
export const DIAS_ENTRE_COBRANCAS = 3

export type CanalDaCobranca = 'chatwoot' | 'ligacao'

export const CANAIS: Record<CanalDaCobranca, string> = { chatwoot: 'Chatwoot', ligacao: 'Ligação' }

export type TentativaDeCobranca = {
  /** aaaa-mm-dd */
  dia: string
  canal: CanalDaCobranca
  /** 'sem-resposta' é tentativa que falhou (CA3). */
  resultado: 'sem-resposta' | 'respondeu'
  quem: string
}

export const RESULTADOS: Record<TentativaDeCobranca['resultado'], string> = { 'sem-resposta': 'sem resposta', respondeu: 'respondeu: vai mandar' }

/** O prazo do juiz ou do INSS no caso (CA12). */
export type PrazoExterno = { de: 'juiz' | 'INSS'; /** aaaa-mm-dd */ data: string }

export type OpcaoDaSenior = 'nova-tentativa' | 'visita' | 'suspender'

export const OPCOES_DA_SENIOR: Record<OpcaoDaSenior, string> = {
  'nova-tentativa': 'Nova tentativa com prazo',
  visita: 'Pedir visita ao escritório',
  suspender: 'Suspender o caso',
}

export type DecisaoDaSenior = {
  opcao: OpcaoDaSenior
  justificativa: string
  /** aaaa-mm-dd: o novo prazo da nova tentativa. */
  prazo?: string
  /** Data e hora ISO. */
  quando: string
  quem: string
}

export type EstadoDaCobranca = {
  /** aaaa-mm-dd: o dia em que o checklist abriu a cobrança. */
  abertaEm: string
  tentativas: TentativaDeCobranca[]
  /** aaaa-mm-dd: a nova data do "Adiar" ou do novo prazo da sênior. */
  adiadaPara?: string
  prazo?: PrazoExterno
  decisoes: DecisaoDaSenior[]
}

/** A cobrança de um caso: a conferência incompleta do checklist abre (CA1); chegou tudo ou a sênior suspendeu, fecha. */
export type Cobranca = EstadoDaCobranca & {
  processoId: string
  fichaId: string
  /** Data e hora ISO da conferência do checklist que abriu a cobrança (CA1). */
  conferenciaEm?: string
  /** Fechada: chegou tudo (CA9) ou a sênior suspendeu o caso (CA8). */
  encerrada?: { quando: string; porque: 'recebeu-tudo' | 'suspensa' }
}

const menor = (a: string, b: string) => (a < b ? a : b)
const maior = (a: string, b: string) => (a > b ? a : b)

/** Quantas tentativas o Atendimento tem: 2, e mais uma a cada nova tentativa ou visita que a sênior decide. */
export const limiteDeTentativas = (c: EstadoDaCobranca) => TENTATIVAS_DE_COBRANCA + c.decisoes.filter((d) => d.opcao !== 'suspender').length

/**
 * O dia da próxima tentativa (CA3, CA4, CA12): a primeira no dia em que a cobrança abriu, as outras 3 dias depois da
 * última, ou na data adiada. Com prazo externo, no máximo no dia antes do prazo, e nunca antes da última tentativa.
 */
export function proximaTentativa(c: EstadoDaCobranca): string {
  const ultima = c.tentativas.at(-1)?.dia
  let dia = ultima ? somarDias(ultima, DIAS_ENTRE_COBRANCAS) : c.abertaEm
  // A data adiada vale para a próxima tentativa, não para as depois dela.
  if (c.adiadaPara && (!ultima || c.adiadaPara > ultima)) dia = c.adiadaPara
  if (c.prazo) dia = maior(menor(dia, somarDias(c.prazo.data, -1)), ultima ?? c.abertaEm)
  return dia
}

/** Passou para a sênior (CA3, CA7): no limite, com a última sem resposta, ou com o lembrete vencido sem o documento. */
export function naSenior(c: EstadoDaCobranca, hoje: string): boolean {
  const limite = limiteDeTentativas(c)
  if (c.tentativas.length < limite) return false
  const ultima = c.tentativas.at(-1)!
  return ultima.resultado === 'sem-resposta' || hoje >= proximaTentativa(c)
}

/** O lembrete chegou (CA5); com prazo externo, é sempre urgente (CA12). */
export const urgente = (c: EstadoDaCobranca, hoje: string) => c.prazo !== undefined || proximaTentativa(c) <= hoje

/** Por que o Atendimento ainda não pode cobrar de novo; pode, null (CA3, CA5). */
export function motivoParaNaoCobrar(c: EstadoDaCobranca, hoje: string): string | null {
  if (naSenior(c, hoje)) return `Passou do limite de ${TENTATIVAS_DE_COBRANCA} tentativas: a sênior decide (G15).`
  const proxima = proximaTentativa(c)
  if (proxima > hoje) return `A próxima tentativa é em ${dataCurta(proxima, hoje)}, ${DIAS_ENTRE_COBRANCAS} dias depois da última.`
  return null
}

/** "Adiar" (CA10): a nova data é obrigatória, depois de hoje e sem passar do prazo externo. */
export function motivoParaNaoAdiar(novaData: string | null, hoje: string, prazo?: PrazoExterno): string | null {
  if (!novaData) return 'Informe a nova data (dd/mm/aaaa).'
  if (novaData <= hoje) return 'A nova data tem de ser depois de hoje.'
  if (prazo && novaData >= prazo.data) return `O prazo do ${prazo.de} é ${dataCurta(prazo.data, hoje)}: a nova data tem de ser antes dele.`
  return null
}

/** "Registrar decisão" (CA8): opção, justificativa e, na nova tentativa, o novo prazo depois de hoje. */
export function motivoParaNaoDecidir(d: { opcao?: OpcaoDaSenior; justificativa: string; prazo: string | null }, hoje: string): string | null {
  if (!d.opcao) return 'Escolha a decisão.'
  if (d.opcao === 'nova-tentativa' && (!d.prazo || d.prazo <= hoje)) return 'Informe o novo prazo, depois de hoje (dd/mm/aaaa).'
  if (d.justificativa.trim().length < 5) return 'A justificativa é obrigatória.'
  return null
}

/** Até quando o cliente manda: o próximo lembrete depois desta tentativa, ou antes do prazo externo (CA11, CA12). */
export function ateQuando(hoje: string, prazo?: PrazoExterno): string {
  const normal = somarDias(hoje, DIAS_ENTRE_COBRANCAS)
  return prazo ? maior(hoje, menor(normal, somarDias(prazo.data, -1))) : normal
}

/** A mensagem pronta da cobrança: o que falta e até quando, em linguagem simples (CA11). */
export function mensagemDeCobranca(d: { nome: string; beneficio: string; faltam: string[]; ate: string; hoje: string }): string {
  return (
    `Olá, ${d.nome.split(' ')[0]}! Aqui é do escritório GGV. Para o seu caso de ${d.beneficio} andar, ainda faltam: ${juntar(d.faltam)}. ` +
    `Pode mandar foto por aqui ou trazer ao escritório até ${dataCurta(d.ate, d.hoje)}. Qualquer dúvida, é só responder esta mensagem.`
  )
}

export type SituacaoDaCobranca = 'aberta' | 'na-senior' | 'encerrada'

export type CobrancaDoCaso = {
  cobranca: Cobranca
  situacao: SituacaoDaCobranca
  ficha: Ficha
  processo: Processo
  beneficio: string
  /** O que falta no checklist de agora (CA4, CA9). */
  faltam: string[]
  /** aaaa-mm-dd: o próximo lembrete (CA4). */
  proxima: string
  /** O número da próxima tentativa (CA6). */
  tentativa: number
  urgente: boolean
  /** A mensagem pronta para o Chatwoot (CA11). */
  mensagem: string
  /** Por que o Atendimento não pode cobrar agora; pode, null. */
  motivoParado: string | null
}

/** A cobrança como a tela mostra (CA4, CA6, CA11): o que falta é sempre o checklist de agora (CA9). */
export function cobrancaDoCaso(cobranca: Cobranca, caso: { ficha: Ficha; processo: Processo; beneficio: string; faltam: string[] }, hoje: string): CobrancaDoCaso {
  const situacao: SituacaoDaCobranca = cobranca.encerrada ? 'encerrada' : naSenior(cobranca, hoje) ? 'na-senior' : 'aberta'
  const { ficha, processo, beneficio, faltam } = caso
  return {
    cobranca,
    situacao,
    ficha,
    processo,
    beneficio,
    faltam,
    proxima: proximaTentativa(cobranca),
    tentativa: cobranca.tentativas.length + 1,
    urgente: situacao === 'aberta' && urgente(cobranca, hoje),
    mensagem: mensagemDeCobranca({ nome: ficha.nome, beneficio, faltam, ate: ateQuando(hoje, cobranca.prazo), hoje }),
    motivoParado: cobranca.encerrada ? 'A cobrança está fechada.' : motivoParaNaoCobrar(cobranca, hoje),
  }
}
