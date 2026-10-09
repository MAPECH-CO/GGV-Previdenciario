# Tasks

## GGVP-75 · Painel de resultado para os sócios

- [x] 1.1 Contrato em `packages/contratos/src/resultados.ts` (`PedidoDoPainel`, `Indicador`, `PainelDeResultados`, `RAIO_X`; a `AMOSTRA_MINIMA` saiu na 1.9, pelo G22 de 07/10) e matriz versão 11 com `valores.ver_totais` (Sócio e Financeiro), com a impressão digital nova no teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 1.2 CA1, CA2, CA3, CA7, CA8 · Cálculo em `apps/api/src/fluxo/resultados.ts` (os indicadores pela data do evento, cada taxa com o número de casos (sem amostra mínima desde a 1.9, G22 de 07/10), dado incerto fora, o recorte por benefício, perito, juízo e advogada); teste com casos montados no banco embutido; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.3 CA1, CA4, CA5, CA6 · `GET /api/gestao/resultados` em `apps/api/src/rotas/gestao.ts` (período padrão do ano, datas pela `campos`, totais só com `valores.ver_totais`, operação e base do acervo "sem dados ainda"); teste por perfil; verifica com `pnpm --filter @ggv/api test`.
- [x] 1.4 Dados de exemplo: casos decididos que dão uma taxa e um recorte com grupos de poucos casos (a taxa sai com o número de casos ao lado, G22 de 07/10); verifica entrando como Sócio.
- [x] 1.5 Tela "Resultados" da Gestão (`apps/web/src/paginas/Resultados.tsx`), a rota e o link na barra do topo, no padrão das telas da Gestão do portal; teste Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 1.6 CA2, CA3, CA5 · Conferir a tela com a Gestão do Sócio do protótipo (v2 de 02/10) e trazer ao Raio-X "o que o cartório mais cobra" e "onde julgam", às extinções o total de decididos e aos pareceres a diferença em pontos; verifica com `pnpm --filter @ggv/web test`.
- [x] 1.7 Playwright: o Sócio vê os indicadores e os totais; a Sênior vê o painel sem os totais; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 1.8 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
- [x] 1.9 CA8 · Regra nova do G22 (Lucas, 06/10; Pedro, 07/10): sem amostra mínima, toda taxa com o número de casos e a data da base. Muda o contrato (`Indicador` sem "amostra insuficiente"), o cálculo, a rota (a base é o fim do período, no máximo hoje) e a tela; verifica com os testes de contrato, API e tela.
- [x] 1.10 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-55 · Subir lote avulso de processos no acervo pelo chat e ver a base em uso na Gestão (a parte sem chat)

- [x] 2.1 CA3, CA7 · Contrato em `packages/contratos/src/acervo.ts` (`DESFECHOS_DO_ACERVO`, `ConferenciaDoAcervo`, `ConferirDesfecho`), `baseDoAcervo` com dados em `resultados.ts` e matriz versão 12 com `acervo.conferir_desfecho` (Sênior); verifica com `pnpm --filter @ggv/contratos test`.
- [x] 2.2 CA3 · Base do acervo no cálculo do painel (`apps/api/src/fluxo/resultados.ts`): processos, conferidos, aguardando conferência e data da base; teste no banco embutido; verifica com `pnpm --filter @ggv/api test`.
- [x] 2.3 CA7 · `GET /api/acervo/conferencia` e `POST /api/acervo/processos/:id/conferencia` (`apps/api/src/rotas/acervo.ts`), com o antes e o depois no histórico, e o item "Conferir desfechos do lote" na Central da Sênior só com pendente; teste por perfil; verifica com `pnpm --filter @ggv/api test`.
- [x] 2.4 Dados de exemplo: processos do acervo, uns conferidos e uns aguardando; verifica entrando como Sênior.
- [x] 2.5 CA3, CA7 · Tela "Conferir desfechos do lote" (`apps/web/src/paginas/ConferirAcervo.tsx`), a rota e a linha "Base do acervo" na tela Resultados; teste Vitest; verifica com `pnpm --filter @ggv/web test`.
- [x] 2.6 Playwright: a Sênior abre pela Central, confere um desfecho e corrige outro; a Gestão mostra a base com os que aguardam; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 2.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-64 · Juízo identificado: mostrar a jurimetria (parte 1)

- [x] 3.1 Contrato `JurimetriaDoJuizo` em `packages/contratos/src/juizo.ts`, exportado no índice; teste do formato; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 3.2 CA1 (a identificação) · `juizoDoCnj` em `apps/api/src/fluxo/juizo.ts`: tribunal e unidade de origem, a regra que o painel já usa. O painel (`resultados.ts`) passa a chamar a mesma função; verifica com o teste do painel e um teste da função.
- [x] 3.3 CA2, CA4, CA5 · Cálculo da jurimetria do juízo em `apps/api/src/fluxo/juizo.ts`:
  - o juízo vem do CNJ do acervo ou do caso ligado;
  - a procedência por benefício conta só desfecho conferido;
  - o tempo até a sentença conta só os processos com as duas datas;
  - o texto sai com os processos e a data da base.

  Teste no banco embutido; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.4 CA1, CA2 · `GET /api/casos/:id/juizo` com `estudo.ver`. Caso sem número do processo: 404. Teste por perfil: o Atendimento e o Financeiro não veem; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.5 CA3, CA6 · Minuta da petição: a jurimetria do juízo vai às fontes da resposta, fora do pedido ao modelo. Teste com `fetch` falso, que confere o pedido enviado ao modelo; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.6 Dados de exemplo: processos conferidos no acervo na unidade do caso judicial de exemplo, alguns com as duas datas; verifica pela rota com a advogada de exemplo.
- [x] 3.7 Rodar typecheck, lint e testes; colar a saída; perguntar "Agora ok?". Como a semente mudou, também o Playwright da Jurimetria, da judicialização e da página do caso.

## GGVP-64, parte 2 (depois do PR #21, da GGVP-141 e da página do caso no servidor)

- [ ] 3.8 CA1 · Nome da vara e do juiz, pelo órgão da fonte de publicação ou pela IA lendo a publicação, conferido por pessoa; o card mostra vara e juiz.
- [ ] 3.9 CA2 · Entendimentos recorrentes com os processos de exemplo, quando o acervo tiver o texto das decisões (GGVP-141).
- [ ] 3.10 CA1, CA2 · A sobreposição da página do caso lendo `GET /api/casos/:id/juizo`, quando a página do caso for ao servidor; Playwright.
- [ ] 3.11 CA3, CA6 · A recomendação de recurso com o indicador e o número de processos (D3b.04), com a GGVP-100.

## GGVP-141 · Acervo alimentado pelo que as telas do Pedro conferem, com busca por significado (parte 1)

- [x] 4.1 ADR-013 em `docs/decisoes/ADR-013-base-de-conhecimento.md`; verifica lendo.
- [x] 4.2 CA1, CA3 · Migração da tabela `acervo_trecho`, com a extensão `vector`, o índice HNSW e o RLS ligado; o banco embutido carrega a extensão; verifica com o teste das migrações.
- [x] 4.3 CA4 · `ia.vetor` no motor: embeddings da OpenAI com registro em `chamada_ia`. Sem chave, devolve nulo; saúde só com autorização. Teste com `fetch` falso; verifica com `pnpm --filter @ggv/api test`.
- [x] 4.4 CA1, CA3 · `alimentarAcervo`:
  - as fontes de hoje e a conversa conferida, anonimizadas e com a saúde marcada;
  - sem duplicar;
  - o vetor do que falta;
  - em segundo plano.

  Teste no banco embutido; verifica com `pnpm --filter @ggv/api test`.
- [x] 4.5 CA2 · Busca híbrida em `buscarNoAcervo` (RRF, k = 60), sempre com a fonte. Sem vetor, só palavra; trecho de saúde só com `saude: true`, que os fluxos do Jurídico passam. Teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 4.6 Rodar typecheck, lint, testes e o Playwright das telas que usam a IA; colar a saída; perguntar "Agora ok?". Um teste do estudo de caso passou a buscar como o Jurídico busca (`saude: true`).

## GGVP-141, parte 2 (depois dos PRs #39 e #42 e da GGVP-133)

- [ ] 4.7 CA1 · O parecer, o laudo e o resultado da perícia conferidos entram no acervo.
- [ ] 4.8 CA1 · A transcrição conferida entra no acervo.

## GGVP-59 · Perito nomeado: identificar e mostrar a jurimetria (parte 1)

- [x] 5.1 CA1 · Contrato: `nomeacao_perito` em `CLASSES_DE_ATO` ("Nomeação de perito"); sem prazo no despacho, 15 dias (CPC, art. 465, §1º). Teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 5.2 CA1 · Instrução de `classificar_publicacao` com a classe nova, em versão nova. Teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 5.3 CA1 · `encaminhar`: o destino DP.05 "Quesitos e assistente técnico" para a advogada, com o prazo contado. Teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 5.4 CA1, CA6 · `peritoDaPublicacao` e o histórico na classificação: `perito_nomeado` com o perito, ou não reconhecido. Teste da rota; verifica com `pnpm --filter @ggv/api test`.
- [x] 5.5 Tela: a opção nova e a frase de destino na leitura da publicação. Teste Vitest e Playwright da judicialização; verifica com `pnpm --filter @ggv/web test`.
- [x] 5.6 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
- [x] 5.7 CA1 · Ajuste do "Agora ok?" (Mateus, 08/10): na Central, a tarefa "Quesitos e assistente técnico" abre a tela de perícias do caso, onde ficam os quesitos. Teste da rota e Playwright da judicialização; verifica com `pnpm --filter @ggv/api test`.
- [x] 5.8 Rodar typecheck, lint, testes e Playwright de novo; colar a saída.

## GGVP-59, parte 2 (depois, com o Pedro e a página do caso no servidor)

- [ ] 5.9 CA1 · Ligar o perito direto na perícia judicial a partir da publicação.
- [ ] 5.10 CA2 · A sobreposição da página do caso lendo do servidor, com a taxa por benefício e por CID.
- [ ] 5.11 CA2, CA7 · A pergunta no chat ("Como o perito avalia?").
