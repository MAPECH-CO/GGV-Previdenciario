// EXEMPLO. Catálogos únicos do portal: a ficha, a agenda, o cadastro e a sugestão de benefício usam estes.
// Os nomes vêm do Figma e do Miro (D1). Ao ligar no servidor, trocar pelas listas que o escritório usa no Airtable.
import type { Setor } from './tipos.ts'

export type ItemCatalogo = { id: string; nome: string }

export const BENEFICIOS: ItemCatalogo[] = [
  { id: 'nao-sei', nome: 'Não sei ainda' },
  { id: 'incapacidade-temporaria', nome: 'Auxílio por incapacidade temporária' },
  { id: 'incapacidade-permanente', nome: 'Aposentadoria por incapacidade permanente' },
  { id: 'auxilio-acidente', nome: 'Auxílio-acidente' },
  { id: 'loas-idoso', nome: 'LOAS Idoso' },
  { id: 'loas-deficiente', nome: 'LOAS Deficiente' },
  { id: 'aposentadoria-idade', nome: 'Aposentadoria por idade' },
  { id: 'aposentadoria-especial', nome: 'Aposentadoria especial' },
  { id: 'aposentadoria-pcd', nome: 'Aposentadoria da pessoa com deficiência' },
  { id: 'pensao-morte', nome: 'Pensão por morte' },
  { id: 'salario-maternidade', nome: 'Salário-maternidade' },
  { id: 'curatela', nome: 'Curatela' },
  { id: 'isencao-ir', nome: 'Isenção de IR' },
  { id: 'emprestimo-fraudulento', nome: 'Empréstimo fraudulento' },
  { id: 'seguro-vida', nome: 'Seguro de vida' },
]

/** Fontes de captação ("Como chegou"). */
export const FONTES: ItemCatalogo[] = [
  { id: 'instagram', nome: 'Instagram' },
  { id: 'facebook', nome: 'Facebook' },
  { id: 'google', nome: 'Google' },
  { id: 'whatsapp', nome: 'WhatsApp' },
  { id: 'indicacao', nome: 'Indicação' },
  { id: 'passou-na-frente', nome: 'Passou na frente do escritório' },
  { id: 'ja-foi-cliente', nome: 'Já foi cliente' },
]

/** Tipos de documento: o que a IA sugere e a pessoa confere na janela "Conferir e enviar". */
export const TIPOS_DE_DOCUMENTO: ItemCatalogo[] = [
  { id: 'rg', nome: 'Documento pessoal (RG)' },
  { id: 'cpf', nome: 'Documento pessoal (CPF)' },
  { id: 'comprovante-residencia', nome: 'Comprovante de residência' },
  { id: 'certidao', nome: 'Certidão' },
  { id: 'ctps', nome: 'CTPS' },
  { id: 'cnis', nome: 'CNIS' },
  { id: 'procuracao', nome: 'Procuração' },
  { id: 'contrato', nome: 'Contrato' },
  { id: 'laudo', nome: 'Laudo médico' },
  { id: 'receita', nome: 'Receita médica' },
  { id: 'prontuario', nome: 'Prontuário' },
  { id: 'outro', nome: 'Outro documento' },
]

export function nomeTipo(id: string | undefined): string {
  return TIPOS_DE_DOCUMENTO.find((t) => t.id === id)?.nome ?? ''
}

export const SETORES: Setor[] = ['Jurídico', 'Documentação · ADM', 'Financeiro']

export function nomeBeneficio(id: string | undefined): string {
  return BENEFICIOS.find((b) => b.id === id)?.nome ?? ''
}

export function nomeFonte(id: string | undefined): string {
  return FONTES.find((f) => f.id === id)?.nome ?? ''
}
