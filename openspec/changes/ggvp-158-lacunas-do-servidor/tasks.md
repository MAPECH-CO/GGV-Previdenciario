# Tasks

<!-- Uma história (GGVP-158), um requisito por lacuna (L1 a L3), na ordem: teste que falha → servidor → tela → Playwright.
     O L1 só corrige se o teste mostrar o vazamento. O que espera decisão fica em `docs/requisitos/duvidas-abertas.md`. -->

## GGVP-158 · Lacunas graves do servidor sem PR (16/10)

- [x] 1.1 L1 · O teste primeiro, em `apps/api/src/rotas/chat.test.ts`:
  - o acervo com uma transcrição conferida de entrevista que não é só do Jurídico e um modelo de petição;
  - o Financeiro, a Documentação e o Atendimento perguntam, e o modelo pede `buscar_no_acervo`;
  - nada do acervo chega ao modelo.

  Rodar sem a correção e colar a saída (prova ou desprova). Verifica com `pnpm --filter @ggv/api exec vitest run src/rotas/chat.test.ts`.

  Verificado em 16/10, sem a correção: o teste falhou e provou o vazamento. Para os três perfis, a ferramenta ia ao modelo, e o trecho da transcrição ("roça em março") e o modelo de petição chegavam a ele (`acervo`, `transcricao` e `modelo` vieram `true` para `julia`, `dora` e `ana`).
- [x] 1.2 L1 · Se o 1.1 falhou: `apps/api/src/rotas/chat.ts`, a ferramenta só com `peticao.ver`. O teste 16.4 passa a esperar três ferramentas para o Atendimento; o da advogada segue achando o trecho. Verifica com o mesmo comando.

  Verificado em 16/10: `chat.test.ts` e `ia/acervo.test.ts` 53/53.
- [ ] 1.3 L2 · `packages/contratos/src/prestacao.ts`:
  - `SalvarPrestacao` com `conferiHonorarios`, `conferiDadosBancarios` e `revisouAviso`;
  - `PrestacaoDoCaso` com `aviso`.

  Teste em `packages/contratos/src/prestacao.test.ts` (cada conferência faltando recusa com a sua mensagem). Verifica com `pnpm --filter @ggv/contratos exec vitest run src/prestacao.test.ts`.
- [ ] 1.4 L2 · `apps/api/src/rotas/prestacao.ts`: o `GET` traz o texto do modelo ativo da ida ao banco. Teste em `apps/api/src/rotas/prestacao.test.ts`:
  - sem uma conferência, 400 e nada gravado;
  - com as quatro, 201;
  - o `GET` traz o aviso.

  Verifica com `pnpm --filter @ggv/api exec vitest run src/rotas/prestacao.test.ts`.
- [ ] 1.5 L3 · `apps/api/src/rotas/prestacao.ts`: pedido de dados bancários sem confirmação, 409 antes de gravar. Teste no mesmo arquivo: 409 sem versão nem tarefa; depois da segunda confirmação, 201. Verifica com o mesmo comando.
- [ ] 1.6 L2 · `apps/web/src/paginas/PrestarContas.tsx`:
  - as três caixas novas;
  - o texto do aviso;
  - o botão só com as quatro.

  Teste em `apps/web/src/paginas/PrestarContas.test.tsx`. Playwright: `apps/web/e2e/fechamento-financeiro.e2e.ts` marca as quatro. Verifica com `pnpm --filter @ggv/web exec vitest run src/paginas/PrestarContas.test.tsx` e `pnpm --filter @ggv/web exec playwright test e2e/fechamento-financeiro.e2e.ts`.
- [ ] 1.7 As perguntas em `docs/requisitos/duvidas-abertas.md`:
  - o CA1 e o prazo do CA10 da GGVP-92 (Lucas);
  - o scanner simulado fora dos testes (Mateus, com o Pedro).
- [ ] 1.8 Rodar typecheck, lint, testes e Playwright; `openspec validate --all --strict`; colar a saída; perguntar "Agora ok?".
