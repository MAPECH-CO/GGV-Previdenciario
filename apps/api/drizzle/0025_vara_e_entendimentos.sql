ALTER TABLE "caso" ADD COLUMN "vara" text;--> statement-breakpoint
ALTER TABLE "caso" ADD COLUMN "juiz" text;--> statement-breakpoint
ALTER TABLE "juizo" ADD COLUMN "entendimentos" jsonb;--> statement-breakpoint
ALTER TABLE "juizo" ADD COLUMN "entendimentos_em" timestamp with time zone;