# Tasks

<!-- Uma correção por vez, na ordem. Cada tarefa: o teste que reproduz o erro (falha antes), a correção mínima, o teste
     passando. Todo teste usa o fornecedor de mentira (Chatwoot, Drive, armazenamento, Gotenberg, DJEN, AASP e IA). -->

## GGVP-158 · 1. Chatwoot e mensagens

- [x] 1.1 I1 · A repetição só no mesmo dia: `apps/api/src/rotas/mensagens.ts` (`enviar`, a busca da repetida filtra `enviadaEm` desde o início do dia em Brasília). Teste em `src/rotas/mensagens.test.ts`: a mesma mensagem amanhã chama o Chatwoot de novo; hoje, não. Verifica com `pnpm --filter @ggv/api exec vitest run src/rotas/mensagens.test.ts`.
- [x] 1.2 I2 · O registro da perícia pela mais nova de hoje: `apps/api/src/rotas/pericia.ts` (`envioDe`). Teste em `src/rotas/pericia.test.ts`: a de hoje falhou e a de ontem saiu, 409; a de hoje saiu, registra.
- [x] 1.3 I3 · Convite, confirmação e tentativa pelo Chatwoot com a mensagem que saiu hoje: `apps/api/src/rotas/recepcao-agenda.ts` (convite e confirmação) e `apps/api/src/rotas/recepcao-cobranca.ts` (tentativa com canal `chatwoot`). Testes em `src/rotas/recepcao-agenda.test.ts` e no teste da cobrança: sem a mensagem, 409; com ela, registra.
- [x] 1.4 I4 · O aviso da pendência do contrato diz que não foi enviado pelo portal: `apps/api/src/rotas/recepcao-contrato.ts`. Teste em `src/rotas/recepcao-contrato.test.ts`.
- [x] 1.5 I5 · Tempo esgotado sem duplicar: `apps/api/src/chatwoot.ts` (a mensagem do escritório com o mesmo texto na conversa, depois de uma hora) e `apps/api/src/rotas/mensagens.ts` (`sair`, só depois de uma falha de hoje por "o Chatwoot não respondeu"). Teste em `src/rotas/mensagens.test.ts`: a primeira expira, a segunda acha a mensagem e não envia.
- [x] 1.6 I6 · O erro na entrada do Chatwoot no log: `apps/api/src/rotas/chatwoot-entrada.ts`. Teste em `src/rotas/chatwoot-entrada.test.ts`: o `receber` que lança deixa a linha no log, sem o segredo nem o texto.

## GGVP-158 · 2. Drive, armazenamento e PDF

- [x] 2.1 I7 · O registro digital só com o conteúdo guardado: `apps/api/src/rotas/recepcao-documentos.ts` (`/api/tarefas/:id/registro`). Teste em `src/rotas/recepcao-documentos.test.ts`.
- [x] 2.2 I8 · Sem a lista do Drive, nada de pasta nova: `apps/api/src/rotas/recepcao.ts` (`/api/fichas/:id/pasta`). Teste em `src/rotas/recepcao.test.ts` com o Drive falso que falha na lista.
- [x] 2.3 I9 · A leitura que falha no protocolo é 503, sem bloqueio: `apps/api/src/rotas/peticao.ts`. Teste em `src/rotas/peticao.test.ts` com o armazenamento que falha na leitura.
- [x] 2.4 I10 · O contrato não fica preso: `apps/api/src/rotas/recepcao-contrato.ts` (a leitura do assinado na assinatura em papel) e `apps/api/src/rotas/recepcao-documentos.ts` (`conteudoGuardado` no arquivamento), sem derrubar o pedido depois de gravar. Teste em `src/rotas/recepcao-contrato.test.ts`: com o armazenamento fora, 200 e o contrato na conferência.
- [x] 2.5 I11 · O Gotenberg sem PDF é falha: `apps/api/src/kit/pdf.ts`. Teste em `src/kit/pdf.test.ts`.
- [x] 2.6 I12 · O que o scanner deixou de fora volta na rodada seguinte: `apps/api/src/fluxo/scanner.ts` (`drive:de-fora` na `configuracao`). Teste em `src/fluxo/scanner.test.ts`: a pasta ligada depois traz o arquivo.

## GGVP-158 · 3. Diário (DJEN e AASP)

- [ ] 3.1 I13 · Motivo seguro: `apps/api/src/vigilia/rodadas.ts` (`rodar`) e `apps/api/src/vigilia/djen.ts` (a resposta que não é JSON). Teste em `src/vigilia/rodadas.test.ts`: o erro com o texto da publicação não chega à rodada nem ao suporte.
- [ ] 3.2 I14 · A frase do suporte pelas entregas: `apps/api/src/vigilia/rodadas.ts` (`semFonteHoje`) e `apps/api/src/rotas/vigilia-diario.ts`. Teste em `src/rotas/vigilia-diario.test.ts`.
- [ ] 3.3 I15 · AASP fora do formato: `apps/api/src/vigilia/aasp.ts`. Teste em `src/vigilia/aasp.test.ts`.
- [ ] 3.4 I16 · DJEN fora do formato ou parado antes do total: `apps/api/src/vigilia/djen.ts`. Teste em `src/vigilia/djen.test.ts`.
- [ ] 3.5 I17 · AASP com CNJ fora do formato vai à fila: `apps/api/src/vigilia/aasp.ts`. Teste em `src/vigilia/aasp.test.ts`.
- [ ] 3.6 I18 e I19 · O painel: contrato `PainelDaVigilia` com `sem_fonte` (`packages/contratos`); `GET /api/vigilia` (`apps/api/src/rotas/vigilia-diario.ts`); a tela `apps/web/src/paginas/PainelVigilia.tsx` (o texto e o tom do `sem_fonte`; a falha do reprocessar como erro). Testes em `src/rotas/vigilia-diario.test.ts` e `apps/web/src/paginas/PainelVigilia.test.tsx`. Antes, conferir os PRs abertos.

## GGVP-158 · 4. Tela sem resposta do servidor

- [ ] 4.1 I20 · `chamarApi` com a rede caída: `apps/web/src/api.ts`. Teste em `apps/web/src/api.test.ts`. Antes, conferir os PRs abertos.

## GGVP-158 · 5. IA

- [ ] 5.1 A1 · Senha no chat: `apps/api/src/rotas/chat.ts` (a pergunta, as anteriores e a fala). Teste em `src/rotas/chat.test.ts`: o corpo que vai à IA de mentira não tem a senha; a fala transcrita volta sem ela.
- [ ] 5.2 A2 · Senha no WhatsApp com a mensagem anterior: `apps/api/src/rotas/conversa.ts` (`receberDoWhatsapp`). Teste em `src/rotas/conversa.test.ts`.
- [ ] 5.3 A3 · Senha no texto do OCR: `apps/api/src/ia/ia.ts` (`lerDocumento`). Teste em `src/ia/ia.test.ts`.
- [ ] 5.4 A4 · O aviso de G22 na tela da manifestação: `apps/web/src/paginas/Manifestar.tsx`. Teste em `Manifestar.test.tsx`. Antes, conferir os PRs abertos.
- [ ] 5.5 A5 · O anexo é dado: `REGRAS_DA_IA` em `apps/api/src/ia/ia.ts`. Teste em `src/ia/ia.test.ts`.
- [ ] 5.6 A6 · A entrevista confere a fala: `apps/api/src/fluxo/transcricao.ts` (`lerEntrevista`). Teste novo em `src/fluxo/transcricao.test.ts`.
- [ ] 5.7 A7 · A leitura fora do formato é falha: `packages/contratos/src/recepcao.ts` (`LidoPelaIa`) e `apps/api/src/fluxo/leitura.ts` (`semSenha`). Testes em `packages/contratos/src/recepcao.test.ts` e `src/fluxo/leitura.test.ts`.
- [ ] 5.8 A8 · A leitura de exemplo não sobe em produção: `apps/api/src/servidor.ts`. Teste em `src/servidor.test.ts`.

## GGVP-158 · 6. Eval da leitura

- [ ] 6.1 A9 · O eval em `apps/api/src/ia/eval/`:
  - `documentos.ts`: 14 documentos inventados com a resposta certa;
  - `leitura.ts`: a nota campo a campo;
  - `pdf-de-texto.ts`: o PDF de texto;
  - `rodar.ts`: a rodada de verdade, só com `--de-verdade`;
  - o script `eval:leitura` no `package.json` da API.

  Teste em `src/ia/eval/leitura.eval.test.ts`, contra a IA de mentira: 100% dos campos. Sem `--de-verdade`, o comando sai sem chamar a IA.

## GGVP-158 · 7. Fechamento

- [ ] 7.1 Variável nova: nenhuma. Conferir `variaveis.test.ts` e a tabela de `docs/infra/homologacao.md` sem mudança.
- [ ] 7.2 Rodar typecheck, lint, testes e Playwright, uma suíte por vez; colar a saída no relatório. Rodar `openspec validate --all --strict`.
- [ ] 7.3 Trazer a `main` por merge, resolver conflitos e abrir o PR "GGVP-158: ..." com o template, sem mesclar.
