# Tasks

## GGVP-109 · Ninguém pula um portão de aprovação: validação no servidor

- [x] 1.1 Contratos `TentativaBloqueada` e `TentativasBloqueadas` em `packages/contratos/src/governanca.ts`; teste em `governanca.test.ts`; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 1.2 CA1, CA2, CA4, CA5, CA6, CA7, CA9 · Teste da API em `apps/api/src/rotas/gestao.test.ts`: cada recusa grava o portão e o passo, sem dado de saúde, e aparece na lista da gestão; quem não tem `gestao.ver` recebe 403.
- [x] 1.3 CA1, CA2, CA4, CA6, CA7, CA9 · Servidor: `portao` e `passo` nas recusas que já gravavam (`inss.ts`, `conferencia.ts`, `manifestacao.ts`, `peticao.ts`), `portao_bloqueado` onde faltava (`exigencia.ts`, `manifestacao.ts`, `peticao.ts`, `prestacao.ts`), o caso no `acesso_negado` (`sessao/rotas.ts`) e GET `/api/gestao/tentativas` em `apps/api/src/rotas/gestao.ts`; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.4 CA9 · Tela "Tentativas bloqueadas" em `apps/web/src/paginas/Tentativas.tsx`, rota `/gestao/tentativas` e link no topo da Central para `gestao.ver`; teste de tela.
- [x] 1.5 CA3 · Botão principal desabilitado até a conferência em `Protocolar.tsx`, `Manifestar.tsx` e `PrestarContas.tsx`; testes de tela.
- [x] 1.6 Playwright em `apps/web/e2e/governanca.e2e.ts`: o Atendimento chama direto pela API uma ação fora do perfil, o servidor recusa, e a Sênior vê a tentativa, com o cliente, em "Tentativas bloqueadas".
- [x] 1.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-25 · Regras objetivas calculadas por código

- [x] 2.1 Contratos `REGRAS`, `EntradaLoas24`, `EntradaIncapacidade`, `EntradaPcd`, `EntradaDii` e `ResultadoDaRegra` em `packages/contratos/src/governanca.ts`; teste.
- [x] 2.2 CA1 a CA5, CA8 · Regras em `apps/api/src/fluxo/regras.ts` (24 meses, 15 dias na janela de 60, períodos PCD, DII × carência e qualidade, "não calculável: falta X"), com teste em `regras.test.ts`.
- [x] 2.3 CA6, CA7 · POST `/api/regras/:regra` (`laudo.conferir`) em `apps/api/src/rotas/regras.ts`, devolvendo entradas, fundamento e versão; teste. A tela é a conferência médica do Pedro, que chama esta rota.
- [x] 2.4 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
