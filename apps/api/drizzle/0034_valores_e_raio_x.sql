ALTER TABLE "pessoa" ADD COLUMN "renda_por_pessoa" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "caso" ADD COLUMN "valor_causa" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "tarefa" ADD COLUMN "detalhe" text;--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD COLUMN "juiz" text;--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD COLUMN "falha_nossa" boolean;--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD COLUMN "laudo_favoravel" boolean;--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD COLUMN "extinto_por_determinacao" boolean;--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD COLUMN "faltou_pericia" boolean;--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD COLUMN "cartorio_cobrou" jsonb;--> statement-breakpoint
-- GGVP-158 P7.2: as tarefas da Recepção que viram linha, uma aberta por chave (o passo, o título e o caso, ou a pessoa
-- sem caso). A sincronização abre com "on conflict do nothing": duas rotas ao mesmo tempo não repetem a linha.
CREATE UNIQUE INDEX "tarefa_da_recepcao_uma_aberta" ON "tarefa" ("passo", "titulo", coalesce("caso_id", "pessoa_id"))
	WHERE "concluida_em" IS NULL AND "passo" IN ('D1.14', 'D1.21', 'D1.22', 'D1.23');