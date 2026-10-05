# Tasks

## GGVP-118 · Base de código: stack (ADR-001), monorepo, banco de dados e CI

- [x] 1.1 CA1 · Escrever `docs/decisoes/ADR-001-base-de-codigo-e-stack.md` e tirar o 001 da lista de pendentes em `docs/decisoes/README.md`; verifica lendo o arquivo.
- [x] 1.2 CA3 · `git mv kit/campos packages/campos` e trocar os caminhos em `kit/instalar.ps1`, `kit/instalar.sh`, `kit/LEIA-ME.md` e `packages/campos/README.md`; verifica com `pnpm --filter @ggv/campos test`.
- [x] 1.3 CA2, CA3 · Criar `package.json` e `pnpm-workspace.yaml` na raiz (scripts `dev`, `typecheck`, `lint`, `test`) e gerar o `pnpm-lock.yaml`; verifica com `pnpm -r ls --depth -1`.
- [x] 1.4 CA3, CA6 · Criar `packages/contratos` com `Saude` e `Pessoa` (validados por `@ggv/campos`) e `src/contratos.test.ts`; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 1.5 CA2 · Criar `apps/api` com Fastify e `GET /saude` respondendo o contrato `Saude`, e `src/servidor.test.ts`; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.6 CA4 · Criar `apps/api/src/banco/esquema.ts`, gerar a migração em `apps/api/drizzle/` e o script `db:migrar`; teste `src/banco/migracoes.test.ts` aplica as migrações num Postgres em memória e confere as 4 tabelas; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.7 CA5 · Criar `.github/workflows/ci.yml` (typecheck, lint, testes, gitleaks); verifica no PR que o job roda e fica verde.
- [x] 1.8 CA2 · Rodar `pnpm dev` e conferir que a API responde em `/saude` e a tela abre em `localhost:5173`; verifica pela saída do `curl`.
- [x] 1.9 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-119 · Ambiente: homologação no Coolify com deploy a cada merge e Postgres de dev por pessoa

- [x] 2.1 CA4 · Contrato `Saude` ganha `banco` (`ligado`, `sem-banco`, `fora-do-ar`); `GET /saude` consulta o banco do `DATABASE_URL` e responde 503 com o banco fora do ar; verifica com `pnpm --filter @ggv/contratos test` e `pnpm --filter @ggv/api test`.
- [x] 2.2 CA1, CA2 · A API serve a tela montada (`apps/web/dist`) quando a pasta existe, com qualquer caminho caindo no `index.html`; teste em `src/servidor.test.ts`; verifica com `pnpm --filter @ggv/api test`.
- [x] 2.3 CA1, CA5 · `Dockerfile` e `.dockerignore` na raiz: monta a tela, roda as migrações antes de subir e tem verificação de saúde em `/saude`; verifica localmente com `pnpm --filter @ggv/web build` e a API servindo a tela em `localhost:3000`.
- [ ] 2.4 CA3, CA6 · `.env.example` na raiz com a URL dos bancos `prev_homolog`, `prev_pedro` e `prev_mateus`, sem senha; verifica com o gitleaks no CI.
- [x] 2.5 CA1, CA3, CA5, CA6 · `docs/infra/homologacao.md`: criar os bancos e usuários, o app no Coolify (deploy a cada merge, segredos só lá), acesso ao banco de dev por túnel SSH e só dados de exemplo em homologação; verifica lendo o arquivo.
- [ ] 2.6 CA1, CA2, CA3 · Ligar a homologação (Mateus, depois de 09/10 se preciso): banco no Supabase, projeto "Portal Operacional" (decisão de 05/10; os dados atuais podem ser apagados), imagem no GHCR do GitHub da MAPECH a cada merge; ajustar `docs/infra/homologacao.md`; verifica abrindo a URL de homologação.
- [x] 2.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
