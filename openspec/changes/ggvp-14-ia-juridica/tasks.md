# Tasks

## GGVP-106 · Guardrails de IA e do chat

- [x] 1.1 CA2, CA4 · Contratos em `packages/contratos/src/ia.ts`: `SugestaoDaIa`, `ChamadaDaIa`; testes.
- [x] 1.2 CA4 · Banco: tabela `chamada_ia` com RLS, migração 0013; teste das migrações (46 tabelas).
- [x] 1.3 CA1, CA2, CA4, CA11 · Servidor `apps/api/src/ia/`: `sugerir` (OpenAI) e `lerDocumento` (Mistral), `fetch` injetado; desligada sem chave; recusa dado de saúde sem autorização; registro de toda chamada; instrução com a regra dos números; testes sem serviço de verdade.
- [x] 1.4 CA4 · `GET /api/casos/:id/ia`: auditoria para a gestão e o Jurídico; saída só para quem vê dado de saúde, com o acesso registrado; testes.
- [x] 1.5 `pnpm dev` da API lê também o `.env.ia`; o módulo lê as chaves do ambiente (`process.env`) por padrão. A primeira rota que usar a IA instancia o módulo.
- [x] 1.6 Rodar typecheck, lint e testes (sem tela nesta história); colar a saída; perguntar "Agora ok?".
