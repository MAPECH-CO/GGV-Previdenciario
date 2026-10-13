ALTER TABLE "tarefa" ALTER COLUMN "caso_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tarefa" ADD COLUMN "pessoa_id" uuid;--> statement-breakpoint
ALTER TABLE "mensagem" ADD COLUMN "chatwoot_mensagem_id" bigint;--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD COLUMN "entrada" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD COLUMN "parcelas_quantidade" integer;--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD COLUMN "parcela_valor" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD COLUMN "parte_na_caixa" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD COLUMN "fontes" jsonb;--> statement-breakpoint
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mensagem_chatwoot" ON "mensagem" USING btree ("chatwoot_mensagem_id");--> statement-breakpoint
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_caso_ou_pessoa" CHECK ("tarefa"."caso_id" is not null or "tarefa"."pessoa_id" is not null);--> statement-breakpoint
-- GGVP-158 P6.7: a pendência aberta da conversa vira linha da tarefa (D5.05), com o id guardado na conversa. A do lead
-- fica só com a pessoa; quem ficou com ela segue o responsável, e o primeiro perfil dele é o dono. Rodar de novo não repete.
WITH "pendente" AS (
	SELECT gen_random_uuid() AS "tarefa_id", a."id" AS "atendimento_id", a."caso_id", a."pessoa_id", u."id" AS "responsavel_id",
		u."perfis"[1] AS "perfil", (a."dados"->'pendencia'->>'prazo')::date AS "prazo"
	FROM "atendimento" a
	LEFT JOIN "usuario" u ON u."id"::text = a."dados"->'pendencia'->>'responsavelId'
	WHERE jsonb_typeof(a."dados"->'pendencia') = 'object'
		AND coalesce(a."dados"->'pendencia'->>'cumpridaEm', '') = ''
		AND NOT (a."dados"->'pendencia' ? 'tarefaId')
), "criadas" AS (
	INSERT INTO "tarefa" ("id", "caso_id", "pessoa_id", "passo", "titulo", "perfil_dono", "responsavel_id", "prazo")
	SELECT "tarefa_id", "caso_id", "pessoa_id", 'D5.05', 'Cumprir pendência da conversa', "perfil", "responsavel_id", "prazo" FROM "pendente"
	RETURNING "id"
)
UPDATE "atendimento" a SET "dados" = jsonb_set(a."dados", '{pendencia,tarefaId}', to_jsonb(p."tarefa_id"::text))
FROM "pendente" p WHERE a."id" = p."atendimento_id";