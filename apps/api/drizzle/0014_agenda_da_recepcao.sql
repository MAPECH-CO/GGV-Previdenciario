CREATE TABLE "compromisso_interno" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"data" date NOT NULL,
	"hora" text NOT NULL,
	"duracao" integer NOT NULL,
	"responsavel" text NOT NULL,
	"estado" text DEFAULT 'marcado' NOT NULL,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compromisso_interno" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tarefa_recepcao" (
	"id" text PRIMARY KEY NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"setor" text NOT NULL,
	"dados" jsonb NOT NULL,
	"concluida_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tarefa_recepcao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "compromisso_interno" ADD CONSTRAINT "compromisso_interno_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa_recepcao" ADD CONSTRAINT "tarefa_recepcao_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;