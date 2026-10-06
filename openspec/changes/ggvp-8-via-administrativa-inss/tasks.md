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
- [ ] 2.5 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
