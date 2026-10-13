ALTER TABLE "pessoa" ADD COLUMN "renda_por_pessoa" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "caso" ADD COLUMN "valor_causa" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD COLUMN "juiz" text;--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD COLUMN "falha_nossa" boolean;--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD COLUMN "laudo_favoravel" boolean;--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD COLUMN "extinto_por_determinacao" boolean;--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD COLUMN "faltou_pericia" boolean;--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD COLUMN "cartorio_cobrou" jsonb;