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

## GGVP-35 · Vigiar o Meu INSS todo dia (entra quando o cartão estiver em "Refinada")

- [ ] 4.1 Contrato `RespostaDoInss` (decisão ou exigência; data por `validarData`); teste; verifica com `pnpm --filter @ggv/contratos test`.
- [ ] 4.2 CA1 · A junção abre "Trazer a resposta do INSS" para a advogada, em `apps/api/src/fluxo/juncao-d2.ts`; teste em `juncao-d2.test.ts`; verifica com `pnpm --filter @ggv/api test`.
- [ ] 4.3 CA3, CA5, CA6, CA7, CA8, CA10 · `GET /api/casos/:id/vigilia` e `POST /api/casos/:id/vigilia` (comunicação anexada, deferido, deferido diferente do pedido, exigência com texto e data, histórico); teste; verifica com `pnpm --filter @ggv/api test`.
- [ ] 4.4 CA3, CA5, CA6, CA7 · Tela "Vigília" em `apps/web/src/paginas/Vigilia.tsx`; teste Vitest; verifica com `pnpm --filter @ggv/web test`.
- [ ] 4.5 Playwright: registrar uma decisão de deferido e uma exigência num caso em vigília; verifica com `pnpm --filter @ggv/web e2e`.
- [ ] 4.6 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-48 · Indeferido segue para a Justiça

- [ ] 5.1 Contrato `EncerrarCaso`; verifica com `pnpm --filter @ggv/contratos test`.
- [ ] 5.2 CA1, CA2, CA3 · Indeferido no `POST /api/casos/:id/vigilia`: carta obrigatória, caso para `judicial`, etapa `D3.01` e tarefa "Registrar indeferimento" com a carta e o motivo do INSS; teste; verifica com `pnpm --filter @ggv/api test`.
- [ ] 5.3 CA1 · `POST /api/casos/:id/encerrar` (só Sênior, motivo obrigatório, tarefas canceladas, histórico); teste; verifica com `pnpm --filter @ggv/api test`.
- [ ] 5.4 Tela: "Indeferido" na Vigília exige a carta; "Encerrar sem judicializar" para a Sênior; teste Vitest; verifica com `pnpm --filter @ggv/web test`.
- [ ] 5.5 Playwright: indeferido com a carta abre "Registrar indeferimento" para a advogada; verifica com `pnpm --filter @ggv/web e2e`.
- [ ] 5.6 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
