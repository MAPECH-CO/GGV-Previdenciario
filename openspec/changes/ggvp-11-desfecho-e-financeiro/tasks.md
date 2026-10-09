# Tasks

## GGVP-98 · Financeiro recebe e cliente é avisado

- [x] 1.1 CA3, CA6 · Contratos: `ReceberPrestacao` com `valoresConferem`; `AgendarIdaAoBanco` com `acompanhanteId` obrigatório; `IdaAoBancoDoCaso` com `podeConfirmar` e `encerrado`; matriz versão 11, renumerada para 14 na 3.2 (`banco.agendar` do Financeiro); testes do contrato.
- [x] 1.2 CA1, CA3, CA4, CA8 · Servidor: o OK abre só o recebimento; "Receber e lançar" exige a conferência e abre a tarefa do aviso do Financeiro; a mesma pessoa é recusada e registrada; testes da API.
- [x] 1.3 CA6, CA7 · Servidor: acompanhante obrigatório e do Atendimento; agendar abre "Levar ao banco" para ele, remarcar move a tarefa; testes da API.
- [x] 1.4 CA2, CA5, CA9 · Servidor: o aviso grava o acervo (processo bom) e a baixa; `POST /api/casos/:id/banco/confirmacao` fecha o caso; testes da API.
- [x] 1.5 Telas: "Receber e lançar" com a caixa de conferência; ida ao banco do Financeiro com acompanhante obrigatório e "Confirmar recebimento"; testes de tela.
- [x] 1.6 Playwright do caminho: advogada conclui, Financeiro recebe, agenda, avisa e confirma; Atendimento vê "Levar ao banco".
- [x] 1.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
- [x] 1.8 Revisão de 08/10 (M5): a dica de "Prestar contas" ainda dizia "o Atendimento agenda a ida ao banco"; passa a dizer que o Financeiro recebe e, depois, avisa o cliente e marca a ida ao banco (mudança do Lucas de 06/10); teste Vitest; verifica com `pnpm --filter @ggv/web test`.

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

## Quinta revisão do PR (08/10)

- [x] 9.1 GGVP-98 · CA8: a pergunta ao Lucas sobre a separação de funções (o código `funcoes` fora da lista G1 a G22) fica como pendência aberta. Ela é a Q21 em `docs/requisitos/duvidas-abertas.md`, marcada como "não bloqueia", e a proposal aponta para ela.
- [x] 9.2 Hora da ida ao banco (revisão, ATENÇÃO): a expressão própria do contrato e o campo nativo da tela vêm da GGVP-44, já na `main`, e ficam fora deste PR. A `campos` ainda não tem `validarHora`, pendência anotada na proposal.
- [x] 9.3 Rodar a verificação. Só mudou documentação: `openspec validate --all --strict` sem erro.

## Sétima revisão do PR (08/10)

- [x] 10.1 GGVP-98 e GGVP-22: as candidatas em `docs/requisitos/candidatas/` ganharam no topo uma nota com o refinamento do Lucas de 06/10 e o épico GGVP-11 (conferido no Jira), apontando para o cartão e a spec que valem:
  - na GGVP-98, o aviso e a ida ao banco são do Financeiro, e o Atendimento leva;
  - na GGVP-22, a tarefa é "Explicar resultado", de quem fala.
- [x] 10.2 Reescrever as mensagens antigas (squash), como a revisão sugeriu, pede reescrever o histórico e forçar o envio, o que é proibido neste repositório, e o combinado é merge sem squash. Fica o plano do PR: depois do merge, devolver os cartões que a automação mover.
- [x] 10.3 Rodar a verificação. Só mudou documentação: `openspec validate --all --strict` sem erro.

## Q21 respondida (08/10)

- [x] 11.1 GGVP-98 · CA8: o Mateus decidiu que a separação de funções fica sem número na lista de portões. A Q21 ficou marcada como respondida em `docs/requisitos/duvidas-abertas.md`. Proposal, design e os comentários do código (`governanca.ts`, `prestacao.ts` e o teste) deixaram de dizer "até o Lucas decidir".
- [x] 11.2 Rodar a verificação: typecheck, lint, `openspec validate --all --strict` e os testes dos contratos e da rota da prestação.

## Nona revisão do PR (08/10)

- [x] 12.1 GGVP-98 · CA6: o servidor recusa a ida ao banco numa data que já passou (400), no dia de Brasília (`hojeEmBrasilia`). A tela já limitava com `min`.
  - Teste novo na rota: ontem é recusado e nada é agendado; hoje passa.
  - Os testes da prestação usam um relógio fixo (08/10/2026), para as datas de exemplo (15/10 e 20/10) seguirem no futuro.
  - O Playwright da via administrativa marca a data daqui a 10 dias e não muda.
- [x] 12.2 Comentário de `AgendarIdaAoBanco` (`packages/contratos/src/prestacao.ts`): dizia que quem acompanha é opcional, mas o contrato e o CA6 exigem. Corrigido.
- [x] 12.3 Fuso fixo `-03:00` na rota (revisão, "Prazo"): é a hora de Brasília, sem horário de verão desde 2019, a mesma regra de `hojeEmBrasilia` e das outras rotas, e o comentário está na linha. Fica.
- [x] 12.4 Hora sem a `campos` (revisão, "Campos"): a `campos` não tem campo de hora. Segue a pendência da tarefa 9.2.
- [x] 12.5 `abrirExplicacaoDoResultado` na rota e importada pela semente (revisão, "aceitável"): o estudo de caso do #26 (`estudo.ts`) já importa de `rotas/resultado.ts`, e mover agora quebraria o #26 no merge. Fica onde está.
- [x] 12.6 Rodar a verificação, sobre a `main` com o #22:
  - typecheck e lint sem erro; `openspec validate --all --strict` com 13 de 13;
  - contratos 100 e API 329 (1 teste novo);
  - Playwright da via administrativa com 11 de 11, incluindo a ida ao banco.

## Revisão do PR #37 (08/10)

- [x] 13.1 GGVP-98 · CA6: a checagem comparava só o dia, então hoje numa hora que já passou era aceito, e a ida ficava no passado. Agora o servidor compara o momento inteiro, data e hora de Brasília, e o mesmo `quando` vai para o agendamento.
  - Teste: ontem e hoje às 10:00 (o relógio fixo marca 12:00) são recusados, e nada é agendado; hoje às 14:00 passa.
  - A mensagem passou a dizer "data ou hora que já passou".
- [x] 13.2 Verificação: typecheck e lint sem erro; `openspec validate --all --strict` com 14 de 14; prestação 19 de 19; Playwright da via administrativa 11 de 11.

## Próximo PR do épico (adiado na revisão de 08/10)

- [ ] 7.1 GGVP-22 · CA4: coluna `tarefa_id` em `atendimento`, numa migração, e a lista de contatos passa a ler a coluna; o histórico deixa de ser a fonte.
  - Ficou fora deste PR para não abrir mais um choque de migração: o #26 e o #29 já disputam os números a partir da 0013.
  - Até lá, o vínculo vem do histórico, gravado na mesma transação do atendimento (5.2).

## Revisão de 08/10 · resumo com [completar] (GGVP-22 CA6)

- [x] 11.1 CA6 · `faltaCompletar` em `packages/contratos/src/ia.ts` (texto com "[completar...]" → motivo; senão nulo); teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 11.2 CA6 · `POST /api/casos/:id/resultado/resumo` recusa com `faltaCompletar` (400, nada muda); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 11.3 CA6 · Tela "Explicar o resultado": "Aprovar o resumo" mostra o motivo e não envia; teste Vitest; verifica com `pnpm --filter @ggv/web test`.

## GGVP-90 · Confirmar o desfecho de mérito (CA3 e CA4; orquestrador, 09/10)

- [x] 14.1 Contratos: `DesfechoParaConfirmar` e `ConfirmarDesfecho` em `packages/contratos/src/merito.ts` (as quatro opções, a causa obrigatória na extinção, a forma de pagamento opcional); teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 14.2 Servidor: `GET /api/casos/:id/desfecho` (com `caso.ver`) e `POST /api/casos/:id/desfecho` (com `publicacao.classificar`, advogada e Sênior, sem mudar a matriz) em `apps/api/src/rotas/desfecho.ts`: grava o desfecho e a causa no caso, a decisão com quem e quando, fecha a tarefa e a etapa D4.02 numa transação que só a primeira confirmação vence, e abre "Acompanhar pagamento" (D3b.01) ou "Vale recorrer?" para a advogada responsável; a Central leva o D4.02, o D3b.01 e o "Vale recorrer?" à tela nova; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 14.3 Tela `/casos/:id/desfecho` (`ConfirmarDesfecho.tsx`): o trecho da decisão, a leitura da IA com a confiança, o prazo do recurso, as quatro opções, a causa, a forma de pagamento, "Confirmar desfecho" e o feito com quem e quando; outro perfil vê só a situação; teste Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 14.4 Rodar typecheck, lint e testes; colar a saída. Sem teste de navegador novo: a semente não tem caso esperando "Confirmar desfecho" (no roteiro, nasce ao classificar como mérito uma publicação de exemplo); a tela tem teste Vitest.
