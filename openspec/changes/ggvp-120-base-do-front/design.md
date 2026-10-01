# Design

## Context

- `apps/web` já existe na branch, sem commit: React 19, Vite 8, TypeScript 6, Vitest 5 com jsdom e oxlint. Roda sozinho com `npm`; ainda não há workspace nem lockfile (o do pnpm vem com o GGVP-118).
- Conferido em 01/10, 13:44: `npm run typecheck` e `npm run lint` saem com código 0; `npm test` passa 29 de 29 em 6 arquivos. A primeira rodada do dia, às 13:42, falhou com "Timeout waiting for worker to respond" (5 erros): é o OneDrive deixando o worker lento para subir.
- Não há endpoint, formulário nem campo da biblioteca `campos` nesta change. Os dados são fictícios, em `src/dados/`.
- Motivo e escopo: ver `proposal.md`. Requisitos: `specs/base-do-front/spec.md` (CA1 a CA7).

## Goals / Non-Goals

**Goals:**
- Provar cada critério com teste e saída na tela, acrescentando só o teste que falta.
- Provar no navegador de verdade o que depende do CSS aplicado.

**Non-Goals:**
- Reescrever componente, mudar a estrutura de pastas ou criar roteador.
- Criar `packages/contratos`, workspace ou CI (GGVP-118).

## Decisions

1. **Sem contrato Zod nesta change.** Não há endpoint nem formulário. `src/dados/tipos.ts` é provisório e diz isso no próprio arquivo; o contrato de `Tarefa` nasce na `design.md` do GGVP-78, em `packages/contratos`.
2. **Sem `campos`.** A busca e o chat são texto livre e não validam nada. Quando a busca aceitar CPF, NB ou CNJ (GGVP-78), usa a biblioteca.
3. **Sem portão.** Nada aqui aprova, protocola nem libera; o chat só preenche o campo e avisa que não há servidor.
4. **Tokens como variáveis CSS nativas.** `figma-tokens.json` (retrato das coleções `Tema` e `Acessibilidade`) → `npm run tokens` → `tokens.css`, com o nome do Figma: `cor/fundo` vira `--cor-fundo`, `fonte/13` vira `--fonte-13`. Tema e fonte ligam por `data-tema` e `data-fonte` no `<html>`, um bloco por modo do Figma. Alternativa descartada: tema em CSS-in-JS ou Tailwind, que traz dependência e não espelha os modos do Figma um para um.
5. **Preferência no navegador.** `localStorage`, chave `ggv.preferencias`; vale o endereço, depois o guardado, depois o padrão. Armazenamento bloqueado cai no padrão sem erro. Guardar no perfil da pessoa depende do login (GGVP-117).
6. **"Cor de ação" da tarefa urgente é `--cor-erro`.** Ponto e prazo da tarefa urgente usam `cor/erro`, o "vermelho urgente" de `docs/prototipo/figma.md`; a tarefa comum usa `cor/acento`.
7. **Rotas mínimas em `App.tsx`.** `/`, `/tokens` e todo o resto em "Esta tela ainda não foi construída". Roteador só com o GGVP-86.
8. **Teste em duas camadas.** Vitest com jsdom prova estrutura, texto, links, teclado e a lógica das preferências. Playwright prova no Chromium o que o jsdom não calcula: cor de fundo e tamanho de fonte mudando na tela inteira, a cor da tarefa urgente e as rotas do `npm run dev`.
9. **Playwright mora em `apps/web`.** `playwright.config.ts` sobe `npm run dev` na porta 5173 (já fixa no `vite.config.ts`) e reaproveita o servidor se ele já estiver de pé. Testes em `e2e/*.e2e.ts`, nome que o Vitest não pega. Script `npm run e2e`. O `tsconfig.node.json` passa a incluir a config e os testes, para o `typecheck` cobrir. `apps/web/.gitignore` novo ignora `test-results/` e `playwright-report/`, sem mexer no `.gitignore` da raiz.

### Dependências (uma linha cada)

| Pacote | Por quê |
|---|---|
| `react`, `react-dom` 19 | stack proposta no `CLAUDE.md` |
| `vite` 8, `@vitejs/plugin-react` | stack proposta |
| `typescript` 6 | stack proposta |
| `@fontsource-variable/inter` | a fonte Inter do Figma servida pelo próprio portal, sem Google Fonts |
| `vitest` 5, `jsdom`, `@testing-library/react`, `@testing-library/dom` | teste de componente (stack proposta: Vitest) |
| `oxlint` | lint rápido e sem configuração; se o GGVP-118 escolher outro, troca |
| `@types/node`, `@types/react`, `@types/react-dom` | tipos |
| **`@playwright/test` e o Chromium dele (novos)** | o kit pede teste ponta a ponta quando há tela, e só o navegador de verdade aplica o CSS |

## Risks / Trade-offs

- [Vitest estoura o tempo do worker na primeira rodada, no OneDrive] → rodar de novo e colar as duas saídas; se repetir no `/opsx:apply`, parar e abrir tarefa com `/opsx:update` (o `apps/web/README.md` já sugere tirar o clone do OneDrive).
- [O GGVP-118 recria o `apps/web` ou troca lint e gerenciador de pacotes] → texto para o Mateus entregue em 01/10; o 118 só liga o `apps/web` ao workspace.
- [O Lucas muda o título da tarefa (CA5 do GGVP-78) ou quem vê "Tarefas do setor" (GGVP-115)] → a mudança entra no GGVP-78; aqui as peças são a vitrine.
- [O Chromium do Playwright é um download grande] → pedir o ok do Pedro, com o tamanho, antes de instalar.
- [As cores de status mudam para laranja] → muda no Figma, atualiza o `figma-tokens.json` e roda `npm run tokens`.

## Migration Plan

Nada a migrar: primeira versão do `apps/web`, sem dado e sem implantação. Desfazer é reverter o PR.
