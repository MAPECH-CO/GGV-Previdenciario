ALTER TABLE "caso" DROP CONSTRAINT "caso_beneficio";--> statement-breakpoint
ALTER TABLE "caso" ADD CONSTRAINT "caso_beneficio" CHECK ("caso"."beneficio" in ('bpc_loas_deficiente', 'bpc_loas_idoso', 'aposentadoria_pcd', 'aposentadoria_idade', 'aposentadoria_tempo', 'aposentadoria_especial', 'aposentadoria_incapacidade_permanente', 'auxilio_incapacidade_temporaria', 'auxilio_acidente', 'pensao_morte', 'salario_maternidade', 'incapacidade_permanente_acidentaria', 'aposentadoria_rural', 'aposentadoria_pcd_idade', 'restabelecimento', 'revisao_aposentadoria', 'revisao_vida_toda', 'ctc', 'atualizacao_vinculos', 'planejamento', 'restituicao_contribuicoes', 'isencao_ir', 'curatela', 'alvara', 'divorcio', 'inventario', 'guarda', 'consignado', 'revisao_consignado', 'emprestimo_indevido', 'cartao_rmc', 'negativacao_indevida', 'seguro_vida', 'seguro_carro', 'outro'));--> statement-breakpoint
-- GGVP-158 P4.6: o glossário segue com os benefícios do catálogo (GGVP-143 CA3). Entram os 23 novos, pelo nome das telas;
-- o que a Sênior já tiver posto com o mesmo nome fica como está.
INSERT INTO "glossario_termo" ("termo", "tipo") VALUES
	('Aposentadoria por Incapacidade Permanente Acidentária', 'beneficio'),
	('Aposentadoria Rural', 'beneficio'),
	('PCD Aposentadoria por Idade', 'beneficio'),
	('Restabelecimento de Benefício', 'beneficio'),
	('Revisão de Aposentadoria', 'beneficio'),
	('Revisão da Vida Toda', 'beneficio'),
	('Emissão de Certidão de Tempo de Contribuição (CTC)', 'beneficio'),
	('Atualização de Vínculos e Contribuições', 'beneficio'),
	('Planejamento Previdenciário', 'beneficio'),
	('Restituição de Contribuições', 'beneficio'),
	('Isenção e Restituição de Imposto de Renda', 'beneficio'),
	('Curatela', 'beneficio'),
	('Alvará Judicial', 'beneficio'),
	('Divórcio', 'beneficio'),
	('Inventário', 'beneficio'),
	('Processo de Guarda', 'beneficio'),
	('Empréstimo Consignado', 'beneficio'),
	('Revisão de Empréstimo Consignado', 'beneficio'),
	('Empréstimo Indevido', 'beneficio'),
	('Cartão RMC', 'beneficio'),
	('Negativação Indevida', 'beneficio'),
	('Seguro de Vida', 'beneficio'),
	('Seguro de Carro', 'beneficio')
ON CONFLICT DO NOTHING;