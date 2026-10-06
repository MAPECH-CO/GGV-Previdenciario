// O cálculo de tempo e pontos sobre o CNIS (GGVP-57): feito por pessoa; o portal só confere os campos, pela biblioteca
// campos, e nunca calcula pela IA (G19). Regra com teste.
import { dataParaIso, formatarDecimal, normalizarData, normalizarDecimal, normalizarInteiro } from '../campos.ts'
import type { Ficha, RegistroDoCalculo, TempoDeContribuicao } from '../dados/tipos.ts'
import { erroDataDoCompromisso } from './formularios.ts'

/**
 * Benefícios que exigem cálculo (o "Sim" de "O benefício exige cálculo?", lista que o cartão GGVP-57 cita). Os outros,
 * inclusive os cíveis, seguem sem cálculo (CA3).
 */
const COM_CALCULO = new Set([
  'aposentadoria-contribuicao',
  'aposentadoria-idade',
  'aposentadoria-especial',
  'aposentadoria-rural',
  'aposentadoria-pcd',
  'aposentadoria-pcd-idade',
  'ctc',
  'planejamento',
  'revisao-aposentadoria',
  'atualizacao-vinculos',
])

export const exigeCalculo = (beneficio: string | undefined) => COM_CALCULO.has(beneficio ?? '')

/** O passo "Calcular tempo e pontos" ainda falta antes do fechamento (CA1). */
export function calculoPendente(ficha: Ficha): boolean {
  return exigeCalculo(ficha.beneficioDefinido?.beneficio) && !ficha.calculos?.length
}

/** EXEMPLO. As regras que o advogado aplica (Emenda Constitucional 103/2019). Trocar pela lista do escritório. */
export const REGRAS_DE_APOSENTADORIA = [
  'Direito adquirido (antes de 13/11/2019)',
  'Transição por pontos (EC 103, art. 15)',
  'Transição por idade mínima (EC 103, art. 16)',
  'Transição com pedágio de 50% (EC 103, art. 17)',
  'Transição da aposentadoria por idade (EC 103, art. 18)',
  'Transição com pedágio de 100% (EC 103, art. 20)',
  'Regra permanente (EC 103, art. 19)',
  'Outra (escrever no histórico)',
]

export const LIMITES = { anos: 70, meses: 11, dias: 30, pontos: 200 }

/** O que a tela digita: tudo em texto, como veio. */
export type ValoresDoCalculo = {
  anos: string
  meses: string
  dias: string
  pontos: string
  regra: string
  podeAposentar: 'sim' | 'nao' | ''
  /** dd/mm/aaaa, só no "Ainda não". */
  dataPrevista: string
  conferi: boolean
}

export const MENSAGENS_DO_CALCULO = {
  anos: `Anos: só números, de 0 a ${LIMITES.anos}.`,
  meses: `Meses: só números, de 0 a ${LIMITES.meses}.`,
  dias: `Dias: só números, de 0 a ${LIMITES.dias}.`,
  pontos: `Pontos: de 0 a ${LIMITES.pontos}, com vírgula (ex.: 92,5).`,
  regra: 'Escolha a regra aplicada.',
}

const inteiroAte = (valor: string, maximo: number) => {
  const n = normalizarInteiro(valor)
  return n !== null && n >= 0 && n <= maximo ? n : null
}

const pontosValidos = (valor: string) => {
  const n = normalizarDecimal(valor)
  return n !== null && n >= 0 && n <= LIMITES.pontos ? n : null
}

/** Os erros dos campos do cálculo; vazio passa como erro também: todos são obrigatórios. */
export function errosDoCalculo(v: ValoresDoCalculo, hoje: string): Partial<Record<keyof ValoresDoCalculo, string>> {
  const erros: Partial<Record<keyof ValoresDoCalculo, string>> = {}
  if (inteiroAte(v.anos, LIMITES.anos) === null) erros.anos = MENSAGENS_DO_CALCULO.anos
  if (inteiroAte(v.meses, LIMITES.meses) === null) erros.meses = MENSAGENS_DO_CALCULO.meses
  if (inteiroAte(v.dias, LIMITES.dias) === null) erros.dias = MENSAGENS_DO_CALCULO.dias
  if (pontosValidos(v.pontos) === null) erros.pontos = MENSAGENS_DO_CALCULO.pontos
  if (!REGRAS_DE_APOSENTADORIA.includes(v.regra)) erros.regra = MENSAGENS_DO_CALCULO.regra
  if (v.podeAposentar === 'nao') {
    const erro = erroDataDoCompromisso(v.dataPrevista, hoje)
    if (erro) erros.dataPrevista = erro
  }
  return erros
}

/** Por que "Concluir" ainda não habilita (CA5); nulo quando habilita. */
export function motivoParaConcluir(v: ValoresDoCalculo, hoje: string): string | null {
  const erros = errosDoCalculo(v, hoje)
  if (erros.anos || erros.meses || erros.dias) return 'Preencha o tempo de contribuição.'
  if (erros.pontos) return 'Preencha os pontos.'
  if (erros.regra) return 'Escolha a regra aplicada.'
  if (!v.podeAposentar) return 'Responda «Já pode se aposentar?».'
  if (erros.dataPrevista) return 'Escreva a data prevista em que poderá se aposentar.'
  if (!v.conferi) return 'Marque «Conferi o cálculo com o CNIS».'
  return null
}

/** O registro que vai ao servidor; nulo enquanto falta algo. */
export function paraRegistro(v: ValoresDoCalculo, hoje: string): RegistroDoCalculo | null {
  if (motivoParaConcluir(v, hoje)) return null
  const comum = {
    tempo: { anos: inteiroAte(v.anos, LIMITES.anos)!, meses: inteiroAte(v.meses, LIMITES.meses)!, dias: inteiroAte(v.dias, LIMITES.dias)! },
    pontos: pontosValidos(v.pontos)!,
    regra: v.regra,
    conferi: true as const,
  }
  return v.podeAposentar === 'sim' ? { ...comum, podeAposentar: true } : { ...comum, podeAposentar: false, dataPrevista: v.dataPrevista }
}

/** O servidor confere de novo, com as mesmas regras da tela. */
export function registroValido(r: RegistroDoCalculo, hoje: string): boolean {
  const v: ValoresDoCalculo = {
    anos: String(r.tempo.anos),
    meses: String(r.tempo.meses),
    dias: String(r.tempo.dias),
    pontos: formatarDecimal(r.pontos, 1),
    regra: r.regra,
    podeAposentar: r.podeAposentar ? 'sim' : 'nao',
    dataPrevista: r.podeAposentar ? '' : r.dataPrevista,
    conferi: r.conferi === true,
  }
  return motivoParaConcluir(v, hoje) === null
}

export const dataPrevistaIso = (dataPrevista: string) => dataParaIso(normalizarData(dataPrevista))

/** {18, 4, 0} → "18 anos e 4 meses". */
export function tempoFalado(t: TempoDeContribuicao): string {
  const partes = [
    t.anos && `${t.anos} ${t.anos === 1 ? 'ano' : 'anos'}`,
    t.meses && `${t.meses} ${t.meses === 1 ? 'mês' : 'meses'}`,
    t.dias && `${t.dias} ${t.dias === 1 ? 'dia' : 'dias'}`,
  ].filter((p): p is string => Boolean(p))
  if (partes.length === 0) return '0 dia'
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`
}

export const pontosFalados = (pontos: number) => formatarDecimal(pontos, 1)
