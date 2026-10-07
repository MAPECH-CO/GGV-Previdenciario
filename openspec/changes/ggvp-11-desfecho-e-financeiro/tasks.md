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
- [ ] 2.8 Ligar `abrirExplicacaoDoResultado` no "Não recorrer" (GGVP-100) e no estudo de caso (GGVP-19), quando eles existirem.
- [x] 2.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
