-- Base de conhecimento do acervo (GGVP-141, ADR-013): a extensão pgvector. No Supabase, ela também pode ser ligada no painel.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "acervo_trecho" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"origem" text NOT NULL,
	"referencia" text NOT NULL,
	"caso_id" uuid,
	"beneficio" text,
	"texto" text NOT NULL,
	"so_juridico" boolean DEFAULT false NOT NULL,
	"embedding" vector(1536),
	"hash" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acervo_trecho_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
ALTER TABLE "acervo_trecho" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "acervo_trecho" ADD CONSTRAINT "acervo_trecho_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acervo_trecho_vetor" ON "acervo_trecho" USING hnsw ("embedding" vector_cosine_ops);