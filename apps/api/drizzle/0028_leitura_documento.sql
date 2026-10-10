CREATE TABLE "leitura_documento" (
	"id" text PRIMARY KEY NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"dados" jsonb NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leitura_documento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "leitura_documento" ADD CONSTRAINT "leitura_documento_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;