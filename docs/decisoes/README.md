# Decisões (ADRs)

Uma decisão, um arquivo: `ADR-<nnn>-<titulo>.md`, a partir de `ADR-000-modelo.md`.
Decisão registrada não se reverte por commit. Reverte por outro ADR que cite o anterior.

## Aceitas
| ADR | Decisão |
|---|---|
| [001](ADR-001-base-de-codigo-e-stack.md) | Base de código e stack: TypeScript de ponta a ponta em monorepo pnpm (Fastify + Zod, Drizzle + PostgreSQL, pg-boss, React + Vite, Vitest, Playwright) |
| [013](ADR-013-base-de-conhecimento.md) | Base de conhecimento do acervo: pgvector no mesmo PostgreSQL (HNSW), busca híbrida com a palavra por RRF, embeddings da OpenAI pelo motor (GGVP-141) |

## Pendentes para a Sprint 0
| ADR | Decisão | Proposta de partida |
|---|---|---|
| 002 | Produto e implantações | Herdar o ADR-002 do Trabalhista: o Prev vira o vertical `previdenciario` do mesmo produto, ou repositório próprio até estabilizar? |
| 003 | Interface por perfil com chat | Chat herda as permissões do perfil, ação só com confirmação, portões valem no chat (GGVP-82) |
| 008 | LGPD e dado de saúde | Classificação, cifragem, retenção de áudio, laudos e perfil de perito (Q11, Q17) |
| 012 | Agentes de IA no produto | Herdar o ADR-012 do Trabalhista |
| 014 | Fonte da jurimetria | Onde está o estudo prévio de peritos e juízes, formato, atualização (Q13) |
| 015 | Chatwoot como motor das conversas | Manter o Chatwoot (canais + chatbot) e incorporar em 2 fases: iframe+SSO, depois API/webhook ligada ao caso. Estudo em `docs/arquitetura/chatwoot-no-portal.md` |
