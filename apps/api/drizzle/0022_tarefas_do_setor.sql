CREATE TABLE "atribuicao_tarefa" (
	"tarefa_id" text PRIMARY KEY NOT NULL,
	"responsavel_id" uuid,
	"prazo" date,
	"prioridade" text DEFAULT 'normal' NOT NULL,
	"recado" text,
	"avisar" boolean DEFAULT true NOT NULL,
	"atribuida_por" uuid NOT NULL,
	"atribuida_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "atribuicao_tarefa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "atribuicao_tarefa" ADD CONSTRAINT "atribuicao_tarefa_responsavel_id_usuario_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atribuicao_tarefa" ADD CONSTRAINT "atribuicao_tarefa_atribuida_por_usuario_id_fk" FOREIGN KEY ("atribuida_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;