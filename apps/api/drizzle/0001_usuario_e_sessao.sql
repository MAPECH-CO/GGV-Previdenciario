CREATE TABLE "sessao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessao_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nome" text NOT NULL,
	"senha_hash" text NOT NULL,
	"perfil" text,
	"trocar_senha" boolean DEFAULT true NOT NULL,
	"tentativas_erradas" integer DEFAULT 0 NOT NULL,
	"travado_ate" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;