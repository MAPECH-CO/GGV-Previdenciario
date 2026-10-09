CREATE TABLE "boas_vindas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"dados" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boas_vindas_pessoa_id_unique" UNIQUE("pessoa_id")
);
--> statement-breakpoint
ALTER TABLE "boas_vindas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cobranca_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"dados" jsonb NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cobranca_documento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conferencia_checklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"dados" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conferencia_checklist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "boas_vindas" ADD CONSTRAINT "boas_vindas_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boas_vindas" ADD CONSTRAINT "boas_vindas_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobranca_documento" ADD CONSTRAINT "cobranca_documento_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conferencia_checklist" ADD CONSTRAINT "conferencia_checklist_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;