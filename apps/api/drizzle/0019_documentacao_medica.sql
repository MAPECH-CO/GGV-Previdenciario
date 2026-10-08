CREATE TABLE "documentacao_medica" (
	"caso_id" uuid NOT NULL,
	"parte" text NOT NULL,
	"documento" jsonb NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documentacao_medica_caso_id_parte_pk" PRIMARY KEY("caso_id","parte"),
	CONSTRAINT "documentacao_medica_parte" CHECK ("documentacao_medica"."parte" in ('parecer', 'complemento', 'deficiencia', 'acidente', 'crianca'))
);
--> statement-breakpoint
ALTER TABLE "documentacao_medica" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "roteiro_laudo" ADD COLUMN "autor_id" uuid;--> statement-breakpoint
ALTER TABLE "documentacao_medica" ADD CONSTRAINT "documentacao_medica_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiro_laudo" ADD CONSTRAINT "roteiro_laudo_autor_id_usuario_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;