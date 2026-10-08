ALTER TABLE "kit_documento" DROP CONSTRAINT "kit_unico";--> statement-breakpoint
ALTER TABLE "kit_documento" ADD COLUMN "versao" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "kit_documento" ADD COLUMN "vigente_desde" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "kit_documento" ADD COLUMN "revogado_em" timestamp with time zone;--> statement-breakpoint
-- GGVP-104 CA6: o kit que já existe é a versão 1 e vale desde sempre, para os casos já abertos não perderem o checklist.
UPDATE "kit_documento" SET "vigente_desde" = '2000-01-01T00:00:00Z';--> statement-breakpoint
ALTER TABLE "kit_documento" ADD CONSTRAINT "kit_unico" UNIQUE("beneficio","tipo_documento","versao");