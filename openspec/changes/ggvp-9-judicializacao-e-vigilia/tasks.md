# Tasks

## GGVP-34 · Classificar o ato e contar o prazo (base do grupo; começa quando o cartão estiver em "Refinada")

- [ ] 1.1 Matriz versão 5 (`vigilia.ver`, `vigilia.reprocessar`, `publicacao.casar`, `publicacao.classificar`) e contratos de `justica.ts` (`ClassificarPublicacao`, `PublicacaoParaLer`, `PublicacoesDoCaso`); teste; verifica com `pnpm --filter @ggv/contratos test`.
- [ ] 1.2 Migração 0009 (fila e vínculo da publicação, versão da regra do prazo, reprocessamento da rodada, descartes e reclassificações); verifica com `pnpm --filter @ggv/api test`.
- [ ] 1.3 CA2, CA6, CA7, CA8, CA9 · Prazo judicial em `apps/api/src/fluxo/prazo-judicial.ts` (Lei 11.419, art. 4º; dias úteis; 5 dias sem prazo; feriados nacionais e do tribunal do CNJ; regra versionada); teste com véspera de feriado, fim de semana e suspensão; verifica com `pnpm --filter @ggv/api test`.

## GGVP-26 · Receber e casar a publicação pelo número CNJ (começa quando o cartão estiver em "Refinada")

- [ ] 2.1 Fontes atrás de uma interface e a fonte de exemplo em `apps/api/src/vigilia/fontes.ts`; teste; verifica com `pnpm --filter @ggv/api test`.
- [ ] 2.2 CA1, CA2, CA3, CA4, CA5 · Casar em `apps/api/src/vigilia/casar.ts` (hash sem a fonte, descarte registrado, ligação pelo CNJ, fila de revisão) com "Ler publicação" para a advogada; teste; verifica com `pnpm --filter @ggv/api test`.
- [ ] 2.3 CA6, CA7, CA8, CA10, CA11, CA12 · `GET /api/publicacoes/fila`, `POST /api/publicacoes/:id/vinculo` e o item no topo da Sênior com prazo perto; teste; verifica com `pnpm --filter @ggv/api test`.

## GGVP-30 · Vigiar 3 vezes por dia com alarme de falha

- [ ] 3.1 CA7, CA8, CA9 · Rodadas em `apps/api/src/vigilia/rodadas.ts` (planejar o dia, rodar com tempo-limite, falha com erro, "não rodou") e o relógio em `principal.ts`; teste com fonte que falha; verifica com `pnpm --filter @ggv/api test`.
- [ ] 3.2 CA1, CA3, CA5, CA6, CA11 · `TarefaDaCentral` com `contexto`; linha "Reprocessar vigília" no topo da fila da Sênior; `POST /api/vigilia/rodadas/:id/reprocessar`; registro ao suporte na falha de credencial; teste; verifica com `pnpm --filter @ggv/api test`.
- [ ] 3.3 CA2, CA4, CA12 · `GET /api/vigilia` (rodadas do dia, contagem, situação do dia, fila e descartes); teste; verifica com `pnpm --filter @ggv/api test`.

## GGVP-37 · Encaminhar pelo tipo de ato

- [ ] 4.1 CA1 a CA7 · Encaminhar em `apps/api/src/vigilia/encaminhar.ts` (andamento sem tarefa; exigência com "Analisar exigência do juiz"; mérito com "Confirmar desfecho"; reclassificar cancela e refaz); teste; verifica com `pnpm --filter @ggv/api test`.

## GGVP-74 · Vigiar o processo e ler a publicação

- [ ] 5.1 CA1 a CA7 e GGVP-34 CA1, CA3, CA4, CA5, CA10 · `GET /api/publicacoes/:id`, `POST /api/publicacoes/:id/classificacao` e `GET /api/casos/:id/publicacoes`; teste; verifica com `pnpm --filter @ggv/api test`.
- [ ] 5.2 Dados de exemplo: dois casos judiciais com CNJ, horários da vigília e uma rodada que falhou; verifica entrando como Sênior e como advogada.
- [ ] 5.3 Telas "Painel da vigília", "Ler publicação" e "Publicações do processo"; a Central mostra o contexto no lugar do cliente; testes Vitest; verifica com `pnpm --filter @ggv/web test`.
- [ ] 5.4 Playwright: a Sênior vê o alarme, reprocessa e vincula um item da fila; a advogada lê uma exigência e a tarefa "Analisar exigência do juiz" aparece com o prazo; reclassifica um andamento; verifica com `pnpm --filter @ggv/web e2e`.
- [ ] 5.5 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
