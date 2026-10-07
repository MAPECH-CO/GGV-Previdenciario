# Tasks

## GGVP-106 · Guardrails de IA e do chat

- [x] 1.1 CA2, CA4 · Contratos em `packages/contratos/src/ia.ts`: `SugestaoDaIa`, `ChamadaDaIa`; testes.
- [x] 1.2 CA4 · Banco: tabela `chamada_ia` com RLS, migração 0013; teste das migrações (46 tabelas).
- [x] 1.3 CA1, CA2, CA4, CA11 · Servidor `apps/api/src/ia/`: `sugerir` (OpenAI) e `lerDocumento` (Mistral), `fetch` injetado; desligada sem chave; recusa dado de saúde sem autorização; registro de toda chamada; instrução com a regra dos números; testes sem serviço de verdade.
- [x] 1.4 CA4 · `GET /api/casos/:id/ia`: auditoria para a gestão e o Jurídico; saída só para quem vê dado de saúde, com o acesso registrado; testes.
- [x] 1.5 `pnpm dev` da API lê também o `.env.ia`; o módulo lê as chaves do ambiente (`process.env`) por padrão. A primeira rota que usar a IA instancia o módulo.
- [x] 1.6 Rodar typecheck, lint e testes (sem tela nesta história); colar a saída; perguntar "Agora ok?".

## GGVP-110 · Conteúdo malicioso não manipula a IA

- [x] 2.1 CA3 · Banco: coluna `alerta` em `chamada_ia` (migração 0014); `SugestaoDaIa` ganha `alerta`.
- [x] 2.2 CA1, CA3, CA7 · Servidor: detector de instrução suspeita na entrada e na saída e de CID na saída; alerta na chamada e no histórico do caso (`ia_alerta`); saída com CID barrada; testes de ataque.
- [x] 2.3 CA1, CA10 · Teste: publicação com instrução escondida, sugestão da IA e a publicação continua sem classe até a advogada classificar.
- [x] 2.4 Rodar typecheck, lint e testes; colar a saída; perguntar "Agora ok?".

## GGVP-34 e GGVP-74 · A IA na leitura da publicação

- [x] 3.1 Contrato `SugestaoDePublicacao` em `packages/contratos/src/justica.ts`; a finalidade `classificar_publicacao` responde em JSON (classe, dias, resumo).
- [x] 3.2 Servidor: a API monta a IA (`criarServidor` aceita uma IA de teste); `POST /api/publicacoes/:id/sugestao` (perfil `publicacao.classificar`) confere o formato e guarda a classe sugerida; nada classifica; testes com IA falsa.
- [x] 3.3 Tela "Ler publicação": "Sugerir com a IA", a sugestão marcada, o resumo, o alerta e "Usar a sugestão"; testes de tela.
- [x] 3.4 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
