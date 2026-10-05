# Tasks

## GGVP-118 · Base de código: stack (ADR-001), monorepo, banco de dados e CI

- [x] 1.1 CA1 · Escrever `docs/decisoes/ADR-001-base-de-codigo-e-stack.md` e tirar o 001 da lista de pendentes em `docs/decisoes/README.md`; verifica lendo o arquivo.
- [x] 1.2 CA3 · `git mv kit/campos packages/campos` e trocar os caminhos em `kit/instalar.ps1`, `kit/instalar.sh`, `kit/LEIA-ME.md` e `packages/campos/README.md`; verifica com `pnpm --filter @ggv/campos test`.
- [x] 1.3 CA2, CA3 · Criar `package.json` e `pnpm-workspace.yaml` na raiz (scripts `dev`, `typecheck`, `lint`, `test`) e gerar o `pnpm-lock.yaml`; verifica com `pnpm -r ls --depth -1`.
- [x] 1.4 CA3, CA6 · Criar `packages/contratos` com `Saude` e `Pessoa` (validados por `@ggv/campos`) e `src/contratos.test.ts`; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 1.5 CA2 · Criar `apps/api` com Fastify e `GET /saude` respondendo o contrato `Saude`, e `src/servidor.test.ts`; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.6 CA4 · Criar `apps/api/src/banco/esquema.ts`, gerar a migração em `apps/api/drizzle/` e o script `db:migrar`; teste `src/banco/migracoes.test.ts` aplica as migrações num Postgres em memória e confere as 4 tabelas; verifica com `pnpm --filter @ggv/api test`.
- [ ] 1.7 CA5 · Criar `.github/workflows/ci.yml` (typecheck, lint, testes, gitleaks); verifica no PR que o job roda e fica verde.
- [x] 1.8 CA2 · Rodar `pnpm dev` e conferir que a API responde em `/saude` e a tela abre em `localhost:5173`; verifica pela saída do `curl`.
- [x] 1.9 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
