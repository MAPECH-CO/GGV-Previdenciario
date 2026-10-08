CREATE TABLE "dado_bancario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"banco" text NOT NULL,
	"agencia" text NOT NULL,
	"conta" text NOT NULL,
	"pix" text,
	"verificacao" text NOT NULL,
	"pedido_por" uuid NOT NULL,
	"pedido_em" timestamp with time zone NOT NULL,
	"confirmado_por" uuid,
	"confirmado_em" timestamp with time zone,
	"descartado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dado_bancario_verificacao" CHECK ("dado_bancario"."verificacao" in ('video', 'presencial')),
	CONSTRAINT "dado_bancario_pessoas_diferentes" CHECK ("dado_bancario"."confirmado_por" is null or "dado_bancario"."confirmado_por" <> "dado_bancario"."pedido_por")
);
--> statement-breakpoint
ALTER TABLE "dado_bancario" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "versao_campo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"caso_id" uuid,
	"onde" text NOT NULL,
	"campo" text NOT NULL,
	"valor" text NOT NULL,
	"quem" text NOT NULL,
	"quando" timestamp with time zone NOT NULL,
	"origem" text NOT NULL,
	"conversa_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "versao_campo_onde" CHECK ("versao_campo"."onde" in ('ficha', 'processo')),
	CONSTRAINT "versao_campo_origem" CHECK ("versao_campo"."origem" in ('antes', 'conversa', 'volta'))
);
--> statement-breakpoint
ALTER TABLE "versao_campo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "atendimento" ADD COLUMN "dados" jsonb;--> statement-breakpoint
ALTER TABLE "mensagem" ADD COLUMN "modelo" text;--> statement-breakpoint
ALTER TABLE "mensagem" ADD COLUMN "conversa_chatwoot" integer;--> statement-breakpoint
ALTER TABLE "mensagem" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "mensagem" ADD COLUMN "erro" text;--> statement-breakpoint
ALTER TABLE "dado_bancario" ADD CONSTRAINT "dado_bancario_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dado_bancario" ADD CONSTRAINT "dado_bancario_pedido_por_usuario_id_fk" FOREIGN KEY ("pedido_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dado_bancario" ADD CONSTRAINT "dado_bancario_confirmado_por_usuario_id_fk" FOREIGN KEY ("confirmado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versao_campo" ADD CONSTRAINT "versao_campo_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versao_campo" ADD CONSTRAINT "versao_campo_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versao_campo" ADD CONSTRAINT "versao_campo_conversa_id_atendimento_id_fk" FOREIGN KEY ("conversa_id") REFERENCES "public"."atendimento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_status" CHECK ("mensagem"."status" in ('enviada', 'entregue', 'lida', 'falhou'));