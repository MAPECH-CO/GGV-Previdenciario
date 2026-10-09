# Tasks

## GGVP-27 · Protocolar no Meu INSS

- [x] 1.1 Contratos `TarefaDaCentral`, `CasoParaProtocolo`, `RegistrarProtocolo` e `SenhaDoCofre` em `packages/contratos`; DER por `validarData` e `dataParaIso`; teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 1.2 Armazenamento de arquivo (Supabase Storage ou pasta local) e cofre (AES-256-GCM) em `apps/api/src/`; teste de cifra e decifra; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.3 Junção do D2 em `apps/api/src/fluxo/juncao-d2.ts`, com teste das quatro combinações; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.4 CA1, CA3, CA4, CA5, CA6, CA7 · Rotas `GET /api/tarefas`, `GET /api/casos/:id/protocolo`, `POST /api/casos/:id/protocolo` e `POST /api/casos/:id/cofre`; teste das recusas (G2, obrigatórios, perfil) e do histórico do cofre; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.5 Dados de exemplo no banco local: caso aprovado pela Sênior, documentos, senha no cofre e as tarefas; verifica entrando como Jurídico administrativo.
- [x] 1.6 Tela: Central do perfil pela API e "Protocolar no Meu INSS"; testes Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 1.7 Playwright: protocolar um caso de exemplo; verifica com `pnpm --filter @ggv/web e2e`.

## GGVP-31 · Mandar para perícia quando o benefício pede

- [x] 2.1 Contrato `DecidirPericia`; ação `pericia.decidir` na matriz (versão 2); verifica com `pnpm --filter @ggv/contratos test`.
- [x] 2.2 CA1, CA2, CA3, CA5, CA6, CA7 · Rota `POST /api/casos/:id/pericia`: decisão com autora e horário, perícia por tipo, tarefa do Jurídico administrativo aberta pelo sistema, junção; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 2.3 Tela "Decidir perícia" ("Definir" só com a resposta); testes Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 2.4 Playwright: a advogada decide e a tarefa aparece para o Jurídico administrativo; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 2.5 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-23 · Conferência do sênior antes do INSS

- [x] 3.1 Matriz versão 3 (`caso.ver`, `inss.registrar_resposta`, `caso.encerrar`) e contratos `CasoParaConferencia`, `DecidirConferencia` e `DispensarParecer` em `packages/contratos`; teste em `permissoes.test.ts` e `inss.test.ts`; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 3.2 CA1, CA4, CA5, CA6 · `GET /api/casos/:id/conferencia` em `apps/api/src/rotas/inss.ts` (checklist G1, parecer G17, laudo novo esperando, `podeDecidir`); teste em `rotas/inss.test.ts`; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.3 CA2, CA3, CA5, CA7, CA8, CA9, CA10 · `POST /api/casos/:id/conferencia` e `POST /api/casos/:id/parecer/dispensa`: portões G1 e G17 no servidor, aprovar abre as duas tarefas juntas, reprovar com motivo e prazo opcional, nova liberação sem herdar o OK, recusa a outro perfil com histórico; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.4 Dados de exemplo: um caso esperando a conferência com parecer "Suficiente" e um sem parecer; pensão por morte em destaque na fila; verifica entrando como Sênior.
- [x] 3.5 CA1, CA3, CA4, CA5, CA8 · Tela "Conferência" em `apps/web/src/paginas/Conferencia.tsx` (só leitura para quem não é Sênior); teste Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 3.6 Playwright: a Sênior aprova um caso e as tarefas aparecem para o Jurídico administrativo e para a advogada; reprova outro sem motivo e vê a recusa; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 3.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
- [x] 3.8 CA11, CA12 · `bloqueioDoG1` em `packages/contratos` (sem kit, documento faltando, contrato não assinado → motivo; senão nulo); teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 3.9 CA11, CA12 · `POST /api/casos/:id/conferencia` usa `bloqueioDoG1` (recusa 409, G1 no histórico); testes das três recusas; ajustar os testes que aprovavam sem kit; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.10 CA11, CA12 · Tela "Conferência" usa `bloqueioDoG1`: Aprovar desligado com o motivo; teste Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 3.11 Dados de exemplo: kit da pensão por morte com os documentos da Antônia e o contrato dela assinado, para seguir aprovável no roteiro do Lucas; o Benedito continua barrado; verifica entrando como Sênior.
- [x] 3.12 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-35 · Vigiar o Meu INSS todo dia

- [x] 4.1 Contrato `RespostaDoInss` (decisão ou exigência; data por `validarData`); teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 4.2 CA1 · A junção abre "Trazer a resposta do INSS" para a advogada, em `apps/api/src/fluxo/juncao-d2.ts`; teste em `juncao-d2.test.ts`; verifica com `pnpm --filter @ggv/api test`.
- [x] 4.3 CA3, CA5, CA6, CA7, CA8, CA10 · `GET /api/casos/:id/vigilia` e `POST /api/casos/:id/vigilia` (comunicação anexada, deferido, deferido diferente do pedido, exigência com texto e data, histórico); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 4.4 CA3, CA5, CA6, CA7 · Tela "Vigília" em `apps/web/src/paginas/Vigilia.tsx`; teste Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 4.5 Playwright: registrar uma decisão de deferido e uma exigência num caso em vigília; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 4.6 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-48 · Indeferido segue para a Justiça

- [x] 5.1 Contrato `EncerrarCaso`; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 5.2 CA1, CA2, CA3 · Indeferido no `POST /api/casos/:id/vigilia`: carta obrigatória, caso para `judicial`, etapa `D3.01` e tarefa "Registrar indeferimento" com a carta e o motivo do INSS; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 5.3 CA1 · `POST /api/casos/:id/encerrar` (só Sênior, motivo obrigatório, tarefas canceladas, histórico); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 5.4 Tela: "Indeferido" na Vigília exige a carta; "Encerrar sem judicializar" para a Sênior; teste Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 5.5 Playwright: indeferido com a carta abre "Registrar indeferimento" para a advogada; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 5.6 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-39 · Tratar exigência do INSS

- [x] 6.1 Matriz versão 4 (`exigencia_inss.tratar`, `exigencia_inss.cumprir`, `exigencia_inss.decidir_vencida`, `banco.agendar`) e contratos `ExigenciaDoCaso`, `DecidirExigencia`, `RegistrarCobranca`, `CumprirItem`, `ResponderExigencia` e `DecidirVencida`; teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 6.2 Migração 0008 (colunas novas da exigência, do item, da prestação, do contrato e do agendamento); verifica com `pnpm --filter @ggv/api test` (o banco embutido aplica as migrações).
- [x] 6.3 CA7 · Prazo do INSS em `apps/api/src/fluxo/prazo-inss.ts` (dias corridos a partir do dia seguinte; fim sem expediente vai ao próximo dia útil; tabela `feriado`) e dias úteis até o prazo; teste com fim de semana, feriado e véspera; verifica com `pnpm --filter @ggv/api test`.
- [x] 6.4 CA1, CA2, CA6, CA7, CA8, CA9, CA10 · `GET /api/casos/:id/exigencia` e `POST /api/casos/:id/exigencia` (decidir: itens, tipos de perícia, dias do INSS, prazo de entrega até o prazo do INSS, card da Documentação com limite e lembrete, ou tarefa de perícia); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 6.5 CA5, CA11, CA12 · `POST /api/casos/:id/exigencia/cobrancas` (tentativa com data, canal e resultado; limite da configuração; escalada à Sênior) e `POST /api/casos/:id/exigencia/itens/:item` (prova ou "não cumprido" com motivo); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 6.6 CA2, CA3, CA4, CA6, CA13 · `POST /api/casos/:id/exigencia/resposta` (G21, data e comprovante, perícia depois dos documentos, volta à vigília) e `avancarExigencia` (resultado das perícias devolve à vigília); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 6.7 CA14 · Fila da Sênior: "Exigência perto do prazo" a 5 dias úteis, topo a 2, vencida com "pedir dilação ou registrar a perda"; `POST /api/casos/:id/exigencia/vencida`; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 6.8 Dados de exemplo: configuração de cobrança (3 e 2) e um caso com exigência esperando a advogada; verifica entrando como advogada.
- [x] 6.9 Telas "Tratar exigência" (advogada e Sênior) e "Cumprir exigência" (Documentação); testes Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 6.10 Playwright: a advogada decide "Documentos", a Documentação cobra, junta a prova e responde, e o caso volta para a vigília; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 6.11 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-44 · Benefício deferido: prestação de contas e ida ao banco

- [x] 7.1 Contratos `PrestacaoDoCaso`, `SalvarPrestacao`, `ReceberPrestacao`, `IdaAoBancoDoCaso`, `AgendarIdaAoBanco` e `RegistrarEnvio`; teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 7.2 CA5 · Cálculo da prestação (`calcularPrestacao` em `packages/contratos`) (centavos; honorários pelo piso; repasse); teste com centavos quebrados; verifica com `pnpm --filter @ggv/api test`.
- [x] 7.3 CA1, CA2, CA4, CA5, CA6, CA7 · `GET` e `POST /api/casos/:id/prestacao` (carta ligada na vigília, percentual do contrato, conferência obrigatória, concluir abre Financeiro e Atendimento juntos, nova versão ao alterar); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 7.4 CA8, CA9 · `POST /api/casos/:id/prestacao/recebimento` (recebido com quem e quando; divergência com motivo volta à advogada; a mesma pessoa do OK não recebe); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 7.5 CA3, CA10, CA11, CA12 · `GET` e `POST /api/casos/:id/banco` (quatro campos obrigatórios, remarcar, sem valores) e `POST /api/casos/:id/banco/envio` (modelo, G8, registro da mensagem); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 7.6 Dados de exemplo: modelo "Confirmação da ida ao banco", contratos com 30% e um caso deferido com "Prestar contas" e a carta; verifica entrando como advogada.
- [x] 7.7 Telas "Prestar contas", "Receber a prestação" e "Agendar ida ao banco"; testes Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 7.8 Playwright: a advogada conclui a prestação, o Financeiro recebe, o Atendimento agenda e registra a confirmação; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 7.9 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
- [x] 7.10 CA13 (orquestrador, 09/10) · `GET` e `POST /api/casos/:id/prestacao`: com `caso.advogadaResponsavelId`, só a advogada responsável vê e dá o OK; outra advogada recebe 403 e a recusa vai ao histórico; o Financeiro e o caso sem responsável seguem como estão; teste em `prestacao.test.ts`; verifica com `pnpm --filter @ggv/api exec vitest run src/rotas/prestacao.test.ts`.
- [x] 7.11 Rodar typecheck, lint e testes; colar a saída.
