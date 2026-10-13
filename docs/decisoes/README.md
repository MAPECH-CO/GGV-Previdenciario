# Decisões (ADRs)

Uma decisão, um arquivo: `ADR-<nnn>-<titulo>.md`, a partir de `ADR-000-modelo.md`.
Decisão registrada não se reverte por commit. Reverte por outro ADR que cite o anterior.

## Aceitas

| ADR | Decisão |
|---|---|
| [001](ADR-001-base-de-codigo-e-stack.md) | Base de código e stack: TypeScript de ponta a ponta em monorepo pnpm (Fastify + Zod, Drizzle + PostgreSQL/Supabase, agendamento por setInterval, React + Vite, Vitest, Playwright) |
| [013](ADR-013-base-de-conhecimento.md) | Base de conhecimento do acervo: pgvector no mesmo PostgreSQL (HNSW), busca híbrida com a palavra por RRF, embeddings da OpenAI pelo motor (GGVP-141) |
| [015](ADR-015-chatwoot-motor-de-conversas.md) | Chatwoot como motor das conversas; aceitação não significa todas as integrações concluídas |
| [016](ADR-016-kit-de-agentes-no-chat.md) | Kit de agentes da OpenAI em TypeScript no chat (GGVP-142): leitura sozinha, ação com aprovação da pessoa (o cartão), rastreamento desligado, registro em `chamada_ia`; as travas seguem como código |
| [017](ADR-017-scanner-pelo-drive.md) | O papel do scanner entra pelo Drive (GGVP-158): a cada minuto, o portal lê a lista de mudanças e traz o arquivo novo da pasta de um cliente; o n8n não muda; não roda com o Drive só leitura |

## Decisões com pendências

| ADR | Decisão e pendência |
|---|---|
| [008](ADR-008-lgpd-e-dado-de-saude.md) | Acesso, uso de saúde pela IA e guarda registrados; região do banco e contratos com fornecedores em aberto |

## Demais decisões pendentes

| ADR | Decisão | Proposta de partida |
|---|---|---|
| 002 | Produto e implantações | Herdar o ADR-002 do Trabalhista: o Prev vira o vertical `previdenciario` do mesmo produto, ou repositório próprio até estabilizar? |
| 003 | Interface por perfil com chat | Chat herda as permissões do perfil, ação só com confirmação, portões valem no chat (GGVP-82) |
| 012 | Agentes de IA no produto | Herdar o ADR-012 do Trabalhista |
| 014 | Fonte da jurimetria | Onde está o estudo prévio de peritos e juízes, formato, atualização (Q13) |
