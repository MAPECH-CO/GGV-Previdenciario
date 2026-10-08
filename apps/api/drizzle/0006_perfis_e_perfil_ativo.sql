ALTER TABLE "sessao" ADD COLUMN "perfil_ativo" text;--> statement-breakpoint
ALTER TABLE "usuario" ADD COLUMN "perfis" text[] DEFAULT '{}' NOT NULL;