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
}

/** As três ações que o G17 segura (GGVP-33, CA1): o OK da Documentação (D1.24), o da sênior antes do INSS (D2.01) e o pedido da petição (D3.05). */
export type AcaoDoPortao = 'liberar' | 'aprovar-inss' | 'pedir-peticao'

export const ACOES_DO_PORTAO: Record<AcaoDoPortao, string> = { liberar: 'liberar ao Jurídico', 'aprovar-inss': 'aprovar para o INSS', 'pedir-peticao': 'pedir a petição' }

export const precisaDeParecer = (beneficio: string) => BENEFICIOS_COM_PARECER.includes(beneficio)

/** O parecer está em ordem: "Suficiente", dispensado por duas sêniores, ou o benefício nem pede parecer (CA7, G17). */
export const parecerEmOrdem = (beneficio: string, parecer: Parecer | undefined) =>
  !precisaDeParecer(beneficio) || parecer?.situacao === 'suficiente' || parecer?.situacao === 'dispensado'

/** Por que a ação não segue pelo G17, dizendo o que falta; em ordem, null (GGVP-33, CA1 e CA5). */
export function travaDoParecer(acao: AcaoDoPortao, beneficio: string, parecer: Parecer | undefined): string | null {
  if (parecerEmOrdem(beneficio, parecer)) return null
  const fazer = `Não dá para ${ACOES_DO_PORTAO[acao]}`
  switch (parecer?.situacao) {
    case 'insuficiente':
      return `${fazer}: o parecer médico está Insuficiente. Falta o complemento do médico e o parecer refeito (G17).`
    case 'contraditorio':
      return `${fazer}: um documento contradiz o requisito do benefício e o parecer está Contraditório (G18).`
    case 'pendente':
      return `${fazer}: a IA analisou, mas o parecer médico ainda não foi confirmado por pessoa do Jurídico (G17).`
    default:
      return `${fazer}: falta o parecer médico "Suficiente", confirmado por pessoa (G17).`
  }
}

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
