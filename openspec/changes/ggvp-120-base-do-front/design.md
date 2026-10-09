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
10. **Botão ainda não ligado avisa, sem mudar o visual (CA8).** Os quatro botões ganham `aria-disabled="true"` e continuam no Tab, para quem usa o teclado descobrir que existem; o leitor de tela anuncia "indisponível". O "Atendimento ⌄" e o "✦ Suporte" perdem o `aria-haspopup` e o `aria-expanded`, que prometiam menu e janela. Alternativa descartada: `disabled`, que tira do Tab e muda o visual padrão do navegador. Quando cada história ligar o seu botão (GGVP-78 "Trocar perfil", GGVP-82 chat, Chatwoot no Suporte), o `aria-disabled` sai.
11. **Título por tela com o `<title>` do React 19 (CA9).** Cada página desenha o próprio `<title>` e o React o leva para o `<head>`; sem dependência nova. O `index.html` continua com "GGV Previdenciário" de reserva.
12. **Dia de Brasília nas datas (CA10, revisão de 08/10).** O servidor manda o momento em ISO, sempre em UTC; cortar com `slice(0, 10)` mostrava o dia seguinte das 21h à meia-noite. `diaLocal` em `@ggv/campos` devolve o dia no fuso do navegador (o do escritório) para o momento, e deixa a data pura (`aaaa-mm-dd`) como está, porque `new Date('2026-10-20')` é meia-noite UTC e voltaria um dia. Vale para as telas que já existem: petição, despacho, manifestação, prestação, recebimento, página do caso, transcrições e definir benefício. Os testes de tela rodam no fuso de Brasília (`TZ` no `vite.config.ts`, antes de o Vitest subir as threads; trocar o `TZ` dentro de uma thread não muda o relógio do processo), como o servidor e o Playwright desde o #15: o CI roda em UTC.
13. **Benefício pelo nome (CA11, revisão de 08/10).** Seis telas e a linha da Central do servidor tinham cada uma o seu `rotuloBeneficio`, que só trocava "_" por espaço ("pensao morte"). `nomeDoBeneficio` em `@ggv/contratos` usa o `ROTULO_BENEFICIO` que já existe; código fora do catálogo sai sem "_", e o vazio, "a definir".

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
- [Contraste do tema claro abaixo de 4,5:1: `texto-suave-2` no exemplo da busca e nas contagens (2,5 a 2,6:1) e `acento` sobre `acento-suave` no código do passo e no item aceso do topo (4,3:1), medido em 01/10] → é cor do Figma e corrigir muda o visual: está na lista para o Lucas; os tokens seguem o Figma até a decisão. O tema escuro passou.

## Migration Plan

Nada a migrar: primeira versão do `apps/web`, sem dado e sem implantação. Desfazer é reverter o PR.
