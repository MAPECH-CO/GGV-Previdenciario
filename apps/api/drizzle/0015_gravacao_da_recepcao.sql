CREATE TABLE "gravacao_recepcao" (
	"id" text PRIMARY KEY NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"so_juridico" boolean NOT NULL,
	"dados" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gravacao_recepcao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gravacao_recepcao" ADD CONSTRAINT "gravacao_recepcao_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;