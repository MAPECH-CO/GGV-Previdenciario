ALTER TABLE "agendamento" ADD COLUMN "acompanhante_id" uuid;--> statement-breakpoint
ALTER TABLE "contrato" ADD COLUMN "percentual_honorarios" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "exigencia" ADD COLUMN "dias_inss" integer;--> statement-breakpoint
ALTER TABLE "exigencia" ADD COLUMN "pede" text;--> statement-breakpoint
ALTER TABLE "exigencia_item" ADD COLUMN "situacao" text DEFAULT 'pendente' NOT NULL;--> statement-breakpoint
ALTER TABLE "exigencia_item" ADD COLUMN "motivo" text;--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD COLUMN "versao" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD COLUMN "percentual_honorarios" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD COLUMN "forma_pagamento" text;--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD COLUMN "prazo_pagamento" date;--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD COLUMN "carta_documento_id" uuid;--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD COLUMN "divergencia" text;--> statement-breakpoint
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_acompanhante_id_usuario_id_fk" FOREIGN KEY ("acompanhante_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD CONSTRAINT "prestacao_contas_carta_documento_id_documento_id_fk" FOREIGN KEY ("carta_documento_id") REFERENCES "public"."documento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD CONSTRAINT "prestacao_versao_unica" UNIQUE("caso_id","versao");--> statement-breakpoint
ALTER TABLE "exigencia" ADD CONSTRAINT "exigencia_pede" CHECK ("exigencia"."pede" in ('documentos', 'pericia', 'pericia_e_documentos'));--> statement-breakpoint
ALTER TABLE "exigencia_item" ADD CONSTRAINT "exigencia_item_situacao" CHECK ("exigencia_item"."situacao" in ('pendente', 'cumprido', 'nao_cumprido'));