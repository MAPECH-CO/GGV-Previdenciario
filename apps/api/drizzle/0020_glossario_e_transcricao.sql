CREATE TABLE "glossario_termo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"termo" text NOT NULL,
	"tipo" text NOT NULL,
	"significado" text,
	"alterado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "glossario_termo_tipo" CHECK ("glossario_termo"."tipo" in ('beneficio', 'sigla', 'perito', 'juizo', 'outro'))
);
--> statement-breakpoint
ALTER TABLE "glossario_termo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chamada_ia" ADD COLUMN "audio_segundos" integer;--> statement-breakpoint
ALTER TABLE "chamada_ia" ADD COLUMN "custo_estimado" numeric(10, 4);--> statement-breakpoint
ALTER TABLE "glossario_termo" ADD CONSTRAINT "glossario_termo_alterado_por_usuario_id_fk" FOREIGN KEY ("alterado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "glossario_termo_unico" ON "glossario_termo" USING btree (lower("termo"));--> statement-breakpoint
-- GGVP-143 CA3: o glossário nasce com os benefícios do catálogo (ROTULO_BENEFICIO, menos "Outro"), as siglas mais usadas
-- e os peritos e juízos que o portal já conhece. Uma vez só: depois, termo novo é com a Sênior, pela Configuração.
INSERT INTO "glossario_termo" ("termo", "tipo", "significado") VALUES
	('BPC/LOAS Deficiente', 'beneficio', NULL),
	('BPC/LOAS Idoso', 'beneficio', NULL),
	('Aposentadoria da Pessoa com Deficiência', 'beneficio', NULL),
	('Aposentadoria por Idade', 'beneficio', NULL),
	('Aposentadoria por Tempo de Contribuição', 'beneficio', NULL),
	('Aposentadoria Especial', 'beneficio', NULL),
	('Aposentadoria por Incapacidade Permanente', 'beneficio', NULL),
	('Auxílio por Incapacidade Temporária', 'beneficio', NULL),
	('Auxílio-Acidente', 'beneficio', NULL),
	('Pensão por Morte', 'beneficio', NULL),
	('Salário-Maternidade', 'beneficio', NULL),
	('LOAS', 'sigla', 'Lei Orgânica da Assistência Social'),
	('BPC', 'sigla', 'Benefício de Prestação Continuada'),
	('CNIS', 'sigla', 'Cadastro Nacional de Informações Sociais'),
	('NB', 'sigla', 'Número do Benefício'),
	('DER', 'sigla', 'Data de Entrada do Requerimento'),
	('DIB', 'sigla', 'Data de Início do Benefício'),
	('RPV', 'sigla', 'Requisição de Pequeno Valor'),
	('CTC', 'sigla', 'Certidão de Tempo de Contribuição');--> statement-breakpoint
INSERT INTO "glossario_termo" ("termo", "tipo") SELECT "nome", 'perito' FROM "perito" ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "glossario_termo" ("termo", "tipo") SELECT "nome", 'juizo' FROM "juizo" ON CONFLICT DO NOTHING;
