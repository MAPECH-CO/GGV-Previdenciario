ALTER TABLE "exigencia_item" ADD COLUMN "prova_esperada" text;--> statement-breakpoint
ALTER TABLE "exigencia_item" ADD COLUMN "tarefa_id" uuid;--> statement-breakpoint
ALTER TABLE "peticao_versao" ADD COLUMN "documento_id" uuid;--> statement-breakpoint
ALTER TABLE "peticao_versao" ADD CONSTRAINT "peticao_versao_documento_id_documento_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documento"("id") ON DELETE no action ON UPDATE no action;