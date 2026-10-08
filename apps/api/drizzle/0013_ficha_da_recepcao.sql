CREATE TABLE "ficha_recepcao" (
	"pessoa_id" uuid PRIMARY KEY NOT NULL,
	"documento" jsonb NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ficha_recepcao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ficha_recepcao" ADD CONSTRAINT "ficha_recepcao_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;