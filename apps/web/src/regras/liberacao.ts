// A liberação do caso ao Jurídico (GGVP-18, G1, G17). Trava é código com teste, nunca resposta de modelo.
import { precisaDeParecer as precisaNoContrato, travaDoParecer as travaDoContrato, type AcaoDoPortao, type Beneficio } from '@ggv/contratos'
import { SUGESTAO_DE_TROCA } from './acidente.ts'
import { motivoParaNaoLiberar, type Checklist } from './checklist.ts'

/** Quem pode estar na tela. Só a Documentação · ADM aperta o OK (CA4). */
export type Perfil = 'documentacao' | 'atendimento' | 'juridico'

export const PERFIS: Record<Perfil, string> = { documentacao: 'Documentação · ADM', atendimento: 'Atendimento', juridico: 'Jurídico' }

/**
 * O benefício da tela (servidor de exemplo) no catálogo do servidor. O G17 é uma regra só, `travaDoParecer` em
 * `@ggv/contratos` (GGVP-109): a tela e o servidor importam a mesma. Só os benefícios com laudo precisam estar aqui.
 */
const NO_SERVIDOR: Record<string, Beneficio> = {
  'loas-deficiente': 'bpc_loas_deficiente',
  'aposentadoria-pcd': 'aposentadoria_pcd',
  'aposentadoria-pcd-idade': 'aposentadoria_pcd',
  'incapacidade-temporaria': 'auxilio_incapacidade_temporaria',
  'incapacidade-permanente': 'aposentadoria_incapacidade_permanente',
  'incapacidade-permanente-acidentaria': 'aposentadoria_incapacidade_permanente',
  'auxilio-acidente': 'auxilio_acidente',
}

/**
 * O registro do parecer médico (GGVP-20): quem confirmou e quando. "pendente": a IA sugeriu e ninguém conferiu ainda.
 * "dispensado": duas sêniores dispensaram, com justificativa (GGVP-33).
 */
export type Parecer = {
  situacao: 'suficiente' | 'insuficiente' | 'pendente' | 'contraditorio' | 'dispensado'
  quem?: string
  /** aaaa-mm-dd */
  data?: string
  /** Na dispensa: a justificativa das sêniores (GGVP-33, CA2). */
  justificativa?: string
  /** O que a análise da IA achou de contradição e ninguém do Jurídico conferiu ainda (G18, GGVP-47 CA4). */
  contradicoes?: { id: string; texto: string }[]
}

export type { AcaoDoPortao }

export const precisaDeParecer = (beneficio: string) => precisaNoContrato(NO_SERVIDOR[beneficio] ?? beneficio)

/** Por que a ação não segue pelo G17, dizendo o que falta; em ordem, null (GGVP-33, CA1 e CA5). A regra é a do contrato. */
export function travaDoParecer(acao: AcaoDoPortao, beneficio: string, parecer: Parecer | undefined): string | null {
  const trava = travaDoContrato(acao, NO_SERVIDOR[beneficio] ?? beneficio, parecer)
  // Na lesão não consolidada do Auxílio-Acidente, o caso muda de porta em vez de morrer (resposta do Lucas, 01/10).
  const troca = trava && beneficio === 'auxilio-acidente' && parecer?.contradicoes?.some((c) => c.id === 'nao-consolidada')
  return troca ? `${trava} ${SUGESTAO_DE_TROCA}` : trava
}

/** O parecer está em ordem: "Suficiente", dispensado por duas sêniores, ou o benefício nem pede parecer (CA7, G17). */
export const parecerEmOrdem = (beneficio: string, parecer: Parecer | undefined) => travaDoParecer('liberar', beneficio, parecer) === null

/** Por que "Liberar ao Jurídico" não habilita; pronto, null (CA2, CA7). */
export function travaDaLiberacao(d: {
  checklist: Checklist
  beneficio: string
  nomeBeneficio: string
  parecer: Parecer | undefined
  conferiChecklist: boolean
  conferiAssinaturas: boolean
}): string | null {
  const checklist = motivoParaNaoLiberar(d.checklist, d.nomeBeneficio)
  if (checklist) return checklist
  const g17 = travaDoParecer('liberar', d.beneficio, d.parecer)
  if (g17) return g17
  if (!d.conferiChecklist || !d.conferiAssinaturas) return 'Marque o checklist e as assinaturas e datas: os dois são conferência sua.'
  return null
}

/** Dias inteiros na fila da Documentação, de aaaa-mm-dd a aaaa-mm-dd (CA5). */
export function diasNaFila(desde: string, hoje: string): number {
  return Math.max(0, Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000))
}

export const idade = (dias: number) => (dias === 0 ? 'desde hoje' : dias === 1 ? 'há 1 dia' : `há ${dias} dias`)
