# Spec Delta · ggvp-118

## Purpose

Base de código do portal: stack decidida, monorepo, banco modelado no mínimo e CI, para que toda história seguinte comece por uma change do OpenSpec e termine num PR verde.

## ADDED Requirements

### Requirement: CA1 · ADR-001 registra a stack e o porquê
O repositório SHALL ter `docs/decisoes/ADR-001` dizendo a stack escolhida (TypeScript de ponta a ponta, Fastify + Zod, Drizzle + PostgreSQL, React + Vite, Vitest, Playwright) e por quê.

#### Scenario: CA1 · Ler o ADR-001
- **Dado** `docs/decisoes/ADR-001`
- **Quando** é lido
- **Então** diz a stack escolhida e por quê

### Requirement: CA2 · Um comando sobe API e tela, sem Docker
`pnpm install` seguido de `pnpm dev` na raiz do clone SHALL subir `apps/api` e `apps/web`, sem Docker.

#### Scenario: CA2 · Subir o portal local
- **Dado** o clone
- **Quando** rodo `pnpm install` e `pnpm dev`
- **Então** sobem `apps/api` e `apps/web`, sem Docker

### Requirement: CA3 · Os quatro pacotes do monorepo
O monorepo SHALL ter `apps/api`, `apps/web`, `packages/campos` (movido de `kit/campos`, testes passando) e `packages/contratos` (schemas Zod compartilhados).

#### Scenario: CA3 · Listar os pacotes
- **Dado** o monorepo
- **Quando** listo os pacotes
- **Então** existem `apps/api`, `apps/web`, `packages/campos` (movido de `kit/campos`, testes passando) e `packages/contratos` (schemas Zod compartilhados)

### Requirement: CA4 · Migrações criam as tabelas mínimas
As migrações versionadas (Drizzle) SHALL criar as tabelas de pessoa, caso, tarefa e evento de auditoria.

#### Scenario: CA4 · Rodar as migrações
- **Dado** o banco
- **Quando** rodo as migrações
- **Então** existem as tabelas mínimas de pessoa, caso, tarefa e evento de auditoria, com migração versionada (Drizzle)

### Requirement: CA5 · CI barra o PR quebrado
Todo PR SHALL rodar no CI typecheck, lint, testes e varredura de segredos, e o CI MUST falhar se qualquer um falhar.

#### Scenario: CA5 · Abrir um PR
- **Dado** um PR
- **Quando** abre
- **Então** o CI roda typecheck, lint, testes e varredura de segredos, e falha se qualquer um falhar

### Requirement: CA6 · Campos de formulário vêm de packages/campos
Formulário que usa CPF, CEP, data, número, telefone, NB ou CNJ MUST importar de `packages/campos`; validação solta na tela MUST ser reprovada na revisão.

#### Scenario: CA6 · Formulário com campo da biblioteca
- **Dado** a biblioteca `campos`
- **Quando** um formulário usa CPF, CEP, data, número, telefone, NB ou CNJ
- **Então** importa de `packages/campos`; validação solta na tela é reprovada na revisão

### Requirement: CA7 · O "hoje" é o dia de Brasília no servidor e no teste de navegador
Toda rota do servidor que conta o "hoje" (prazo, urgência, vencido) MUST usar o dia de Brasília (`hojeEmBrasilia`), nunca o dia em UTC; o teste de navegador SHALL rodar o navegador e o processo do teste no fuso `America/Sao_Paulo`, como a API do teste (#15), para que o mesmo instante dê o mesmo dia nos três (orquestrador, 09/10: entre 21h e meia-noite os testes quebravam no CI).

#### Scenario: CA7 · Às 22h30 de Brasília
- **Dado** o relógio do servidor às 22h30 de Brasília (01h30 do dia seguinte em UTC)
- **Quando** uma rota calcula a urgência ou o vencimento de um prazo
- **Então** conta o dia de Brasília, não o dia seguinte

#### Scenario: CA7 · Teste de navegador no CI
- **Dado** o CI rodando em UTC
- **Quando** o Playwright sobe o navegador e os testes
- **Então** os dois usam `America/Sao_Paulo`, como a API do teste
