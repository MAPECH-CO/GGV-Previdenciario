# Tasks

## 1. Ponto de partida

- [x] 1.1 Em `apps/web`, sem mudar nada, rodar `npm run typecheck`, `npm run lint` e `npm test` e colar a saída; verifica que a base está verde antes de qualquer teste novo (se o Vitest estourar o tempo do worker, rodar de novo e colar as duas saídas).

## 2. CA1 · Tokens do Figma viram o CSS

- [x] 2.1 Rodar `npm run tokens` e depois `npx vitest run src/design/tokens.test.ts`; verifica pela saída que o `tokens.css` regerado continua em dia com o `figma-tokens.json` e que todo `var(--x)` existe.
- [x] 2.2 Acrescentar em `src/design/tokens.test.ts` o teste "o nome do Figma vira a variável CSS" (`gerarCss` escreve `--cor-fundo` e `--fonte-13`) e rodar o arquivo; verifica pela saída.

## 3. CA2 · Tema e fonte

- [x] 3.1 Rodar `npx vitest run src/design/preferencias.test.ts src/componentes/BotoesPreferencias.test.tsx` e colar a saída; verifica endereço acima do guardado, valor inválido, navegador sem armazenamento e a troca nos botões. A tela inteira mudando fica na tarefa 9.2.

## 4. CA3 · Barra do topo

- [x] 4.1 Criar `src/componentes/Topbar.test.tsx` (marca "GGV Previdenciário", item da página atual com `aria-current="page"`, ação "+ Novo cliente", botões de tema e de fonte, nome da função) e rodar o arquivo; verifica pela saída.

## 5. CA4 · Linha da tarefa

- [x] 5.1 Rodar `npx vitest run src/componentes/TarefaLinha.test.tsx` e colar a saída; verifica código, cliente ou contexto, ação, detalhe, prazo, links separados e o aviso de urgente ao leitor de tela. A cor da tarefa urgente fica na tarefa 9.3.

## 6. CA5 · Central do Atendimento

- [x] 6.1 Acrescentar em `src/paginas/CentralAtendimento.test.tsx` o teste da aba "✦ Suporte" e rodar o arquivo; verifica pela saída, junto com busca, chat, abas e fila, que já têm teste.

## 7. CA6 · Página /tokens

- [x] 7.1 Criar `src/paginas/Tokens.test.tsx` (29 cores, 17 tamanhos de fonte e 8 raios na tela) e rodar o arquivo; verifica pela saída. A reação à troca de tema e de fonte fica na tarefa 9.3.

## 8. CA7 · Caminho sem tela

- [x] 8.1 Acrescentar em `src/App.test.tsx` a conferência do link "Voltar ao início" com `href="/"` e rodar o arquivo; verifica pela saída.

## 9. Ponta a ponta com Playwright

- [x] 9.1 Pedir o ok do Pedro (dependência nova e download do Chromium, com o tamanho). Com o ok: instalar `@playwright/test` como devDependency e o Chromium (`npx playwright install chromium`); criar `apps/web/playwright.config.ts` (sobe `npm run dev` na 5173 e reaproveita o servidor de pé; testes em `e2e/*.e2e.ts`), o script `e2e` no `package.json` e `apps/web/.gitignore` com `test-results/` e `playwright-report/`; incluir a config e `e2e/` no `tsconfig.node.json`. Verifica com `npx playwright --version` e `npm run typecheck`.
- [x] 9.2 Criar `apps/web/e2e/base-do-front.e2e.ts` com o CA2: em `/`, "☾ Escuro" muda a cor de fundo da página para o valor escuro de `--cor-fundo` e "A+" aumenta a fonte; recarregar mantém a escolha; `/?tema=escuro&fonte=grande` já abre escuro e grande. Rodar `npm run e2e` e colar a saída.
- [x] 9.3 No mesmo arquivo, CA4, CA6 e CA7: a tarefa urgente da Central tem o prazo na cor de `--cor-erro`; em `/tokens`, a amostra de `cor/fundo` muda ao trocar o tema e o exemplo de `fonte/13` cresce com "A+" (o CA6 pede as duas reações); `/qualquer-coisa` mostra "Esta tela ainda não foi construída" e "Voltar ao início" leva a `/`. Rodar `npm run e2e` e colar a saída.
- [x] 9.4 Acrescentar ao `apps/web/README.md` como instalar o Chromium e rodar `npm run e2e`; verifica rodando o comando como está escrito.

## 10. Fechamento

- [x] 10.1 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
