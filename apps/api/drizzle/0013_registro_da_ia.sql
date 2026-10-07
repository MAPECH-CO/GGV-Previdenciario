CREATE TABLE "chamada_ia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finalidade" text NOT NULL,
	"fornecedor" text NOT NULL,
	"modelo" text NOT NULL,
	"versao_instrucao" integer NOT NULL,
	"caso_id" uuid,
	"pedida_por" uuid,
	"entrada_tamanho" integer NOT NULL,
	"entrada_hash" text NOT NULL,
	"fontes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"saida" text,
	"situacao" text NOT NULL,
	"erro" text,
	"duracao_ms" integer,
	"quando" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chamada_ia_fornecedor" CHECK ("chamada_ia"."fornecedor" in ('openai', 'mistral')),
	CONSTRAINT "chamada_ia_situacao" CHECK ("chamada_ia"."situacao" in ('ok', 'desligada', 'recusada', 'falhou'))
);
--> statement-breakpoint
ALTER TABLE "chamada_ia" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chamada_ia" ADD CONSTRAINT "chamada_ia_pedida_por_usuario_id_fk" FOREIGN KEY ("pedida_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;