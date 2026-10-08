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
  // GGVP-91: os do checklist do LOAS (cartões GGVP-91, critério 7, e GGVP-21) e os da exigência do Antônio na semente.
  { id: 'comprovante-renda', nome: 'Comprovante de renda' },
  { id: 'cadunico', nome: 'Cadastro Único (CadÚnico)' },
  { id: 'grupo-familiar', nome: 'Ficha de grupo familiar' },
  { id: 'declaracao-moradia', nome: 'Declaração de moradia' },
  { id: 'declaracao-uniao-estavel', nome: 'Declaração de união estável' },
  { id: 'declaracao-separacao', nome: 'Declaração de separação de fato' },
  { id: 'notas-produtor', nome: 'Notas do produtor rural' },
  // GGVP-95: os documentos médicos que a IA classifica (laudo, receita e prontuário já estão acima).
  { id: 'atestado', nome: 'Atestado médico' },
  { id: 'relatorio-medico', nome: 'Relatório médico' },
  { id: 'exame', nome: 'Exame' },
  { id: 'cat', nome: 'CAT (Comunicação de Acidente de Trabalho)' },
  { id: 'boletim-ocorrencia', nome: 'Boletim de ocorrência' },
  { id: 'relatorio-escolar', nome: 'Relatório escolar' },
  { id: 'relatorio-terapia', nome: 'Relatório de terapia' },
  // GGVP-42: as provas da deficiência na época de cada vínculo.
  { id: 'aso', nome: 'ASO (atestado de saúde ocupacional)' },
  { id: 'contratacao-cota', nome: 'Contratação por cota (PCD)' },
  // GGVP-47: as provas do acidente que ainda não estavam (CAT, boletim e prontuário já estão acima).
  { id: 'ficha-pronto-socorro', nome: 'Ficha do pronto-socorro' },
  { id: 'exame-imagem-epoca', nome: 'Exame de imagem da época do acidente' },
  { id: 'exame-pos-alta', nome: 'Exame posterior à alta' },
  { id: 'ppp', nome: 'PPP (Perfil Profissiográfico Previdenciário)' },
  // Respostas do Lucas de 07/10 (GGVP-47): fotos, exames da doença ocupacional e a cópia do processo do auxílio anterior.
  { id: 'fotos-acidente', nome: 'Fotos do acidente' },
  { id: 'exame-evolucao', nome: 'Exames do quadro e da evolução' },
  { id: 'processo-auxilio-anterior', nome: 'Cópia do processo do auxílio por incapacidade temporária' },
  // GGVP-50: os relatórios do caso da criança, por condição e por terapia (o escolar já está acima).
  { id: 'relatorio-caps', nome: 'Relatório do CAPS' },
  { id: 'relatorio-neurologia', nome: 'Relatório da neurologia' },
  { id: 'relatorio-fono', nome: 'Relatório de fonoaudiologia' },
  { id: 'relatorio-to', nome: 'Relatório de terapia ocupacional' },
  { id: 'relatorio-psicologia', nome: 'Relatório de psicologia' },
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

/** EXEMPLO. Profissões do cadastro (GGVP-43, CA10): as que mais aparecem nas fichas. Trocar pela lista do Airtable. */
export const PROFISSOES: ItemCatalogo[] = [
  'Agricultor(a) / trabalhador(a) rural',
  'Aposentado(a)',
  'Auxiliar de limpeza',
  'Auxiliar de produção',
  'Comerciante',
  'Costureiro(a)',
  'Cozinheiro(a)',
  'Desempregado(a)',
  'Diarista',
  'Do lar',
  'Empregado(a) doméstico(a)',
  'Estudante',
  'Motorista',
  'Pedreiro(a)',
  'Porteiro(a)',
  'Servente',
  'Vendedor(a)',
  'Vigilante',
  'Outra',
].map((nome) => ({ id: nome, nome }))

/** Por que o lead não fechou (GGVP-60, CA6): a lista do cartão, com os quatro que o Lucas incluiu em 05/10. */
export const MOTIVOS_DE_NAO_FECHAR: ItemCatalogo[] = [
  { id: 'preco', nome: 'Preço' },
  { id: 'desistiu', nome: 'Desistiu' },
  { id: 'sem-direito', nome: 'Ainda não tem direito' },
  { id: 'outro-escritorio', nome: 'Foi a outro escritório' },
  { id: 'sem-retorno', nome: 'Sem retorno' },
  { id: 'contato-invalido', nome: 'Contato inválido' },
  { id: 'fez-sozinho', nome: 'Fez o processo sozinho' },
  { id: 'falecido', nome: 'Falecido' },
  { id: 'recusado', nome: 'Recusado pelo escritório' },
  { id: 'outro', nome: 'Outro' },
]

export function nomeMotivo(id: string | undefined): string {
  return MOTIVOS_DE_NAO_FECHAR.find((m) => m.id === id)?.nome ?? ''
}
