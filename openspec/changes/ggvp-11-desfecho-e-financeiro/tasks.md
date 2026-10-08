# Tasks

## GGVP-98 · Financeiro recebe e cliente é avisado

- [x] 1.1 CA3, CA6 · Contratos: `ReceberPrestacao` com `valoresConferem`; `AgendarIdaAoBanco` com `acompanhanteId` obrigatório; `IdaAoBancoDoCaso` com `podeConfirmar` e `encerrado`; matriz versão 11, renumerada para 14 na 3.2 (`banco.agendar` do Financeiro); testes do contrato.
- [x] 1.2 CA1, CA3, CA4, CA8 · Servidor: o OK abre só o recebimento; "Receber e lançar" exige a conferência e abre a tarefa do aviso do Financeiro; a mesma pessoa é recusada e registrada; testes da API.
- [x] 1.3 CA6, CA7 · Servidor: acompanhante obrigatório e do Atendimento; agendar abre "Levar ao banco" para ele, remarcar move a tarefa; testes da API.
- [x] 1.4 CA2, CA5, CA9 · Servidor: o aviso grava o acervo (processo bom) e a baixa; `POST /api/casos/:id/banco/confirmacao` fecha o caso; testes da API.
- [x] 1.5 Telas: "Receber e lançar" com a caixa de conferência; ida ao banco do Financeiro com acompanhante obrigatório e "Confirmar recebimento"; testes de tela.
- [x] 1.6 Playwright do caminho: advogada conclui, Financeiro recebe, agenda, avisa e confirma; Atendimento vê "Levar ao banco".
- [x] 1.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-22 · Explicar o resultado ao cliente

- [x] 2.1 CA3, CA4, CA5 · Contratos em `packages/contratos/src/desfecho.ts`: `AprovarResumo`, `RegistrarContato`, `ResultadoParaExplicar`; matriz versão 12, renumerada para 14 na 3.2 (`resultado.aprovar_resumo`, `resultado.explicar`); testes do contrato.
- [x] 2.2 CA1, CA3, CA5 · Servidor: `abrirExplicacaoDoResultado` abre "Aprovar o resumo para o cliente" para a advogada; `POST /api/casos/:id/resultado/resumo` grava o resumo como decisão de pessoa e abre "Explicar resultado" para quem fala; testes da API.
- [x] 2.3 CA2, CA4 · Servidor: `GET /api/casos/:id/resultado` e `POST /api/casos/:id/resultado/contato` (sem contato mantém; explicado conclui e encerra); testes da API.
- [x] 2.4 Semente: um caso de exemplo perdido, com "Aprovar o resumo para o cliente" para a advogada.
- [x] 2.5 Tela "Explicar o resultado" (`/casos/:id/resultado`): o Jurídico escreve e aprova, escolhendo quem fala; quem fala vê o resumo com o aprovador e registra cada contato; testes de tela.
- [x] 2.6 Playwright: a advogada aprova e passa ao Atendimento; o Atendimento registra sem contato e depois explicado; o caso fecha.
- [x] 2.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## Entrada na main (08/10)

A antiga 2.8, a ligação de `abrirExplicacaoDoResultado` no "Não recorrer", foi para o próximo PR do épico, junto com a GGVP-100 (ver a proposal). A parte do estudo de caso já está no PR da IA.

- [x] 3.1 Base do PR na `main`, porque a Garantia entrou em 07/10, e a `main` mesclada na branch, sem conflito.
- [x] 3.2 Matriz: quem entra depois renumera. Em 08/10 entraram na `main`, antes deste PR, a Jurimetria (#23, versões 11 e 12) e a Recepção no servidor (#29, versão 13).
  - O Desfecho ficou com a versão 14, uma só para as duas ações dele, a ida ao banco e o resumo do resultado.
  - A impressão digital foi recalculada para `f102b510`, com as ações das três.
  - Outra sessão já tinha mesclado a `main` com a Recepção na branch (5523f71). As duas resoluções foram juntadas, ficando com a ordem dela e acertando o rótulo da ida ao banco, que dizia 13.
- [x] 3.3 Rodar typecheck, lint, testes e Playwright; colar a saída. Em 08/10, com a main mesclada:
  - typecheck e lint sem erro;
  - `openspec validate --all --strict` com 11 de 11;
  - contratos 88, API 271, tela 1.117 e Playwright 202, todos passando.
  - Quatro arquivos de tela não subiram por tempo esgotado ao iniciar com a máquina cheia. Rodados de novo à parte, passaram com 189 testes.

## Revisão do PR (08/10)

- [x] 4.1 GGVP-98 · CA2, CA9: o caso encerrado não reabre. Agendar a ida ao banco e avisar o cliente devolvem 409, e nenhuma tarefa nasce. O aviso sem desfecho nem deferimento registrado também devolve 409, e o caso não entra no acervo como processo bom. Testes da API.
- [x] 4.2 GGVP-22 · CA4, CA5: só quem ficou com a explicação registra o contato, ou seja, a advogada que a pegou ou o Atendimento. A tela mostra só os contatos desta explicação, ligados à tarefa pelo histórico. Testes da API.
- [x] 4.3 Rodar typecheck, lint, testes e Playwright; colar a saída. Em 08/10:
  - typecheck e lint sem erro;
  - `openspec validate --all --strict` com 11 de 11;
  - contratos 88 e API 275 (4 testes novos), todos passando.
  - A tela não mudou, e só os contratos leem a versão da matriz.
  - Playwright do desfecho, da via administrativa, da perícia, do login e da governança: 24 passaram juntos.
  - O teste do cofre falhou só ao rodar junto com a via administrativa: as duas leem o cofre do Igor no mesmo servidor, uma fragilidade que já vem da main. Sozinho, passou com 5 de 5.

## Segunda revisão do PR (08/10)

- [x] 5.1 GGVP-22 · CA1: teste da API para "Explicar resultado" na fila de quem fala. No padrão, ela vai para o Atendimento e não para a advogada. Quando a advogada liga, vai para ela.
- [x] 5.2 GGVP-98 · CA2 e GGVP-22 · CA4: o histórico do aviso e da baixa e o registro do contato passam a ir na mesma transação do acervo e do atendimento. Assim, nenhum fica sem o outro.
- [x] 5.3 Rodar typecheck, lint, testes e Playwright; colar a saída. Em 08/10:
  - typecheck e lint sem erro;
  - `openspec validate --all --strict` com 11 de 11;
  - contratos 88 e API 276, todos passando;
  - Playwright do desfecho e da via administrativa: 12 de 12.

## Terceira revisão do PR (08/10)

- [x] 6.1 GGVP-98: todo o histórico da prestação vai na mesma transação da mudança: o OK, o recebimento, o agendamento, o aviso e a confirmação.
- [x] 6.2 GGVP-98 · CA9: agendar, avisar e confirmar travam o caso na transação (`for update`) e conferem de novo se ele foi encerrado. Dois pedidos ao mesmo tempo passam um de cada vez, e o segundo recebe 409 se o primeiro fechou o caso.
- [x] 6.3 GGVP-22 · CA4: a lista mostra os contatos da explicação mais recente, pela tarefa gravada no histórico. A explicação reaberta não se mistura com a anterior. Teste da API.
- [x] 6.4 GGVP-98 · CA8: a recusa de quem deu o OK e tenta receber é gravada como `funcoes` (separação de funções), e não como G8, que é "o aviso só sai depois do OK". A pergunta ao Lucas passa a ser se isso vira portão oficial, com número. Teste da API.
- [x] 6.5 Rodar typecheck, lint, testes e Playwright; colar a saída. Em 08/10:
  - typecheck e lint sem erro;
  - `openspec validate --all --strict` com 11 de 11;
  - contratos 88 e API 277, todos passando;
  - Playwright do desfecho, da via administrativa e da governança, um de cada vez: 16 de 16. Em sequência, o teste do cofre também passa.

## Quarta revisão do PR (08/10)

- [x] 8.1 GGVP-98 · CA4: versão nova depois do recebimento volta para o Financeiro. O aviso espera o recebimento da versão atual (409 até lá). Teste da API.
- [x] 8.2 GGVP-98 · CA9: o caso encerrado não aceita versão nova da prestação (409), e nenhuma tarefa nasce. A versão é contada com o caso travado, para duas não saírem iguais. Teste da API.
- [x] 8.3 GGVP-98 · CA3, CA4: teste da rota para "lançar sem conferir" (400). Dois recebimentos ao mesmo tempo: a condição vai no próprio update, e só o primeiro conta. "Confirmar antes do aviso" já tinha teste, no começo do teste do CA9 (`MSG_ANTES_DO_AVISO`).
- [x] 8.4 GGVP-22 · CA2, CA3: a aprovação do resumo fecha a tarefa com a condição no próprio update. O contato trava a tarefa (`for update`) e confere de novo que ela segue aberta. Dois pedidos ao mesmo tempo, só o primeiro passa.
  - O histórico do resumo também vai na mesma transação.
  - O banco embutido dos testes atende uma consulta de cada vez, então os testes de pedidos simultâneos conferem o resultado, mas não reproduzem a disputa. Quem barra no PostgreSQL é a condição e a trava.
- [x] 8.5 Campos de data e hora (revisão, ATENÇÃO): os campos nativos de `PrestarContas.tsx` e `IdaAoBanco.tsx` já estavam na main, da GGVP-44. O valor passa por `isoParaData` da `campos`, e o servidor valida de novo com `DataObrigatoria`. Ficam fora deste PR.
- [x] 8.6 Rodar typecheck, lint, testes e Playwright; colar a saída. Em 08/10:
  - typecheck e lint sem erro;
  - `openspec validate --all --strict` com 11 de 11;
  - contratos 88 e API 283, todos passando;
  - Playwright do desfecho, da via administrativa e da governança, um de cada vez: 16 de 16 em 1,4 min.
  - Numa primeira rodada, com a máquina cheia (6,2 min), 3 falharam, e o detalhe não ficou guardado. Rodando de novo, passaram todos.

## Próximo PR do épico (adiado na revisão de 08/10)

- [ ] 7.1 GGVP-22 · CA4: coluna `tarefa_id` em `atendimento`, numa migração, e a lista de contatos passa a ler a coluna; o histórico deixa de ser a fonte.
  - Ficou fora deste PR para não abrir mais um choque de migração: o #26 e o #29 já disputam os números a partir da 0013.
  - Até lá, o vínculo vem do histórico, gravado na mesma transação do atendimento (5.2).
