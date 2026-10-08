CREATE TABLE "acesso_dado_sensivel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"perfil" text NOT NULL,
	"caso_id" uuid,
	"recurso" text NOT NULL,
	"quando" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acesso_dado_sensivel" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "consentimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"finalidade" text NOT NULL,
	"base_legal" text NOT NULL,
	"dado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"registrado_por" uuid,
	"revogado_em" timestamp with time zone,
	CONSTRAINT "consentimento_finalidade" CHECK ("consentimento"."finalidade" in ('atendimento', 'gravacao', 'mensagens', 'dado_saude'))
);
--> statement-breakpoint
ALTER TABLE "consentimento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "credencial_govbr" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"senha_cifrada" "bytea" NOT NULL,
	"iv" "bytea" NOT NULL,
	"renovar_ate" date,
	"atualizada_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "credencial_govbr_pessoa_id_unique" UNIQUE("pessoa_id")
);
--> statement-breakpoint
ALTER TABLE "credencial_govbr" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pessoa_vinculo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"vinculada_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pessoa_vinculo_tipo" CHECK ("pessoa_vinculo"."tipo" in ('responsavel_legal', 'curador', 'familiar', 'procurador'))
);
--> statement-breakpoint
ALTER TABLE "pessoa_vinculo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "agendamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"caso_id" uuid,
	"tipo" text NOT NULL,
	"quando" timestamp with time zone NOT NULL,
	"local" text,
	"situacao" text DEFAULT 'marcado' NOT NULL,
	"confirmado_em" timestamp with time zone,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agendamento_tipo" CHECK ("agendamento"."tipo" in ('entrevista', 'ida_ao_banco', 'retirada', 'retorno')),
	CONSTRAINT "agendamento_situacao" CHECK ("agendamento"."situacao" in ('marcado', 'confirmado', 'realizado', 'faltou', 'cancelado'))
);
--> statement-breakpoint
ALTER TABLE "agendamento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "atendimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"caso_id" uuid,
	"canal" text NOT NULL,
	"responsavel_id" uuid,
	"inicio" timestamp with time zone NOT NULL,
	"fim" timestamp with time zone,
	"aviso_gravacao_em" timestamp with time zone,
	"gravacao_documento_id" uuid,
	"transcricao_documento_id" uuid,
	"resumo" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "atendimento_canal" CHECK ("atendimento"."canal" in ('presencial', 'telefone', 'whatsapp', 'video'))
);
--> statement-breakpoint
ALTER TABLE "atendimento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ficha_atendimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"modelo" text NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"respostas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"preenchida_por" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ficha_atendimento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "identificador_caso" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"valor" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identificador_unico" UNIQUE("tipo","valor"),
	CONSTRAINT "identificador_tipo" CHECK ("identificador_caso"."tipo" in ('nb', 'protocolo_inss', 'cnj'))
);
--> statement-breakpoint
ALTER TABLE "identificador_caso" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decisao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"passo" text NOT NULL,
	"tipo" text NOT NULL,
	"resultado" text NOT NULL,
	"justificativa" text,
	"sugestao_ia" jsonb,
	"decidido_por" uuid NOT NULL,
	"perfil" text NOT NULL,
	"decidido_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decisao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "etapa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"diagrama" text NOT NULL,
	"passo" text NOT NULL,
	"situacao" text DEFAULT 'aberta' NOT NULL,
	"juncao" text,
	"chamada_por_id" uuid,
	"aguardando" text,
	"iniciada_em" timestamp with time zone DEFAULT now() NOT NULL,
	"concluida_em" timestamp with time zone,
	"concluida_por" uuid,
	CONSTRAINT "etapa_diagrama" CHECK ("etapa"."diagrama" in ('D1', 'D2', 'D3', 'D3a', 'D3b', 'D4', 'DP')),
	CONSTRAINT "etapa_situacao" CHECK ("etapa"."situacao" in ('aberta', 'aguardando_externo', 'concluida', 'cancelada'))
);
--> statement-breakpoint
ALTER TABLE "etapa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "evento_externo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fonte" text NOT NULL,
	"chave_externa" text NOT NULL,
	"caso_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recebido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"processado_em" timestamp with time zone,
	CONSTRAINT "evento_externo_unico" UNIQUE("fonte","chave_externa")
);
--> statement-breakpoint
ALTER TABLE "evento_externo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tentativa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tarefa_id" uuid NOT NULL,
	"quando" timestamp with time zone DEFAULT now() NOT NULL,
	"canal" text,
	"resultado" text NOT NULL,
	"registrada_por" uuid
);
--> statement-breakpoint
ALTER TABLE "tentativa" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contrato" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"modelo_id" uuid,
	"modelo_versao" integer,
	"situacao" text DEFAULT 'rascunho' NOT NULL,
	"assinatura" text,
	"zapsign_id" text,
	"documento_id" uuid,
	"conferido_por" uuid,
	"conferido_em" timestamp with time zone,
	"assinado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contrato_zapsign_id_unique" UNIQUE("zapsign_id"),
	CONSTRAINT "contrato_situacao" CHECK ("contrato"."situacao" in ('rascunho', 'conferido', 'enviado', 'assinado', 'cancelado'))
);
--> statement-breakpoint
ALTER TABLE "contrato" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pessoa_id" uuid,
	"caso_id" uuid,
	"tipo" text NOT NULL,
	"sensivel" boolean DEFAULT false NOT NULL,
	"chave_armazenamento" text NOT NULL,
	"nome_original" text NOT NULL,
	"mime" text NOT NULL,
	"tamanho" bigint NOT NULL,
	"hash_sha256" text NOT NULL,
	"origem" text NOT NULL,
	"situacao" text DEFAULT 'recebido' NOT NULL,
	"recebido_por" uuid,
	"conferido_por" uuid,
	"conferido_em" timestamp with time zone,
	"excluido_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documento_chave_armazenamento_unique" UNIQUE("chave_armazenamento"),
	CONSTRAINT "documento_situacao" CHECK ("documento"."situacao" in ('recebido', 'conferido', 'recusado'))
);
--> statement-breakpoint
ALTER TABLE "documento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "documento_medico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"data_emissao" date,
	"profissional" text,
	"registro_profissional" text,
	"cid" text,
	"itens_atendidos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sugestao_ia" jsonb,
	"confirmado_por" uuid,
	"confirmado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documento_medico_documento_id_unique" UNIQUE("documento_id"),
	CONSTRAINT "documento_medico_tipo" CHECK ("documento_medico"."tipo" in ('atestado', 'relatorio', 'laudo', 'prontuario', 'exame'))
);
--> statement-breakpoint
ALTER TABLE "documento_medico" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "parecer_medico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"roteiro_versao" integer NOT NULL,
	"resultado" text NOT NULL,
	"itens" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sugestao_ia" jsonb,
	"confirmado_por" uuid,
	"confirmado_em" timestamp with time zone,
	"justificativa_dispensa" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parecer_resultado" CHECK ("parecer_medico"."resultado" in ('suficiente', 'insuficiente', 'contraditorio', 'dispensado'))
);
--> statement-breakpoint
ALTER TABLE "parecer_medico" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exigencia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"origem" text NOT NULL,
	"descricao" text NOT NULL,
	"recebida_em" date NOT NULL,
	"prazo" date,
	"publicacao_id" uuid,
	"situacao" text DEFAULT 'aberta' NOT NULL,
	"analisada_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exigencia_origem" CHECK ("exigencia"."origem" in ('inss', 'juizo')),
	CONSTRAINT "exigencia_situacao" CHECK ("exigencia"."situacao" in ('aberta', 'cumprida', 'vencida', 'dilacao_pedida'))
);
--> statement-breakpoint
ALTER TABLE "exigencia" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "exigencia_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exigencia_id" uuid NOT NULL,
	"descricao" text NOT NULL,
	"perfil_responsavel" text NOT NULL,
	"responsavel_id" uuid,
	"prazo" date,
	"prova_documento_id" uuid,
	"cumprido_em" timestamp with time zone,
	"cumprido_por" uuid
);
--> statement-breakpoint
ALTER TABLE "exigencia_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "pericia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"chamada_por_etapa_id" uuid,
	"agendada_para" timestamp with time zone,
	"local" text,
	"comprovante_documento_id" uuid,
	"perito_id" uuid,
	"compareceu" boolean,
	"remarcacoes" integer DEFAULT 0 NOT NULL,
	"resultado" text,
	"resultado_documento_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pericia_tipo" CHECK ("pericia"."tipo" in ('medica', 'social')),
	CONSTRAINT "pericia_resultado" CHECK ("pericia"."resultado" in ('favoravel', 'desfavoravel'))
);
--> statement-breakpoint
ALTER TABLE "pericia" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "requerimento_inss" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"der" date NOT NULL,
	"servico" text,
	"comprovante_documento_id" uuid NOT NULL,
	"revisado_antes_de_enviar" boolean NOT NULL,
	"registrado_por" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requerimento_inss_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
ALTER TABLE "requerimento_inss" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resultado_inss" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"resultado" text NOT NULL,
	"data_decisao" date NOT NULL,
	"beneficio_concedido" text,
	"motivo_indeferimento" text,
	"documento_id" uuid,
	"registrado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resultado_inss_resultado" CHECK ("resultado_inss"."resultado" in ('deferido', 'indeferido'))
);
--> statement-breakpoint
ALTER TABLE "resultado_inss" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "peticao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"pedida_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "peticao_tipo" CHECK ("peticao"."tipo" in ('inicial', 'manifestacao', 'recurso', 'dilacao'))
);
--> statement-breakpoint
ALTER TABLE "peticao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "peticao_versao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"peticao_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"conteudo" text NOT NULL,
	"hash" text NOT NULL,
	"gerada_por" text NOT NULL,
	"pedido_de_mudanca" text,
	"aprovada_por" uuid,
	"aprovada_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "peticao_versao_unica" UNIQUE("peticao_id","numero")
);
--> statement-breakpoint
ALTER TABLE "peticao_versao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "prazo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"origem" text NOT NULL,
	"publicacao_id" uuid,
	"inicio" date NOT NULL,
	"fim" date NOT NULL,
	"regra" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "prazo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "protocolo_judicial" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"peticao_versao_id" uuid NOT NULL,
	"tribunal" text NOT NULL,
	"numero" text,
	"protocolado_em" timestamp with time zone NOT NULL,
	"comprovante_documento_id" uuid,
	"protocolado_por" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "protocolo_judicial" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "publicacao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fonte" text NOT NULL,
	"numero_cnj" text,
	"caso_id" uuid,
	"disponibilizada_em" date NOT NULL,
	"texto" text NOT NULL,
	"hash" text NOT NULL,
	"classe" text,
	"classe_sugerida_ia" text,
	"confianca_ia" numeric(4, 3),
	"revisada_por" uuid,
	"revisada_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "publicacao_hash_unique" UNIQUE("hash"),
	CONSTRAINT "publicacao_classe" CHECK ("publicacao"."classe" in ('andamento', 'exigencia', 'merito'))
);
--> statement-breakpoint
ALTER TABLE "publicacao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rodada_vigilia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fonte" text NOT NULL,
	"prevista_para" timestamp with time zone NOT NULL,
	"inicio" timestamp with time zone,
	"fim" timestamp with time zone,
	"situacao" text DEFAULT 'prevista' NOT NULL,
	"capturadas" integer DEFAULT 0 NOT NULL,
	"erro" text,
	"reprocessada_por" uuid,
	CONSTRAINT "rodada_unica" UNIQUE("fonte","prevista_para"),
	CONSTRAINT "rodada_situacao" CHECK ("rodada_vigilia"."situacao" in ('prevista', 'rodando', 'ok', 'falhou', 'nao_rodou'))
);
--> statement-breakpoint
ALTER TABLE "rodada_vigilia" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "configuracao" (
	"chave" text PRIMARY KEY NOT NULL,
	"valor" jsonb NOT NULL,
	"alterado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "configuracao" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "feriado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data" date NOT NULL,
	"tribunal" text,
	"descricao" text NOT NULL,
	CONSTRAINT "feriado_unico" UNIQUE("data","tribunal")
);
--> statement-breakpoint
ALTER TABLE "feriado" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "juizo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tribunal" text NOT NULL,
	"nome" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "juizo_unico" UNIQUE("tribunal","nome")
);
--> statement-breakpoint
ALTER TABLE "juizo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "kit_documento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"beneficio" text NOT NULL,
	"tipo_documento" text NOT NULL,
	"obrigatorio" boolean DEFAULT true NOT NULL,
	CONSTRAINT "kit_unico" UNIQUE("beneficio","tipo_documento")
);
--> statement-breakpoint
ALTER TABLE "kit_documento" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "mensagem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"caso_id" uuid,
	"canal" text NOT NULL,
	"modelo_id" uuid,
	"conteudo" text NOT NULL,
	"aprovada_por" uuid,
	"enviada_por" uuid,
	"enviada_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mensagem_canal" CHECK ("mensagem"."canal" in ('whatsapp', 'sms', 'email', 'telefone'))
);
--> statement-breakpoint
ALTER TABLE "mensagem" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "modelo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"nome" text NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"conteudo" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modelo_versao_unica" UNIQUE("tipo","nome","versao"),
	CONSTRAINT "modelo_tipo" CHECK ("modelo"."tipo" in ('contrato', 'mensagem', 'peticao'))
);
--> statement-breakpoint
ALTER TABLE "modelo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "perito" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"nome_normalizado" text NOT NULL,
	"grafias" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"especialidade" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "perito_nome_normalizado_unique" UNIQUE("nome_normalizado")
);
--> statement-breakpoint
ALTER TABLE "perito" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "prestacao_contas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"caso_id" uuid NOT NULL,
	"valor_recebido" numeric(14, 2) NOT NULL,
	"honorarios" numeric(14, 2) NOT NULL,
	"valor_cliente" numeric(14, 2) NOT NULL,
	"ok_advogada_por" uuid,
	"ok_advogada_em" timestamp with time zone,
	"recebida_por" uuid,
	"recebida_em" timestamp with time zone,
	"cliente_avisado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prestacao_pessoas_diferentes" CHECK ("prestacao_contas"."ok_advogada_por" is null or "prestacao_contas"."recebida_por" is null or "prestacao_contas"."ok_advogada_por" <> "prestacao_contas"."recebida_por"),
	CONSTRAINT "prestacao_aviso_depois_do_ok" CHECK ("prestacao_contas"."cliente_avisado_em" is null or "prestacao_contas"."ok_advogada_em" is not null)
);
--> statement-breakpoint
ALTER TABLE "prestacao_contas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "processo_acervo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero_cnj" text,
	"caso_id" uuid,
	"beneficio" text,
	"perito_id" uuid,
	"juizo_id" uuid,
	"desfecho" text,
	"desfecho_conferido_por" uuid,
	"data_decisao" date,
	"fonte" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processo_acervo_numero_cnj_unique" UNIQUE("numero_cnj")
);
--> statement-breakpoint
ALTER TABLE "processo_acervo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "roteiro_laudo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"beneficio" text NOT NULL,
	"versao" integer NOT NULL,
	"itens" jsonb NOT NULL,
	"vigente_desde" date NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roteiro_versao_unica" UNIQUE("beneficio","versao")
);
--> statement-breakpoint
ALTER TABLE "roteiro_laudo" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "caso" ALTER COLUMN "beneficio" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "caso" ADD COLUMN "fase" text DEFAULT 'atendimento' NOT NULL;--> statement-breakpoint
ALTER TABLE "caso" ADD COLUMN "advogada_responsavel_id" uuid;--> statement-breakpoint
ALTER TABLE "caso" ADD COLUMN "desfecho" text;--> statement-breakpoint
ALTER TABLE "caso" ADD COLUMN "causa_desfecho" text;--> statement-breakpoint
ALTER TABLE "caso" ADD COLUMN "encerrado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "caso" ADD COLUMN "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "data_nascimento" date;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "telefone" text;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "telefone_2" text;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "cep" text;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "logradouro" text;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "numero" text;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "complemento" text;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "bairro" text;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "cidade" text;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "uf" text;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "situacao" text DEFAULT 'lead' NOT NULL;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "motivo_nao_virou" text;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "origem" text;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "anonimizado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pessoa" ADD COLUMN "atualizado_em" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tarefa" ADD COLUMN "etapa_id" uuid;--> statement-breakpoint
ALTER TABLE "tarefa" ADD COLUMN "passo" text;--> statement-breakpoint
ALTER TABLE "tarefa" ADD COLUMN "perfil_dono" text;--> statement-breakpoint
ALTER TABLE "tarefa" ADD COLUMN "responsavel_id" uuid;--> statement-breakpoint
ALTER TABLE "tarefa" ADD COLUMN "situacao" text DEFAULT 'aberta' NOT NULL;--> statement-breakpoint
ALTER TABLE "tarefa" ADD COLUMN "prazo_processual_id" uuid;--> statement-breakpoint
ALTER TABLE "tarefa" ADD COLUMN "tentativas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tarefa" ADD COLUMN "limite_tentativas" integer;--> statement-breakpoint
ALTER TABLE "tarefa" ADD COLUMN "escalada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tarefa" ADD COLUMN "escalada_para" text;--> statement-breakpoint
ALTER TABLE "tarefa" ADD COLUMN "evidencia_documento_id" uuid;--> statement-breakpoint
ALTER TABLE "tarefa" ADD COLUMN "concluida_por" uuid;--> statement-breakpoint
ALTER TABLE "acesso_dado_sensivel" ADD CONSTRAINT "acesso_dado_sensivel_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimento" ADD CONSTRAINT "consentimento_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimento" ADD CONSTRAINT "consentimento_registrado_por_usuario_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credencial_govbr" ADD CONSTRAINT "credencial_govbr_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credencial_govbr" ADD CONSTRAINT "credencial_govbr_atualizada_por_usuario_id_fk" FOREIGN KEY ("atualizada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa_vinculo" ADD CONSTRAINT "pessoa_vinculo_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoa_vinculo" ADD CONSTRAINT "pessoa_vinculo_vinculada_id_pessoa_id_fk" FOREIGN KEY ("vinculada_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agendamento" ADD CONSTRAINT "agendamento_criado_por_usuario_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_responsavel_id_usuario_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ficha_atendimento" ADD CONSTRAINT "ficha_atendimento_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identificador_caso" ADD CONSTRAINT "identificador_caso_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisao" ADD CONSTRAINT "decisao_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisao" ADD CONSTRAINT "decisao_decidido_por_usuario_id_fk" FOREIGN KEY ("decidido_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etapa" ADD CONSTRAINT "etapa_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etapa" ADD CONSTRAINT "etapa_concluida_por_usuario_id_fk" FOREIGN KEY ("concluida_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_externo" ADD CONSTRAINT "evento_externo_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentativa" ADD CONSTRAINT "tentativa_tarefa_id_tarefa_id_fk" FOREIGN KEY ("tarefa_id") REFERENCES "public"."tarefa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tentativa" ADD CONSTRAINT "tentativa_registrada_por_usuario_id_fk" FOREIGN KEY ("registrada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_documento_id_documento_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_conferido_por_usuario_id_fk" FOREIGN KEY ("conferido_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_recebido_por_usuario_id_fk" FOREIGN KEY ("recebido_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento" ADD CONSTRAINT "documento_conferido_por_usuario_id_fk" FOREIGN KEY ("conferido_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_medico" ADD CONSTRAINT "documento_medico_documento_id_documento_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_medico" ADD CONSTRAINT "documento_medico_confirmado_por_usuario_id_fk" FOREIGN KEY ("confirmado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parecer_medico" ADD CONSTRAINT "parecer_medico_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parecer_medico" ADD CONSTRAINT "parecer_medico_confirmado_por_usuario_id_fk" FOREIGN KEY ("confirmado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exigencia" ADD CONSTRAINT "exigencia_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exigencia" ADD CONSTRAINT "exigencia_analisada_por_usuario_id_fk" FOREIGN KEY ("analisada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exigencia_item" ADD CONSTRAINT "exigencia_item_exigencia_id_exigencia_id_fk" FOREIGN KEY ("exigencia_id") REFERENCES "public"."exigencia"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exigencia_item" ADD CONSTRAINT "exigencia_item_responsavel_id_usuario_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exigencia_item" ADD CONSTRAINT "exigencia_item_prova_documento_id_documento_id_fk" FOREIGN KEY ("prova_documento_id") REFERENCES "public"."documento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exigencia_item" ADD CONSTRAINT "exigencia_item_cumprido_por_usuario_id_fk" FOREIGN KEY ("cumprido_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pericia" ADD CONSTRAINT "pericia_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pericia" ADD CONSTRAINT "pericia_chamada_por_etapa_id_etapa_id_fk" FOREIGN KEY ("chamada_por_etapa_id") REFERENCES "public"."etapa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pericia" ADD CONSTRAINT "pericia_comprovante_documento_id_documento_id_fk" FOREIGN KEY ("comprovante_documento_id") REFERENCES "public"."documento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pericia" ADD CONSTRAINT "pericia_resultado_documento_id_documento_id_fk" FOREIGN KEY ("resultado_documento_id") REFERENCES "public"."documento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requerimento_inss" ADD CONSTRAINT "requerimento_inss_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requerimento_inss" ADD CONSTRAINT "requerimento_inss_comprovante_documento_id_documento_id_fk" FOREIGN KEY ("comprovante_documento_id") REFERENCES "public"."documento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requerimento_inss" ADD CONSTRAINT "requerimento_inss_registrado_por_usuario_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resultado_inss" ADD CONSTRAINT "resultado_inss_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resultado_inss" ADD CONSTRAINT "resultado_inss_documento_id_documento_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resultado_inss" ADD CONSTRAINT "resultado_inss_registrado_por_usuario_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peticao" ADD CONSTRAINT "peticao_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peticao" ADD CONSTRAINT "peticao_pedida_por_usuario_id_fk" FOREIGN KEY ("pedida_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peticao_versao" ADD CONSTRAINT "peticao_versao_peticao_id_peticao_id_fk" FOREIGN KEY ("peticao_id") REFERENCES "public"."peticao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peticao_versao" ADD CONSTRAINT "peticao_versao_aprovada_por_usuario_id_fk" FOREIGN KEY ("aprovada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prazo" ADD CONSTRAINT "prazo_publicacao_id_publicacao_id_fk" FOREIGN KEY ("publicacao_id") REFERENCES "public"."publicacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocolo_judicial" ADD CONSTRAINT "protocolo_judicial_peticao_versao_id_peticao_versao_id_fk" FOREIGN KEY ("peticao_versao_id") REFERENCES "public"."peticao_versao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocolo_judicial" ADD CONSTRAINT "protocolo_judicial_comprovante_documento_id_documento_id_fk" FOREIGN KEY ("comprovante_documento_id") REFERENCES "public"."documento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocolo_judicial" ADD CONSTRAINT "protocolo_judicial_protocolado_por_usuario_id_fk" FOREIGN KEY ("protocolado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_revisada_por_usuario_id_fk" FOREIGN KEY ("revisada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rodada_vigilia" ADD CONSTRAINT "rodada_vigilia_reprocessada_por_usuario_id_fk" FOREIGN KEY ("reprocessada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configuracao" ADD CONSTRAINT "configuracao_alterado_por_usuario_id_fk" FOREIGN KEY ("alterado_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_pessoa_id_pessoa_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_aprovada_por_usuario_id_fk" FOREIGN KEY ("aprovada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_enviada_por_usuario_id_fk" FOREIGN KEY ("enviada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD CONSTRAINT "prestacao_contas_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD CONSTRAINT "prestacao_contas_ok_advogada_por_usuario_id_fk" FOREIGN KEY ("ok_advogada_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestacao_contas" ADD CONSTRAINT "prestacao_contas_recebida_por_usuario_id_fk" FOREIGN KEY ("recebida_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD CONSTRAINT "processo_acervo_caso_id_caso_id_fk" FOREIGN KEY ("caso_id") REFERENCES "public"."caso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD CONSTRAINT "processo_acervo_perito_id_perito_id_fk" FOREIGN KEY ("perito_id") REFERENCES "public"."perito"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD CONSTRAINT "processo_acervo_juizo_id_juizo_id_fk" FOREIGN KEY ("juizo_id") REFERENCES "public"."juizo"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processo_acervo" ADD CONSTRAINT "processo_acervo_desfecho_conferido_por_usuario_id_fk" FOREIGN KEY ("desfecho_conferido_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caso" ADD CONSTRAINT "caso_advogada_responsavel_id_usuario_id_fk" FOREIGN KEY ("advogada_responsavel_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_etapa_id_etapa_id_fk" FOREIGN KEY ("etapa_id") REFERENCES "public"."etapa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_responsavel_id_usuario_id_fk" FOREIGN KEY ("responsavel_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_concluida_por_usuario_id_fk" FOREIGN KEY ("concluida_por") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caso" ADD CONSTRAINT "caso_beneficio" CHECK ("caso"."beneficio" in ('bpc_loas_deficiente', 'bpc_loas_idoso', 'aposentadoria_pcd', 'aposentadoria_idade', 'aposentadoria_tempo', 'aposentadoria_especial', 'aposentadoria_incapacidade_permanente', 'auxilio_incapacidade_temporaria', 'auxilio_acidente', 'pensao_morte', 'salario_maternidade', 'outro'));--> statement-breakpoint
ALTER TABLE "caso" ADD CONSTRAINT "caso_fase" CHECK ("caso"."fase" in ('atendimento', 'administrativa', 'judicial', 'encerrado'));--> statement-breakpoint
ALTER TABLE "caso" ADD CONSTRAINT "caso_desfecho" CHECK ("caso"."desfecho" in ('deferido', 'procedente_total', 'procedente_parcial', 'improcedente', 'extinto_sem_merito', 'desistencia'));--> statement-breakpoint
ALTER TABLE "pessoa" ADD CONSTRAINT "pessoa_situacao" CHECK ("pessoa"."situacao" in ('lead', 'cliente', 'nao_virou_cliente'));--> statement-breakpoint
ALTER TABLE "tarefa" ADD CONSTRAINT "tarefa_situacao" CHECK ("tarefa"."situacao" in ('aberta', 'em_andamento', 'aguardando', 'concluida', 'cancelada'));