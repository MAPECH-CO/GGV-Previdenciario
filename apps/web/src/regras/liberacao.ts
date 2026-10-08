// A liberação do caso ao Jurídico (GGVP-18, G1, G17). Trava é código com teste, nunca resposta de modelo.
import { motivoParaNaoLiberar, type Checklist } from './checklist.ts'

/** Quem pode estar na tela. Só a Documentação · ADM aperta o OK (CA4). */
export type Perfil = 'documentacao' | 'atendimento' | 'juridico'

export const PERFIS: Record<Perfil, string> = { documentacao: 'Documentação · ADM', atendimento: 'Atendimento', juridico: 'Jurídico' }

/** Os benefícios da matriz de docs/requisitos/roteiro-laudos.md: estes pedem parecer médico "Suficiente" (G17). */
export const BENEFICIOS_COM_PARECER = [
  'loas-deficiente',
  'aposentadoria-pcd',
  'aposentadoria-pcd-idade',
  'incapacidade-temporaria',
  'incapacidade-permanente',
  'incapacidade-permanente-acidentaria',
  'auxilio-acidente',
]

/** O registro do parecer médico (GGVP-20): quem confirmou e quando. */
export type Parecer = { situacao: 'suficiente' | 'insuficiente' | 'pendente'; quem?: string; /** aaaa-mm-dd */ data?: string }

export const precisaDeParecer = (beneficio: string) => BENEFICIOS_COM_PARECER.includes(beneficio)

/** O parecer está em ordem: "Suficiente", ou o benefício nem pede parecer (CA7, G17). */
export const parecerEmOrdem = (beneficio: string, parecer: Parecer | undefined) => !precisaDeParecer(beneficio) || parecer?.situacao === 'suficiente'

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
  if (!parecerEmOrdem(d.beneficio, d.parecer)) return 'O parecer médico ainda não está "Suficiente", confirmado por pessoa (G17).'
  if (!d.conferiChecklist || !d.conferiAssinaturas) return 'Marque o checklist e as assinaturas e datas: os dois são conferência sua.'
  return null
}

/** Dias inteiros na fila da Documentação, de aaaa-mm-dd a aaaa-mm-dd (CA5). */
export function diasNaFila(desde: string, hoje: string): number {
  return Math.max(0, Math.round((Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000))
}

export const idade = (dias: number) => (dias === 0 ? 'desde hoje' : dias === 1 ? 'há 1 dia' : `há ${dias} dias`)
