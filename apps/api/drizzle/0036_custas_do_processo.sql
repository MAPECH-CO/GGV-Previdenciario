CREATE TABLE "custo_processo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"data" date NOT NULL,
	"descricao" text NOT NULL,
	"valor" numeric(14, 2) NOT NULL,
	"comprovante_chave" text NOT NULL,
	"comprovante_mime" text NOT NULL,
	"comprovante_nome" text NOT NULL,
	"situacao" text DEFAULT 'esperando' NOT NULL,
	"motivo" text,
	"lancado_por" uuid NOT NULL,
	"decidido_por" uuid,
	"decidido_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custo_processo_situacao" CHECK ("custo_processo"."situacao" in ('esperando', 'aprovado', 'recusado', 'cancelado')),
	CONSTRAINT "custo_processo_valor_positivo" CHECK ("custo_processo"."valor" > 0)
);
--> statement-breakpoint
ALTER TABLE "custo_processo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "custo_processo" ADD CONSTRAINT "custo_processo_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custo_processo" ADD CONSTRAINT "custo_processo_lancado_por_usuario_id_fk" FOREIGN KEY ("lancado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custo_processo" ADD CONSTRAINT "custo_processo_decidido_por_usuario_id_fk" FOREIGN KEY ("decidido_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custo_processo_caso_idx" ON "custo_processo" USING btree ("caso_id");