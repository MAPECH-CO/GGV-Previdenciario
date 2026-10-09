ALTER TABLE "pessoa" ADD COLUMN "drive_pasta_id" text;--> statement-breakpoint
ALTER TABLE "documento" ADD COLUMN "drive_arquivo_id" text;--> statement-breakpoint
ALTER TABLE "documento" ADD COLUMN "drive_pendente" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "peticao_versao" ADD COLUMN "pacote_drive_id" text;--> statement-breakpoint
-- GGVP-107: o documento que já existia não vai para o Drive de uma vez (dado de exemplo, arquivo antigo); só o que entra daqui em diante.
UPDATE "documento" SET "drive_pendente" = false;
