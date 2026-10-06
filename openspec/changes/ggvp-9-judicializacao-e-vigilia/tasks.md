# Tasks

## GGVP-34 · Classificar o ato e contar o prazo (base do grupo)

- [x] 1.1 Matriz versão 5 (`vigilia.ver`, `vigilia.reprocessar`, `publicacao.casar`, `publicacao.classificar`) e contratos de `justica.ts` (`ClassificarPublicacao`, `PublicacaoParaLer`, `PublicacoesDoCaso`); teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 1.2 Migração 0009 (fila e vínculo da publicação, versão da regra do prazo, reprocessamento da rodada, descartes e reclassificações); verifica com `pnpm --filter @ggv/api test`.
- [x] 1.3 CA2, CA6, CA7, CA8, CA9 · Prazo judicial em `apps/api/src/fluxo/prazo-judicial.ts` (Lei 11.419, art. 4º; dias úteis; 5 dias sem prazo; feriados nacionais e do tribunal do CNJ; regra versionada); teste com véspera de feriado, fim de semana e suspensão; verifica com `pnpm --filter @ggv/api test`.

## GGVP-26 · Receber e casar a publicação pelo número CNJ

- [x] 2.1 Fontes atrás de uma interface e a fonte de exemplo em `apps/api/src/vigilia/fontes.ts`; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 2.2 CA1, CA2, CA3, CA4, CA5 · Casar em `apps/api/src/vigilia/casar.ts` (hash sem a fonte, descarte registrado, ligação pelo CNJ, fila de revisão) com "Ler publicação" para a advogada; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 2.3 CA7, CA8, CA10, CA11, CA12 · `GET /api/publicacoes/fila`, `POST /api/publicacoes/:id/vinculo` e o item no topo da Sênior com prazo perto; teste; verifica com `pnpm --filter @ggv/api test`.

## GGVP-30 · Vigiar 3 vezes por dia com alarme de falha

- [x] 3.1 CA7, CA8, CA9 · Rodadas em `apps/api/src/vigilia/rodadas.ts` (planejar o dia, rodar com tempo-limite, falha com erro, "não rodou") e o relógio em `principal.ts`; teste com fonte que falha; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.2 CA1, CA3, CA5, CA6, CA11 · `TarefaDaCentral` com `contexto`; linha "Reprocessar vigília" no topo da fila da Sênior; `POST /api/vigilia/rodadas/:id/reprocessar`; registro ao suporte na falha de credencial; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.3 CA2, CA4, CA12 e GGVP-26 CA6 · `GET /api/vigilia` (rodadas do dia, contagem, situação do dia, fila e a consulta dos descartes); teste; verifica com `pnpm --filter @ggv/api test`.

## GGVP-37 · Encaminhar pelo tipo de ato

- [x] 4.1 CA1 a CA7 · Encaminhar em `apps/api/src/vigilia/encaminhar.ts` (andamento sem tarefa; exigência com "Analisar exigência do juiz"; mérito com "Confirmar desfecho"; reclassificar cancela e refaz); teste; verifica com `pnpm --filter @ggv/api test`.

## GGVP-74 · Vigiar o processo e ler a publicação

- [x] 5.1 CA1 a CA7 e GGVP-34 CA1, CA3, CA4, CA5, CA10 · `GET /api/publicacoes/:id`, `POST /api/publicacoes/:id/classificacao` e `GET /api/casos/:id/publicacoes`; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 5.2 Dados de exemplo: dois casos judiciais com CNJ, horários da vigília e uma rodada que falhou; verifica entrando como Sênior e como advogada.
- [x] 5.3 Telas "Painel da vigília", "Ler publicação" e "Publicações do processo"; a Central mostra o contexto no lugar do cliente; testes Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 5.4 Playwright: a Sênior vê o alarme, reprocessa e vincula um item da fila; a advogada lê uma exigência e a tarefa "Analisar exigência do juiz" aparece com o prazo; reclassifica um andamento; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 5.5 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-79 · Analisar a exigência e criar a tarefa do setor

- [x] 6.1 Matriz versão 6 e contratos `ExigenciaDoJuiz` e `AnalisarExigenciaJuiz`; migração 0010; teste; verifica com `pnpm --filter @ggv/contratos test` e `pnpm --filter @ggv/api test`.
- [x] 6.2 CA1, CA2, CA4 a CA10, CA12, CA13 · `GET` e `POST /api/casos/:id/exigencia-juiz` (ciência registrada e volta à vigília; itens por setor com prazo interno até o processual; tarefas dos setores com o limite; perícia com a origem D3a; só advogada distribui); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 6.3 Tela "Analisar a exigência do juiz" (texto, prazo com a regra, itens editáveis, status de cada setor); teste Vitest; verifica com `pnpm --filter @ggv/web test`.

## GGVP-83 · Laços dos setores na exigência do juiz

- [x] 7.1 Contratos `ItensDoSetor`, `RegistrarTentativa` e `NaoVouConseguir`; teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 7.2 CA1, CA4 a CA8, CA11, CA13, CA14 · `GET /api/casos/:id/exigencia-juiz/setor`, tentativas, "não vou conseguir" e "consegui" com a evidência; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 7.3 CA2, CA3, CA10 · status de cada setor e o resultado da perícia na análise; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 7.4 Tela "Cumprir a exigência do juiz" (um setor por vez); teste Vitest; verifica com `pnpm --filter @ggv/web test`.

## GGVP-87 · Manifestar e protocolar

- [x] 8.1 Contratos `Manifestacao`, `ProtocolarManifestacao` e `RegistrarIndisponibilidade`; `prazoDepoisDaIndisponibilidade` com teste (Lei 11.419, art. 10, §2º); verifica com `pnpm --filter @ggv/contratos test` e `pnpm --filter @ggv/api test`.
- [x] 8.2 CA1, CA3, CA5, CA6, CA9 · "Manifestar no processo" quando o último item ganha prova; versões, aprovação e bloqueios; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 8.3 CA2, CA10, CA12, CA13 · protocolo (volta à vigília, linha do processo), dilação com o OK da Sênior e tribunal fora do ar; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 8.4 CA4 · alerta da Sênior para a exigência do juiz (5 e 2 dias úteis; vencida decide); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 8.5 Tela "Manifestar" e dados de exemplo (uma exigência do juiz já classificada para a advogada analisar); teste Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 8.6 Playwright: a advogada distribui à Documentação e ao Atendimento; os dois sobem a prova; a advogada anexa, aprova, protocola e o processo volta para a vigília; verifica com `pnpm --filter @ggv/web e2e`.
- [ ] 8.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
