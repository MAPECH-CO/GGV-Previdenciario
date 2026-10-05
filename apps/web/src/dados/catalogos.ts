// EXEMPLO. Catálogos únicos do portal: a ficha, a agenda, o cadastro e a sugestão de benefício usam estes.
// Os nomes vêm do Figma e do Miro (D1). Ao ligar no servidor, trocar pelas listas que o escritório usa no Airtable.
import type { CategoriaDaAgenda, Setor, TipoDeEntrevista } from './tipos.ts'

export type ItemCatalogo = { id: string; nome: string }

/**
 * O catálogo de benefícios do cartão "Checklist de documentos obrigatórios do benefício" (GGVP-91): a coluna "Beneficio"
 * do Airtable do escritório, normalizada em 05/10, na mesma ordem. Primeiro os previdenciários, depois os cíveis.
 */
export const BENEFICIOS: ItemCatalogo[] = [
  { id: 'nao-sei', nome: 'Não sei ainda' },
  { id: 'aposentadoria-especial', nome: 'Aposentadoria Especial' },
  { id: 'aposentadoria-contribuicao', nome: 'Aposentadoria por Contribuição' },
  { id: 'aposentadoria-idade', nome: 'Aposentadoria por Idade' },
  { id: 'incapacidade-permanente', nome: 'Aposentadoria por Incapacidade Permanente' },
  { id: 'incapacidade-permanente-acidentaria', nome: 'Aposentadoria por Incapacidade Permanente Acidentária' },
  { id: 'aposentadoria-rural', nome: 'Aposentadoria Rural' },
  { id: 'aposentadoria-pcd', nome: 'PCD Aposentadoria por Contribuição' },
  { id: 'aposentadoria-pcd-idade', nome: 'PCD Aposentadoria por Idade' },
  { id: 'auxilio-acidente', nome: 'Auxílio Acidentário' },
  { id: 'incapacidade-temporaria', nome: 'Auxílio por Incapacidade Temporária' },
  { id: 'salario-maternidade', nome: 'Salário-Maternidade' },
  { id: 'loas-deficiente', nome: 'LOAS Deficiente' },
  { id: 'loas-idoso', nome: 'LOAS Idoso' },
  { id: 'pensao-morte', nome: 'Pensão por Morte' },
  { id: 'restabelecimento', nome: 'Restabelecimento de Benefício' },
  { id: 'revisao-aposentadoria', nome: 'Revisão de Aposentadoria' },
  { id: 'revisao-vida-toda', nome: 'Revisão da Vida Toda' },
  { id: 'ctc', nome: 'Emissão de Certidão de Tempo de Contribuição (CTC)' },
  { id: 'atualizacao-vinculos', nome: 'Atualização de Vínculos e Contribuições' },
  { id: 'planejamento', nome: 'Planejamento Previdenciário' },
  { id: 'restituicao-contribuicoes', nome: 'Restituição de Contribuições' },
  { id: 'isencao-ir', nome: 'Isenção e Restituição de Imposto de Renda' },
  { id: 'curatela', nome: 'Curatela' },
  { id: 'alvara', nome: 'Alvará Judicial' },
  { id: 'divorcio', nome: 'Divórcio' },
  { id: 'inventario', nome: 'Inventário' },
  { id: 'guarda', nome: 'Processo de Guarda' },
  { id: 'consignado', nome: 'Empréstimo Consignado' },
  { id: 'revisao-consignado', nome: 'Revisão de Empréstimo Consignado' },
  { id: 'emprestimo-indevido', nome: 'Empréstimo Indevido' },
  { id: 'cartao-rmc', nome: 'Cartão RMC' },
  { id: 'negativacao-indevida', nome: 'Negativação Indevida' },
  { id: 'seguro-vida', nome: 'Seguro de Vida' },
  { id: 'seguro-carro', nome: 'Seguro de Carro' },
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
  { id: 'ficha-atendimento', nome: 'Ficha de atendimento' },
  { id: 'ficha-acidente', nome: 'Ficha de auxílio acidente' },
  { id: 'outro', nome: 'Outro documento' },
]

export function nomeTipo(id: string | undefined): string {
  return TIPOS_DE_DOCUMENTO.find((t) => t.id === id)?.nome ?? ''
}

/** Quem trabalha no escritório. Só quem já está na semente; o captador nunca entra no "Com quem" (GGVP-123, CA2). */
export type MembroDaEquipe = { id: string; nome: string; papel: 'advogada' | 'atendimento' | 'captador' }

export const EQUIPE: MembroDaEquipe[] = [
  { id: 'paula', nome: 'Dra. Paula', papel: 'advogada' },
  { id: 'atendimento', nome: 'Você (Atendimento)', papel: 'atendimento' },
]

export const TIPOS_DE_ENTREVISTA: { id: TipoDeEntrevista; nome: string }[] = [
  { id: 'video', nome: 'Vídeo (Meet)' },
  { id: 'presencial', nome: 'Presencial' },
  { id: 'telefone', nome: 'Telefone' },
]

/** As categorias da agenda, na ordem dos filtros do Figma (1941:2). */
export const CATEGORIAS_DA_AGENDA: { id: CategoriaDaAgenda; nome: string }[] = [
  { id: 'visitas', nome: 'Visitas e reuniões' },
  { id: 'pericias', nome: 'Perícias' },
  { id: 'audiencias', nome: 'Audiências' },
  { id: 'protocolos', nome: 'Protocolos (INSS e Justiça)' },
  { id: 'prazos', nome: 'Prazos' },
  { id: 'bancos', nome: 'Idas ao banco' },
  { id: 'retornos', nome: 'Retornos a leads' },
]

export const SETORES: Setor[] = ['Jurídico', 'Documentação · ADM', 'Financeiro']

export function nomeBeneficio(id: string | undefined): string {
  return BENEFICIOS.find((b) => b.id === id)?.nome ?? ''
}

export function nomeFonte(id: string | undefined): string {
  return FONTES.find((f) => f.id === id)?.nome ?? ''
}
