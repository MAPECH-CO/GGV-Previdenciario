-- GGVP-105 CA10: todo passo que abre, espera quem está fora, conclui ou é cancelado vira evento do histórico
-- (GGVP-99). O banco grava, então nenhuma rota esquece. Quem: quem concluiu, ou o sistema.
CREATE OR REPLACE FUNCTION passo_no_historico() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.situacao IS DISTINCT FROM OLD.situacao THEN
    INSERT INTO "evento_auditoria" ("quem", "acao", "alvo", "quando", "detalhe")
    VALUES (
      COALESCE(NEW.concluida_por::text, 'sistema'),
      'passo_' || NEW.situacao,
      'caso:' || NEW.caso_id,
      CASE WHEN TG_OP = 'INSERT' AND NEW.situacao IN ('aberta', 'aguardando_externo') THEN NEW.iniciada_em ELSE COALESCE(NEW.concluida_em, now()) END,
      jsonb_build_object('passo', NEW.passo, 'diagrama', NEW.diagrama)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER etapa_no_historico
  AFTER INSERT OR UPDATE OF situacao ON "etapa"
  FOR EACH ROW EXECUTE FUNCTION passo_no_historico();
