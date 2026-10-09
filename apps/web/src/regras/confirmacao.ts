// A confirmação da entrevista do lead (GGVP-21). Regra numérica é código com teste, nunca resposta de modelo.
import type { Agendamento, Confirmacao, Ficha, TipoDeEntrevista } from '../dados/tipos.ts'
import { COMO, diaFalado, horaFalada, somarDias } from './agenda.ts'
import { emAberto } from './busca.ts'

/** Quantas tentativas sem resposta antes de a tarefa passar para a advogada sênior (Lucas, 05/10). */
export const TENTATIVAS_DE_CONFIRMACAO = 2

/** Dias entre uma tentativa sem resposta e a próxima (Lucas, 05/10). */
export const DIAS_ENTRE_TENTATIVAS = 3

const LOAS = 'RG e CPF de todos da casa, comprovante de renda e CadÚnico; sem CadÚnico, vá ao CRAS antes'

/** O que levar, por benefício. Só o LOAS está escrito no cartão; os outros vêm com a GGVP-104. */
export const O_QUE_LEVAR: Record<string, string> = { 'loas-idoso': LOAS, 'loas-deficiente': LOAS }

/** O que o convite da entrevista já pede (Figma 73:459). */
export const O_QUE_LEVAR_PADRAO = 'RG, CPF e os laudos'

/** Os quatro documentos que mais travam os casos (CA8). */
export const DOCUMENTOS_QUE_TRAVAM = ['biometria', 'CadÚnico', 'senha do Meu INSS', 'comprovantes de gastos']

export const oQueLevar = (beneficio: string | undefined) => O_QUE_LEVAR[beneficio ?? ''] ?? O_QUE_LEVAR_PADRAO

export const confirmada = (c: Confirmacao | undefined) => c?.presente === true || (c?.tentativas.some((t) => t.resultado === 'confirmou') ?? false)

/** O número da tentativa de agora: 1 e, depois de uma sem resposta, 2 (CA6). */
export const tentativaAtual = (c: Confirmacao | undefined) => (c?.tentativas.length ?? 0) + 1

/** Entrevista de lead marcada de hoje em diante, ainda sem confirmação e fora da sênior (CA1). */
export function precisaConfirmar(ficha: Ficha, a: Agendamento, hoje: string): boolean {
  return (
    ficha.situacao === 'lead' &&
    a.oQue === 'Entrevista' &&
    emAberto(a) &&
    a.data >= hoje &&
    !confirmada(a.confirmacao) &&
    !a.confirmacao?.naSenior
  )
}

/** Depois de uma tentativa sem resposta: a próxima em 3 dias ou, na segunda, a advogada sênior (CA6). */
export function depoisDaTentativa(semResposta: number, hoje: string): { naSenior: true } | { naSenior: false; proximaEm: string } {
  return semResposta >= TENTATIVAS_DE_CONFIRMACAO
    ? { naSenior: true }
    : { naSenior: false, proximaEm: somarDias(hoje, DIAS_ENTRE_TENTATIVAS) }
}

function juntar(itens: string[]): string {
  return itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}

/** A mensagem de confirmação no Chatwoot (CA1, CA8). A ficha é em papel até o tablet chegar. */
export function mensagemDaConfirmacao(c: {
  nome: string
  tipo: TipoDeEntrevista
  data: string
  hora: string
  link?: string
  beneficio?: string
  fichaPreenchida: boolean
}): string {
  return [
    `Olá, ${c.nome.split(' ')[0]}! Passando para confirmar sua conversa com o escritório GGV: ${diaFalado(c.data)}, às ${horaFalada(c.hora)}, ${COMO[c.tipo]}. Pode confirmar respondendo esta mensagem?`,
    c.tipo === 'video' && c.link ? `Link: ${c.link}.` : '',
    c.fichaPreenchida ? '' : 'Antes da conversa, preencha a ficha de atendimento em papel, no balcão do escritório ou com quem te atendeu.',
    `Traga ${oQueLevar(c.beneficio)}.`,
    `Os documentos que mais travam os casos são ${juntar(DOCUMENTOS_QUE_TRAVAM)}: se faltar algum, avise a gente.`,
  ]
    .filter(Boolean)
    .join(' ')
}

/** "O que você deve fazer" da tela (Figma 10:33), montado por regra a partir do benefício. */
export function instrucaoDaConfirmacao(nome: string, beneficio: string | undefined): string {
  const loas = O_QUE_LEVAR[beneficio ?? ''] !== undefined
  return [
    `Ligue ou mande mensagem pelo Chatwoot para ${nome.split(' ')[0]} confirmando a entrevista.`,
    loas ? 'O BPC/LOAS depende da renda de quem mora na casa e da idade ou da deficiência:' : '',
    `peça que traga ${oQueLevar(beneficio)}.`,
    `Duas tentativas sem confirmação, com ${DIAS_ENTRE_TENTATIVAS} dias entre elas, sobem para a advogada sênior.`,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/(^|\. )peça/, '$1Peça')
}
