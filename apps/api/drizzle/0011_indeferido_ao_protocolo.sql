ALTER TABLE "exigencia" DROP CONSTRAINT "exigencia_origem";--> statement-breakpoint
ALTER TABLE "exigencia_item" ADD COLUMN "informacao" text;--> statement-breakpoint
ALTER TABLE "resultado_inss" ADD COLUMN "motivo_escrito" text;--> statement-breakpoint
ALTER TABLE "resultado_inss" ADD COLUMN "motivo_escrito_por" uuid;--> statement-breakpoint
ALTER TABLE "resultado_inss" ADD COLUMN "motivo_escrito_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "peticao" ADD COLUMN "instrucoes" text;--> statement-breakpoint
ALTER TABLE "peticao" ADD COLUMN "opcoes" jsonb;--> statement-breakpoint
ALTER TABLE "peticao" ADD COLUMN "citados" jsonb;--> statement-breakpoint
ALTER TABLE "peticao_versao" ADD COLUMN "pacote" jsonb;--> statement-breakpoint
ALTER TABLE "peticao_versao" ADD COLUMN "pacote_gerado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "resultado_inss" ADD CONSTRAINT "resultado_inss_motivo_escrito_por_usuario_id_fk" FOREIGN KEY ("motivo_escrito_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exigencia" ADD CONSTRAINT "exigencia_origem" CHECK ("exigencia"."origem" in ('inss', 'juizo', 'despacho'));