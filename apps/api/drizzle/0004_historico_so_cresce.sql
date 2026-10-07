-- O histórico só cresce (GGVP-99, LGPD): ninguém altera nem apaga um evento, nem a própria API.
CREATE OR REPLACE FUNCTION historico_so_cresce() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'O histórico não pode ser alterado nem apagado (%).', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER evento_auditoria_so_cresce
  BEFORE UPDATE OR DELETE ON "evento_auditoria"
  FOR EACH ROW EXECUTE FUNCTION historico_so_cresce();
--> statement-breakpoint
CREATE TRIGGER acesso_dado_sensivel_so_cresce
  BEFORE UPDATE OR DELETE ON "acesso_dado_sensivel"
  FOR EACH ROW EXECUTE FUNCTION historico_so_cresce();
