// Catálogo único do escritório: os 34 benefícios das telas, sem inventar checklist ou modelo aprovado. GGVP-158 P4.6: cada
// um com o id do servidor, que é o do banco (`caso.beneficio`, o CHECK `caso_beneficio`) e o da Configuração. Os 11 de
// antes guardam o id que já tinham; os outros usam o id das telas com "_".
export const CATALOGO_BENEFICIOS = [
  { id: 'aposentadoria-especial', nome: 'Aposentadoria Especial', servidor: 'aposentadoria_especial' },
  { id: 'aposentadoria-contribuicao', nome: 'Aposentadoria por Contribuição', servidor: 'aposentadoria_tempo' },
  { id: 'aposentadoria-idade', nome: 'Aposentadoria por Idade', servidor: 'aposentadoria_idade' },
  { id: 'incapacidade-permanente', nome: 'Aposentadoria por Incapacidade Permanente', servidor: 'aposentadoria_incapacidade_permanente' },
  { id: 'incapacidade-permanente-acidentaria', nome: 'Aposentadoria por Incapacidade Permanente Acidentária', servidor: 'incapacidade_permanente_acidentaria' },
  { id: 'aposentadoria-rural', nome: 'Aposentadoria Rural', servidor: 'aposentadoria_rural' },
  { id: 'aposentadoria-pcd', nome: 'PCD Aposentadoria por Contribuição', servidor: 'aposentadoria_pcd' },
  { id: 'aposentadoria-pcd-idade', nome: 'PCD Aposentadoria por Idade', servidor: 'aposentadoria_pcd_idade' },
  { id: 'auxilio-acidente', nome: 'Auxílio Acidentário', servidor: 'auxilio_acidente' },
  { id: 'incapacidade-temporaria', nome: 'Auxílio por Incapacidade Temporária', servidor: 'auxilio_incapacidade_temporaria' },
  { id: 'salario-maternidade', nome: 'Salário-Maternidade', servidor: 'salario_maternidade' },
  { id: 'loas-deficiente', nome: 'LOAS Deficiente', servidor: 'bpc_loas_deficiente' },
  { id: 'loas-idoso', nome: 'LOAS Idoso', servidor: 'bpc_loas_idoso' },
  { id: 'pensao-morte', nome: 'Pensão por Morte', servidor: 'pensao_morte' },
  { id: 'restabelecimento', nome: 'Restabelecimento de Benefício', servidor: 'restabelecimento' },
  { id: 'revisao-aposentadoria', nome: 'Revisão de Aposentadoria', servidor: 'revisao_aposentadoria' },
  { id: 'revisao-vida-toda', nome: 'Revisão da Vida Toda', servidor: 'revisao_vida_toda' },
  { id: 'ctc', nome: 'Emissão de Certidão de Tempo de Contribuição (CTC)', servidor: 'ctc' },
  { id: 'atualizacao-vinculos', nome: 'Atualização de Vínculos e Contribuições', servidor: 'atualizacao_vinculos' },
  { id: 'planejamento', nome: 'Planejamento Previdenciário', servidor: 'planejamento' },
  { id: 'restituicao-contribuicoes', nome: 'Restituição de Contribuições', servidor: 'restituicao_contribuicoes' },
  { id: 'isencao-ir', nome: 'Isenção e Restituição de Imposto de Renda', servidor: 'isencao_ir' },
  { id: 'curatela', nome: 'Curatela', servidor: 'curatela' },
  { id: 'alvara', nome: 'Alvará Judicial', servidor: 'alvara' },
  { id: 'divorcio', nome: 'Divórcio', servidor: 'divorcio' },
  { id: 'inventario', nome: 'Inventário', servidor: 'inventario' },
  { id: 'guarda', nome: 'Processo de Guarda', servidor: 'guarda' },
  { id: 'consignado', nome: 'Empréstimo Consignado', servidor: 'consignado' },
  { id: 'revisao-consignado', nome: 'Revisão de Empréstimo Consignado', servidor: 'revisao_consignado' },
  { id: 'emprestimo-indevido', nome: 'Empréstimo Indevido', servidor: 'emprestimo_indevido' },
  { id: 'cartao-rmc', nome: 'Cartão RMC', servidor: 'cartao_rmc' },
  { id: 'negativacao-indevida', nome: 'Negativação Indevida', servidor: 'negativacao_indevida' },
  { id: 'seguro-vida', nome: 'Seguro de Vida', servidor: 'seguro_vida' },
  { id: 'seguro-carro', nome: 'Seguro de Carro', servidor: 'seguro_carro' },
] as const

/** O id do servidor de cada benefício das telas: o que a Configuração envia e o caso guarda (GGVP-158 P4.6). */
export const BENEFICIO_NA_CONFIGURACAO: Readonly<Record<string, string>> = Object.fromEntries(CATALOGO_BENEFICIOS.map((b) => [b.id, b.servidor]))
