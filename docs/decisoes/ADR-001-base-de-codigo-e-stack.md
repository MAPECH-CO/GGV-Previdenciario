# ADR-001 · Base de código e stack

**Data:** 2026-10-05 · **Estado:** aceita · **Decidiu:** Mateus (back-end e infra), com o time na reunião de 02/10

## Contexto
O portal precisa estar funcionando em 09/10/2026, feito por dois devs com o Claude Code. A tela e o servidor validam os mesmos campos (CPF, NB, CNJ, data) e as mesmas regras numéricas de prazo, então uma regra escrita duas vezes, em duas linguagens, vira duas regras diferentes. O front já existe em React 19 + Vite (GGVP-120). O Trabalhista, pausado, testou este mesmo desenho. A homologação roda numa VPS com Coolify e ninguém quer Docker na máquina de dev.

## Opções consideradas
1. **TypeScript de ponta a ponta (Node 22+).** Um só idioma: o schema Zod e a biblioteca `campos` rodam na tela e no servidor sem tradução. O front já é assim. Contra: o ecossistema de PDF e de IA é mais rico em Python.
2. **Front em TypeScript, servidor em Python (FastAPI).** Bom para IA e documentos. Contra: duas linguagens, contrato duplicado (Zod e Pydantic), `campos` reescrita em Python, dois jeitos de testar.

## Decisão
TypeScript de ponta a ponta, em monorepo pnpm: Node 22 ou mais novo, Fastify + Zod na API, Drizzle + PostgreSQL no banco, pg-boss para tarefas agendadas, React 19 + Vite na tela, Vitest nos testes e Playwright nas telas.

| Peça | Escolha | Por quê |
|---|---|---|
| Monorepo | pnpm workspaces (`apps/api`, `apps/web`, `packages/campos`, `packages/contratos`) | Um lock, um `pnpm dev`; tela e servidor importam os mesmos pacotes. |
| API | Fastify | Leve, rápido, `inject` para testar rota sem subir porta. |
| Contrato | Zod em `packages/contratos` | O mesmo schema valida o formulário e o corpo da requisição. |
| Banco | PostgreSQL com Drizzle | SQL explícito, migração versionada no repositório, tipos gerados do esquema. |
| Fila e agendamento | pg-boss, no próprio Postgres | Vigília 3 vezes por dia, lembretes e novas tentativas automáticas, sem Redis nem outro serviço para manter. |
| Tela | React 19 + Vite | Já é a base do GGVP-120. |
| Testes | Vitest; Playwright nas telas; Postgres em memória (PGlite) no teste das migrações | Roda igual na máquina e no CI, sem Docker. |
| Execução | Node tira os tipos do TypeScript direto (`--experimental-strip-types`) | Sem etapa de build na API. |

Os dados do portal (casos, tarefas, banco de motivos, acervo, estudo dos peritos) moram no PostgreSQL. O Google Drive guarda só documento do cliente (PDF, carta) e fica fora até 09/10 (GGVP-107).

## Consequências
- Todo pacote novo entra em `apps/` ou `packages/` e no `pnpm-workspace.yaml`.
- Validação de campo vem de `packages/campos`; contrato de endpoint e de formulário, de `packages/contratos`. Validação solta na tela é reprovada na revisão.
- Migração só por arquivo versionado do Drizzle (`apps/api/drizzle/`). Nada de mudar tabela à mão no banco.
- O CI barra o PR com typecheck, lint, testes ou varredura de segredos falhando.
- Proibido: segunda linguagem no servidor sem outro ADR; Docker obrigatório no desenvolvimento.
- Fica para depois: base de conhecimento e busca (ADR-013), LGPD e dado de saúde (ADR-008).
