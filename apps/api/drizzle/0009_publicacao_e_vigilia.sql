CREATE TABLE "publicacao_descarte" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fonte" text NOT NULL,
	"numero_cnj" text,
	"disponibilizada_em" date NOT NULL,
	"trecho" text NOT NULL,
	"motivo" text NOT NULL,
	"publicacao_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "publicacao_descarte" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "publicacao_reclassificacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publicacao_id" uuid NOT NULL,
	"de" text NOT NULL,
	"para" text NOT NULL,
	"por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "publicacao_reclassificacao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "prazo" ADD COLUMN "regra_versao" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "publicacao" ADD COLUMN "partes" text;--> statement-breakpoint
ALTER TABLE "publicacao" ADD COLUMN "fila" text;--> statement-breakpoint
ALTER TABLE "publicacao" ADD COLUMN "motivo_fila" text;--> statement-breakpoint
ALTER TABLE "publicacao" ADD COLUMN "vinculada_por" uuid;--> statement-breakpoint
ALTER TABLE "publicacao" ADD COLUMN "vinculada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "publicacao" ADD COLUMN "fora_do_escritorio" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rodada_vigilia" ADD COLUMN "reprocessada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "publicacao_descarte" ADD CONSTRAINT "publicacao_descarte_publicacao_id_publicacao_id_fk" FOREIGN KEY ("publicacao_id") REFERENCES "public"."publicacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicacao_reclassificacao" ADD CONSTRAINT "publicacao_reclassificacao_publicacao_id_publicacao_id_fk" FOREIGN KEY ("publicacao_id") REFERENCES "public"."publicacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicacao_reclassificacao" ADD CONSTRAINT "publicacao_reclassificacao_por_usuario_id_fk" FOREIGN KEY ("por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_vinculada_por_usuario_id_fk" FOREIGN KEY ("vinculada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_fila" CHECK ("publicacao"."fila" in ('revisao'));