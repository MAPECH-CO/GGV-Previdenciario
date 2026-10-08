CREATE TABLE "contrato_recepcao" (
	"caso_id" uuid PRIMARY KEY NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"dados" jsonb NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contrato_recepcao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contrato_recepcao" ADD CONSTRAINT "contrato_recepcao_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato_recepcao" ADD CONSTRAINT "contrato_recepcao_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;