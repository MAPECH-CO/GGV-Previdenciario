# Design · GGVP-2 Fundação técnica

## GGVP-118 · Base de código

### Monorepo

pnpm workspaces na raiz (`pnpm-workspace.yaml`): `apps/*` e `packages/*`. Um `pnpm-lock.yaml` na raiz trava as versões. Scripts da raiz chamam o script de mesmo nome em cada pacote: `dev`, `typecheck`, `lint`, `test`.

| Pacote | O que é |
|---|---|
| `apps/web` (`@ggv/web`) | O front do PR #8. Não muda nesta história, só entra no workspace. |
| `apps/api` (`@ggv/api`) | Fastify. Sobe sem banco: a URL do banco só é exigida para migrar e para rotas que leem o banco. |
| `packages/campos` (`@ggv/campos`) | Movido de `kit/campos` com `git mv`, sem mudar funções nem testes. |
| `packages/contratos` (`@ggv/contratos`) | Schemas Zod que a tela e o servidor compartilham. |

TypeScript roda direto no Node (tirar os tipos, Node 22.6 ou mais novo); imports com extensão `.ts`, como em `apps/web`. Sem `tsx` nem build da API.

### Contratos (`packages/contratos`)

- `Saude`: resposta de `GET /saude` (`{ ok: true, servico: 'api' }`). É o que a homologação (GGVP-119) consulta para saber se a API subiu.
- `Pessoa`: `{ id, nome, cpf? }`; `nome` passa por `validarNome` e `cpf` por `validarCpf`, ambos de `@ggv/campos`. É o exemplo do jeito certo: o servidor valida com a mesma função da tela.

### Campos de formulário

Nenhum formulário nesta história. A regra fica de pé assim: `@ggv/campos` é dependência de `@ggv/contratos` e de `@ggv/web`, e a revisão automática do PR já trata validação solta como atenção.

### Banco

Drizzle ORM com PostgreSQL. Esquema em `apps/api/src/banco/esquema.ts`; migrações versionadas, geradas pelo `drizzle-kit` em `apps/api/drizzle/`. Tabelas mínimas:

| Tabela | Colunas |
|---|---|
| `pessoa` | `id` uuid, `nome`, `cpf` (único, pode faltar), `criado_em` |
| `caso` | `id` uuid, `pessoa_id` → pessoa, `beneficio`, `criado_em` |
| `tarefa` | `id` uuid, `caso_id` → caso, `titulo`, `prazo` (date, pode faltar), `criado_em`, `concluida_em` |
| `evento_auditoria` | `id` uuid, `quem`, `acao`, `alvo`, `quando`, `detalhe` jsonb |

`evento_auditoria` não guarda dado de saúde: `detalhe` leva ids e nomes de campo, nunca o valor.

`pnpm --filter @ggv/api db:migrar` aplica as migrações no banco do `DATABASE_URL` (do `.env`, que a GGVP-119 configura).

### Dependências novas e por quê

- `fastify`, `zod`, `drizzle-orm`, `pg`, `drizzle-kit`, `vitest`, `typescript`, `oxlint`: a stack do ADR-001.
- `@electric-sql/pglite` (só nos testes): Postgres em memória, para o teste das migrações rodar no CI e na máquina sem Docker.

### CI

`.github/workflows/ci.yml`, em todo PR e push na `main`: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test` e varredura de segredos com `gitleaks`. Qualquer passo falhando, o job falha. O Playwright entra no CI quando houver tela que dependa do servidor; até lá roda na máquina do dev.
