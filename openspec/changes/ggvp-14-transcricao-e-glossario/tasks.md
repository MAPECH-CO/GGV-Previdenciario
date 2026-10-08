# Tarefas · GGVP-14 Transcrição e glossário

## GGVP-143 · Glossário do escritório

- [x] 1.1 Contratos `TIPOS_DE_TERMO`, `TermoDoGlossario`, `SalvarTermo` e `GlossarioDoEscritorio` (`packages/contratos/src/glossario.ts`); matriz versão 16 (`glossario.editar`, só a Sênior); testes em `glossario.test.ts` e `permissoes.test.ts`.
- [x] 1.2 CA3 · Tabela `glossario_termo` com RLS e a migração com a semente (benefícios do catálogo, siglas, peritos e juízos); teste da semente em `apps/api/src/rotas/glossario.test.ts` e contagem em `migracoes.test.ts`.
- [x] 1.3 CA1, CA2 · Rotas GET, POST, PUT e DELETE do glossário com `exigir`, histórico por `registrarHistorico` e `termosDoGlossario` (`apps/api/src/rotas/glossario.ts`, `apps/api/src/fluxo/glossario.ts`); testes por perfil, do histórico e da leitura.
- [x] 1.4 Seção "Glossário do escritório" na Configuração (`apps/web/src/paginas/Configuracao.tsx`); testes de tela.
- [x] 1.5 Playwright: a Sênior acrescenta, corrige e tira um termo; a mudança aparece no histórico da configuração (`apps/web/e2e/glossario.e2e.ts`).
- [x] 1.6 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
