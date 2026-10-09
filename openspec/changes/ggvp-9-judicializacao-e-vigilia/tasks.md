# Tasks

## GGVP-34 · Classificar o ato e contar o prazo (base do grupo)

- [x] 1.1 Matriz versão 5 (`vigilia.ver`, `vigilia.reprocessar`, `publicacao.casar`, `publicacao.classificar`) e contratos de `justica.ts` (`ClassificarPublicacao`, `PublicacaoParaLer`, `PublicacoesDoCaso`); teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 1.2 Migração 0009 (fila e vínculo da publicação, versão da regra do prazo, reprocessamento da rodada, descartes e reclassificações); verifica com `pnpm --filter @ggv/api test`.
- [x] 1.3 CA2, CA6, CA7, CA8, CA9 · Prazo judicial em `apps/api/src/fluxo/prazo-judicial.ts` (Lei 11.419, art. 4º; dias úteis; 5 dias sem prazo; feriados nacionais e do tribunal do CNJ; regra versionada); teste com véspera de feriado, fim de semana e suspensão; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.4 CA3, CA11 (revisão de 07/10) · CA3: a leitura da publicação devolve a data inicial, a final e a regra (`publicacoes.test.ts`; a tela já tinha teste). CA11: teste próprio de dias corridos, com o fim de semana no meio contando (`prazo-inss.test.ts`).

## GGVP-26 · Receber e casar a publicação pelo número CNJ

- [x] 2.1 Fontes atrás de uma interface e a fonte de exemplo em `apps/api/src/vigilia/fontes.ts`; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 2.2 CA1, CA2, CA3, CA4, CA5 · Casar em `apps/api/src/vigilia/casar.ts` (hash sem a fonte, descarte registrado, ligação pelo CNJ, fila de revisão) com "Ler publicação" para a advogada; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 2.3 CA7, CA8, CA10, CA11, CA12 · `GET /api/publicacoes/fila`, `POST /api/publicacoes/:id/vinculo` e o item no topo da Sênior com prazo perto; teste; verifica com `pnpm --filter @ggv/api test`.

## GGVP-30 · Vigiar 3 vezes por dia com alarme de falha

- [x] 3.1 CA7, CA8, CA9 · Rodadas em `apps/api/src/vigilia/rodadas.ts` (planejar o dia, rodar com tempo-limite, falha com erro, "não rodou") e o relógio em `principal.ts`; teste com fonte que falha; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.2 CA1, CA3, CA5, CA6, CA11 · `TarefaDaCentral` com `contexto`; linha "Reprocessar vigília" no topo da fila da Sênior; `POST /api/vigilia/rodadas/:id/reprocessar`; registro ao suporte na falha de credencial; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.3 CA2, CA4, CA12 e GGVP-26 CA6 · `GET /api/vigilia` (rodadas do dia, contagem, situação do dia, fila e a consulta dos descartes); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.4 CA10 (revisão de 07/10) · as fontes vêm só do ambiente e o banco não tem coluna onde caiba credencial de fonte (`fontes.test.ts`); segredo no código, o gitleaks do CI barra.

## GGVP-37 · Encaminhar pelo tipo de ato

- [x] 4.1 CA1 a CA7 · Encaminhar em `apps/api/src/vigilia/encaminhar.ts` (andamento sem tarefa; exigência com "Analisar exigência do juiz"; mérito com "Confirmar desfecho"; reclassificar cancela e refaz); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 4.2 CA6 (revisão de 07/10) · casada, a publicação chega sem classe e sem leitor; só a classificação da advogada a registra como andamento, com quem e quando (`publicacoes.test.ts`).

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
- [x] 8.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-52 · Registrar o motivo do indeferimento

- [x] 9.1 Matriz versão 7 (`pendencia.cumprir`, `peticao.protocolar`) em `packages/contratos/src/permissoes.ts`, com a impressão digital nova no teste; contratos `Indeferimento` e `RegistrarMotivo` em `justica.ts`; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 9.2 Migração 0011 pelo `db:gerar` (origem `despacho`, `exigencia_item.informacao`, motivo escrito no `resultado_inss`, pedido e citados na `peticao`, pacote na `peticao_versao`); verifica com o teste das migrações em `pnpm --filter @ggv/api test`.
- [x] 9.3 CA3 · `GET /api/casos/:id/documentos/:doc` em `apps/api/src/rotas/documentos.ts` (sensível só com `dado_saude.ver_detalhe`, gravando `acesso_dado_sensivel`); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 9.4 CA1 a CA7 · `GET /api/casos/:id/indeferimento` e `POST /api/casos/:id/indeferimento/motivo` em `apps/api/src/rotas/indeferimento.ts` (motivo e carta obrigatórios; grava sem duplicar; conclui `D3.01`; nasce "Despachar caso"; histórico); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 9.5 Tela "Registrar indeferimento" (`apps/web/src/paginas/RegistrarIndeferimento.tsx`), a rota no `App.tsx` e `D3.01` na Central; teste Vitest; verifica com `pnpm --filter @ggv/web test`.

## GGVP-54 · A IA analisa o motivo e a sênior despacha

- [x] 10.1 Contratos `Despacho` e `Despachar` (`nada_falta`, ou `acionar` com o que obter, "Essa tarefa tem prazo?" e a data, e as perícias); teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 10.2 CA1 a CA9 · `GET` e `POST /api/casos/:id/despacho` em `rotas/indeferimento.ts` (decisão `D3.03` com autora, data e setores; exigência `despacho` com um item e "Cumprir pendência" por setor; perícia com o Jurídico administrativo; "Pedir a petição" nasce; só a Sênior); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 10.3 CA10 · Tela "Despachar caso" (`apps/web/src/paginas/Despachar.tsx`: histórico do caso, setores com o que obter e o prazo opcional, "nada falta", "Encerrar sem judicializar" pela rota da GGVP-48; só leitura para a advogada), a rota e `D3.03` na Central; teste Vitest; verifica com `pnpm --filter @ggv/web test`.

## GGVP-58 · Laços dos setores até subir o card

- [x] 11.1 Contratos: `ItensDoSetor` com `origem`, `prazoProcessual` nulo e `informacao`; `SubirInformacao`; teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 11.2 CA1, CA2, CA4 a CA9, CA12 · as rotas do setor de `rotas/exigencia-juiz.ts` também em `/api/casos/:id/pendencias/...` (`pendencia.cumprir`, exigência `despacho`): informação escrita do Atendimento, documento da Documentação, limite e "não vou conseguir" sobem para a Sênior (`D3.04s`), espera `D3.E1`, lembrete cancelado ao subir; teste novo, e os da exigência do juiz continuam passando; verifica com `pnpm --filter @ggv/api test`.
- [x] 11.3 CA3, CA10, CA11 · status de cada setor e da perícia no `GET` do despacho; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 11.4 CA13 · Tela do setor com a origem (`CumprirExigenciaJuiz.tsx`: "Cumprir pendência", sem o prazo do processo, informação escrita do Atendimento), a rota `/casos/:id/pendencias` e `D3.04`, `D3.04s` na Central; teste Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 11.5 Playwright: a advogada registra o indeferido e o motivo; a Sênior despacha à Documentação com prazo e ao Atendimento sem prazo; o Atendimento sobe a informação e a Documentação, o documento; "Pedir a petição" aparece para a advogada; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 11.6 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-63 · Pedir a petição e a IA escrever

- [x] 12.1 Contratos `PeticaoInicial` e `PedirPeticao` (instruções, opções, citados na ordem com o nome do que falta, texto da versão 1); teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 12.2 CA1, CA2, CA3, CA6, CA9, CA10 · `GET /api/casos/:id/peticao` e `POST /api/casos/:id/peticao/pedido` em `apps/api/src/rotas/peticao.ts` (bloqueado com quem falta; grava o pedido e a versão 1 da advogada com o hash; conclui `D3.05`; nasce "Conferir petição"); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 12.3 Tela "Petição inicial" (`apps/web/src/paginas/Peticao.tsx`), parte do pedido (bloqueio com quem falta, instruções, opções, documentos citados, texto da versão 1), a rota e `D3.05` na Central; teste Vitest; verifica com `pnpm --filter @ggv/web test`.

## GGVP-67 · Conferir a petição

- [x] 13.1 Diferença por parágrafo em `apps/api/src/fluxo/diferenca.ts`, com teste (igual, incluído, removido, texto vazio); contratos `NovaVersao` e `AprovarPeticao`; verifica com `pnpm --filter @ggv/api test` e `pnpm --filter @ggv/contratos test`.
- [x] 13.2 CA1 a CA5, CA7 a CA10 · `POST .../peticao/versoes` e `POST .../peticao/versoes/:n/aprovacao` (versões numeradas; as três marcações, G6 e G18; versão nova depois da aprovação volta à conferência e fica no histórico; só a advogada); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 13.3 CA6 e GGVP-71 CA1, CA8, CA11 · pacote em `apps/api/src/fluxo/pacote.ts` com `pdf-lib` (dependência nova): PDF da petição com a assinatura padrão e o hash, a carta e os citados na ordem, imagem vira PDF; gerado na aprovação; teste que abre o PDF gerado e confere as páginas e os metadados; verifica com `pnpm --filter @ggv/api test`.
- [x] 13.4 CA11 · Tela "Petição inicial", parte da conferência (versão inteira, diferença destacada, as três marcações, "Editar eu mesma") e `D3.06` na Central; teste Vitest; verifica com `pnpm --filter @ggv/web test`.

- [x] 13.5 CA12 · `POST .../peticao/versoes/:n/aprovacao` recusa com `faltaCompletar` (a regra da GGVP-22 CA6; 400, sem pacote); teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 13.6 CA12 · Tela da petição: "Aprovar" mostra o motivo e não envia; teste Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 13.7 Rodar typecheck, lint, testes e Playwright das duas histórias (GGVP-22 e GGVP-67); colar a saída.

## GGVP-71 · Pacote, travas e protocolo no tribunal

- [x] 14.1 Travas em `apps/api/src/fluxo/travas.ts` (Tema 350, CPF, pacote completo com o formato e o tamanho do tribunal), com teste; contrato `ProtocolarPeticao`; semente com `tribunais`, `peticao.assinatura` e CPF de exemplo para os clientes que esperam o INSS; verifica com `pnpm --filter @ggv/api test` e `pnpm --filter @ggv/contratos test`.
- [x] 14.2 CA2, CA6, CA7, CA13 · travas com a evidência no `GET` da petição; documento que falta: subir ou pedir à Documentação, e o pacote gerado de novo; teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 14.3 CA3, CA4, CA5, CA8, CA9, CA10 · `POST .../peticao/protocolo` (tribunal, CNJ, data, comprovante e travas confirmadas; confere os hashes; grava o protocolo, o CNJ do caso e as travas; o processo entra na vigília); teste, inclusive com arquivo trocado; verifica com `pnpm --filter @ggv/api test`.
- [x] 14.4 CA11, CA12 · Tela "Petição inicial", parte do pacote e do protocolo (arquivos para baixar, travas com a evidência, tribunal e o botão do site numa página nova, CNJ, data, comprovante) e `D3.07` na Central; teste Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 14.5 Playwright: a advogada pede a petição com o texto, edita uma vez, compara, aprova, vê as travas, protocola com CNJ, data e comprovante, e o processo entra na vigília; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 14.6 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
