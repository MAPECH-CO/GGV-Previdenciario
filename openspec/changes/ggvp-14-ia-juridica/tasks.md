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

## GGVP-63 · A IA escreve a versão 1 da petição inicial

- [x] 4.1 IA: finalidade `minuta_peticao` (leva dado de saúde; pode citar o CID que está no caso, por isso não barra CID); a regra de CID passa a valer por finalidade.
- [x] 4.2 Contratos: `PedirMinuta` e `MinutaDaIa`; `PedirPeticao` aceita `chamadaIaId`.
- [x] 4.3 Servidor: `POST /api/casos/:id/peticao/minuta` monta o conteúdo do caso e devolve a sugestão com as fontes, sem gravar petição; o pedido com `chamadaIaId` marca a versão 1 como "minuta da IA"; testes com IA falsa.
- [x] 4.4 Tela "Pedir a petição": "Escrever a versão 1 com a IA" preenche a caixa, com as fontes e os avisos; testes de tela.
- [x] 4.5 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-22 · A IA sugere o resumo do resultado ao cliente

- [x] 5.1 Contratos: `AprovarResumo` aceita `chamadaIaId`; resposta da sugestão (`SugestaoDoResumo`).
- [x] 5.2 Servidor: `POST /api/casos/:id/resultado/sugestao` (perfil `resultado.aprovar_resumo`), com o benefício, o desfecho e o texto da última decisão de mérito; não grava; a aprovação guarda a chamada em `sugestao_ia`; testes com IA falsa.
- [x] 5.3 Tela "Explicar o resultado": "Sugerir o resumo com a IA" preenche a caixa, com o selo; testes de tela.
- [x] 5.4 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-131 · Chance de êxito (primeiro recorte: conferência da Sênior)

- [x] 6.1 CA2 · Regra em código, com teste: `calcularChance` (favoráveis sobre decididos, sem desistência), em `apps/api/src/fluxo/chance.ts`.
- [x] 6.2 Contrato `ChanceDeExito`; finalidade `fatores_da_chance` (explica, não calcula).
- [x] 6.3 CA2, CA4, CA9, CA10 · `POST /api/casos/:id/chance` (perfil `caso.aprovar_para_inss`): desfechos conferidos do mesmo benefício, número com casos e base, fatores da IA, histórico `chance_mostrada`; testes com IA falsa.
- [x] 6.4 Tela da conferência: "Ver a chance de êxito", o número ou "sem casos parecidos na casa ainda", e os fatores como sugestão; testes de tela.
- [x] 6.5 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## Ajustes do teste no portal (07/10)

- [x] 7.1 GGVP-22: sem a publicação de mérito, a IA é avisada de que o motivo fica para a advogada; instrução `resumo_resultado` v3 (o porquê só do texto da decisão, senão "[completar: o motivo da decisão]"); teste.
- [x] 7.2 GGVP-131: o laudo novo vai à IA em frase inteira, não em "sim/não"; teste.
- [x] 7.3 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
