# Tasks

## GGVP-98 · Financeiro recebe e cliente é avisado

- [x] 1.1 CA3, CA6 · Contratos: `ReceberPrestacao` com `valoresConferem`; `AgendarIdaAoBanco` com `acompanhanteId` obrigatório; `IdaAoBancoDoCaso` com `podeConfirmar` e `encerrado`; matriz versão 11 (`banco.agendar` do Financeiro); testes do contrato.
- [x] 1.2 CA1, CA3, CA4, CA8 · Servidor: o OK abre só o recebimento; "Receber e lançar" exige a conferência e abre a tarefa do aviso do Financeiro; a mesma pessoa é recusada e registrada; testes da API.
- [x] 1.3 CA6, CA7 · Servidor: acompanhante obrigatório e do Atendimento; agendar abre "Levar ao banco" para ele, remarcar move a tarefa; testes da API.
- [x] 1.4 CA2, CA5, CA9 · Servidor: o aviso grava o acervo (processo bom) e a baixa; `POST /api/casos/:id/banco/confirmacao` fecha o caso; testes da API.
- [x] 1.5 Telas: "Receber e lançar" com a caixa de conferência; ida ao banco do Financeiro com acompanhante obrigatório e "Confirmar recebimento"; testes de tela.
- [x] 1.6 Playwright do caminho: advogada conclui, Financeiro recebe, agenda, avisa e confirma; Atendimento vê "Levar ao banco".
- [x] 1.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-22 · Explicar o resultado ao cliente

- [x] 2.1 CA3, CA4, CA5 · Contratos em `packages/contratos/src/desfecho.ts`: `AprovarResumo`, `RegistrarContato`, `ResultadoParaExplicar`; matriz versão 12 (`resultado.aprovar_resumo`, `resultado.explicar`); testes do contrato.
- [x] 2.2 CA1, CA3, CA5 · Servidor: `abrirExplicacaoDoResultado` abre "Aprovar o resumo para o cliente" para a advogada; `POST /api/casos/:id/resultado/resumo` grava o resumo como decisão de pessoa e abre "Explicar resultado" para quem fala; testes da API.
- [x] 2.3 CA2, CA4 · Servidor: `GET /api/casos/:id/resultado` e `POST /api/casos/:id/resultado/contato` (sem contato mantém; explicado conclui e encerra); testes da API.
- [x] 2.4 Semente: um caso de exemplo perdido, com "Aprovar o resumo para o cliente" para a advogada.
- [x] 2.5 Tela "Explicar o resultado" (`/casos/:id/resultado`): o Jurídico escreve e aprova, escolhendo quem fala; quem fala vê o resumo com o aprovador e registra cada contato; testes de tela.
- [x] 2.6 Playwright: a advogada aprova e passa ao Atendimento; o Atendimento registra sem contato e depois explicado; o caso fecha.
- [x] 2.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## Entrada na main (08/10)

A antiga 2.8, a ligação de `abrirExplicacaoDoResultado` no "Não recorrer", foi para o próximo PR do épico, junto com a GGVP-100 (ver a proposal). A parte do estudo de caso já está no PR da IA.

- [x] 3.1 Base do PR na `main`, porque a Garantia entrou em 07/10, e a `main` mesclada na branch, sem conflito.
- [ ] 3.2 Matriz: quem entra depois renumera. Se o #23 (Jurimetria, também com as versões 11 e 12) entrar antes, as duas versões deste PR passam para as próximas livres, com a impressão digital nova no teste.
- [x] 3.3 Rodar typecheck, lint, testes e Playwright; colar a saída. Em 08/10, com a main mesclada:
  - typecheck e lint sem erro;
  - `openspec validate --all --strict` com 11 de 11;
  - contratos 88, API 271, tela 1.117 e Playwright 202, todos passando.
  - Quatro arquivos de tela não subiram por tempo esgotado ao iniciar com a máquina cheia. Rodados de novo à parte, passaram com 189 testes.
