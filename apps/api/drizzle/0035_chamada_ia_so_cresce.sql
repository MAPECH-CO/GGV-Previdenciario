-- GGVP-158 P8.2: o registro das chamadas da IA só cresce (GGVP-106 CA4), como o histórico: ninguém altera nem apaga
-- uma chamada, nem a própria API. A função é a do histórico (0004).
CREATE TRIGGER chamada_ia_so_cresce
  BEFORE UPDATE OR DELETE ON "chamada_ia"
  FOR EACH ROW EXECUTE FUNCTION historico_so_cresce();
