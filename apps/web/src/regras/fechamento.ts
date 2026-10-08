// O fechamento depois da entrevista e o recontato (GGVP-60). Prazo é código com teste, nunca resposta de modelo.
import type { EsperaDoRecontato, Ficha, PapelNoFechamento } from '../dados/tipos.ts'
import { somarDias } from './agenda.ts'
import { emAberto } from './busca.ts'
import { erroDataDoCompromisso } from './formularios.ts'
import { demandaAberta, entrevistaDaDemanda } from './novaDemanda.ts'

/** Ficou de pensar: recontatar 15 dias depois (Lucas, 05/10). */
export const DIAS_PARA_PENSAR = 15

/** Pediu para esperar: recontatar 30 dias depois (Lucas, 05/10: caiu de 60 para 30). */
export const DIAS_PARA_ESPERAR = 30

/** A data sugerida para o recontato (CA12). */
export const dataSugeridaDeRecontato = (hoje: string, espera: EsperaDoRecontato) =>
  somarDias(hoje, espera === 'pensar' ? DIAS_PARA_PENSAR : DIAS_PARA_ESPERAR)

/** "Recusado pelo escritório" só pelo Atendimento sênior ou pela advogada do atendimento (CA11). */
export const podeRegistrarOMotivo = (motivo: string, papel: PapelNoFechamento) => motivo !== 'recusado' || papel !== 'atendimento'

export const TAMANHO_DO_DETALHE = 500

export type EstadoDoFechamento = {
  fechou: boolean | null
  /** Só no "Não fechou". */
  motivo: string
  detalhe: string
  papel: PapelNoFechamento
  recontatar: boolean | null
  /** dd/mm/aaaa */
  data: string
  /** O benefício que a advogada definiu; sem ele, "Sim, fechou" não segue para o kit. */
  beneficio: string | undefined
  /** O benefício exige o cálculo de tempo e pontos e ele ainda não foi feito (GGVP-57, CA1): "Sim, fechou" espera. */
  calculoPendente?: boolean
}

/**
 * O benefício que fecha. No lead, o que a advogada definiu (GGVP-51) ou, sem ele, o de interesse da ficha. Na nova demanda
 * do cliente, o da demanda, que a abertura grava como benefício de interesse (GGVP-124).
 */
export const beneficioDoFechamento = (ficha: Pick<Ficha, 'demandas' | 'beneficioDefinido' | 'beneficioInteresse'>) =>
  (!ficha.demandas?.length && ficha.beneficioDefinido?.beneficio) || ficha.beneficioInteresse

/** Por que "Registrar" ainda não habilita; nulo quando habilita (CA1, CA5, CA6, CA11, CA12). */
export function motivoParadoDoFechamento(e: EstadoDoFechamento, hoje: string): string | null {
  if (e.fechou === null) return 'Responda se fechou com o escritório.'
  if (e.fechou) {
    if (!e.beneficio || e.beneficio === 'nao-sei') return 'Falta o benefício definido pela advogada (D1.12).'
    return e.calculoPendente ? 'Falta calcular o tempo e os pontos (D1.13): obrigatório antes de fechar.' : null
  }
  if (!e.motivo) return 'Escolha o motivo: sem ele o lead não pode ser encerrado (G16).'
  if (!podeRegistrarOMotivo(e.motivo, e.papel)) return 'A recusa do escritório é registrada pelo Atendimento sênior ou pela advogada do atendimento.'
  if (e.detalhe.length > TAMANHO_DO_DETALHE) return `Detalhe até ${TAMANHO_DO_DETALHE} caracteres.`
  if (e.recontatar === null) return 'Responda se vale recontatar numa data prevista.'
  if (e.recontatar && erroDataDoCompromisso(e.data, hoje)) return 'Escolha a data do recontato, de hoje em diante.'
  return null
}

/** A entrevista mais recente que aconteceu. */
export function entrevistaRealizada(ficha: Pick<Ficha, 'agendamentos'>) {
  return ficha.agendamentos.filter((a) => a.oQue === 'Entrevista' && a.estado === 'realizado').sort((a, b) => b.data.localeCompare(a.data))[0]
}

/**
 * O lead entrevistado que ainda não teve o "Fechou com o escritório?" registrado, ou que voltou do recontato ao cálculo
 * (CA5, CA10). Arquivado ou à espera do recontato, não. O cliente, com a nova demanda aberta e a entrevista dela feita
 * (GGVP-124, CA3).
 */
export function precisaRegistrarFechamento(ficha: Pick<Ficha, 'situacao' | 'agendamentos' | 'fechamento' | 'demandas'>): boolean {
  if (ficha.situacao === 'cliente') {
    const demanda = demandaAberta(ficha)
    return demanda !== undefined && entrevistaDaDemanda(ficha, demanda)?.estado === 'realizado'
  }
  if (!entrevistaRealizada(ficha)) return false
  return !ficha.fechamento || ficha.fechamento.situacao === 'recalcular'
}

/** O recontato do dia ou atrasado: a tarefa aparece na data e continua aberta depois dela (CA8, CA9). */
export function recontatoDevido(ficha: Pick<Ficha, 'fechamento'>, hoje: string): { devido: boolean; atrasado: boolean } {
  const em = ficha.fechamento?.situacao === 'recontatar' ? ficha.fechamento.recontatarEm : undefined
  return { devido: em !== undefined && hoje >= em, atrasado: em !== undefined && hoje > em }
}

/** A mensagem embaixo da data do recontato, pela biblioteca campos: de hoje em diante. Vazio, a trava do botão avisa. */
export const erroDoRecontato = (data: string, hoje: string) => (data.trim() === '' ? undefined : erroDataDoCompromisso(data, hoje))

/** O lead arquivado sai das filas ativas e continua pesquisável (CA7). */
export const arquivado = (ficha: Pick<Ficha, 'fechamento'>) => ficha.fechamento?.situacao === 'arquivado'

/** O compromisso "Recontatar lead" ainda em aberto. */
export const recontatoEmAberto = (ficha: Pick<Ficha, 'agendamentos' | 'fechamento'>) =>
  ficha.agendamentos.find((a) => a.id === ficha.fechamento?.recontatoId && emAberto(a))
