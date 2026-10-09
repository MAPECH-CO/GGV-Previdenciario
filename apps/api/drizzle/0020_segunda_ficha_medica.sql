CREATE TABLE "segunda_ficha_medica" (
	"pessoa_id" uuid PRIMARY KEY NOT NULL,
	"medicos" jsonb NOT NULL,
	"lida" boolean NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "segunda_ficha_medica" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "segunda_ficha_medica" ADD CONSTRAINT "segunda_ficha_medica_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;