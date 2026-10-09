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

## GGVP-64, parte 2 (09/10, em PR próprio sobre o #11)

- [x] 3.8 Contrato: `vara`, `juiz` e `entendimentos` em `JurimetriaDoJuizo` (`packages/contratos/src/juizo.ts`); `vara` e `juiz` opcionais em `LeituraDaPublicacaoPelaIa` e `ClassificarPublicacao` (`justica.ts`); `EntendimentosDoJuizo`, a saída da IA. Teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 3.9 CA1, CA2 · Migração: `vara` e `juiz` em `caso`; `entendimentos` e `entendimentos_em` em `juizo` (`apps/api/src/banco/esquema/` e `apps/api/drizzle/`); verifica com o teste das migrações.
- [x] 3.10 CA1 · Leitura da IA em versão nova com `vara` e `juiz` (`apps/api/src/ia/ia.ts`); a classificação guarda vara e juiz no caso, sem apagar com campo vazio, e o histórico registra (`apps/api/src/rotas/publicacoes.ts`). Teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.11 CA2, CA5 · Finalidade `entendimentos_do_juizo` e o preparo (`apps/api/src/fluxo/juizo.ts`): as decisões de mérito do juízo sem dado pessoal, até 5 entendimentos com os processos de exemplo, só os que estavam no conteúdo; refaz com decisão nova. Teste com IA falsa; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.12 CA1, CA2 · `GET /api/casos/:id/juizo` com vara, juiz e entendimentos (`apps/api/src/rotas/juizo.ts`). Teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.13 CA6 · Minuta: com juízo, os entendimentos e os processos de exemplo vão ao modelo, sem número do juízo; as fontes mostram (`apps/api/src/rotas/peticao.ts`). Teste com `fetch` falso; verifica com `pnpm --filter @ggv/api test`.
- [x] 3.14 Dados de exemplo (`apps/api/src/banco/exemplo.ts`): a vara e o juiz no texto de uma publicação e decisões de mérito no JEF de exemplo (TRF3 · 6301); verifica pela rota com a advogada de exemplo.
- [x] 3.15 Tela: "Vara" e "Juiz" na leitura da publicação (`apps/web/src/paginas/LerPublicacao.tsx`). Teste Vitest e Playwright da judicialização; verifica com `pnpm --filter @ggv/web test`.
- [x] 3.16 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-64, parte 2, depois (com a página do processo no servidor e a GGVP-100)

- [ ] 3.17 CA1, CA2 · A sobreposição da página do processo lendo `GET /api/casos/:id/juizo`, quando a página for ao servidor (GGVP-146); Playwright.
- [ ] 3.18 CA3, CA6 · A recomendação de recurso com o indicador e o número de processos (D3b.04), com a GGVP-100.

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

## GGVP-141, parte 2 (09/10, em PR próprio sobre o #11)

- [x] 4.7 CA1 · Parecer e laudo conferidos nas fontes do acervo: cada registro do parecer e cada documento da análise que um registro conferiu, só para o Jurídico. Teste no banco embutido; verifica com `pnpm --filter @ggv/api test`.
- [x] 4.8 CA1 · Transcrição conferida nas fontes: os trechos marcados como prova e as informações conferidas, sem senha, telefone e contato de apoio, no caso mais novo da pessoa; a gravação de conversa fica de fora. Teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 4.9 CA1 · Resultado da perícia registrado nas fontes: favorável ou não, o tipo e a leitura conferida, só para o Jurídico. Teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 4.10 CA1 · O que a IA sugeriu e ninguém conferiu fica fora: a análise sem registro, a informação sem conferência e o resumo da IA da entrevista. Teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 4.11 Rodar typecheck, lint e testes; colar a saída; perguntar "Agora ok?".

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

## GGVP-149 · Gestão completa: vara, tempo até a sentença, motivos mais comuns e tempo médio até o dinheiro

- [x] 9.1 Contrato em `packages/contratos/src/resultados.ts`: `PainelDeResultados` ganha `motivos` (indeferimento e derrota, cada um com o motivo e os casos) e os `totais` deixam o `diasAteReceber`, que vira indicador; verifica com `pnpm --filter @ggv/contratos test` e o typecheck.
- [x] 9.2 CA2, CA3, CA4 · Testes em `apps/api/src/fluxo/resultados.test.ts`: o tempo até a sentença (média, sem protocolo fica fora, por recorte), os motivos (ordem, texto do INSS, sem o texto livre, "sem motivo registrado") e o tempo até o dinheiro pela média, entre os indicadores.
- [x] 9.3 CA2, CA3, CA4 · Cálculo em `apps/api/src/fluxo/resultados.ts`; o primeiro protocolo da inicial sai de uma função de `apps/api/src/fluxo/juizo.ts`, a mesma que o juízo usa; verifica com `pnpm --filter @ggv/api test`.
- [x] 9.4 CA5 · Teste da rota em `apps/api/src/rotas/gestao.test.ts`: a líder do Atendimento abre o painel, recebe os tempos e as taxas e `totais` nulo; verifica com `pnpm --filter @ggv/api test`.
- [x] 9.5 CA2, CA3, CA4 · Tela "Resultados" (`apps/web/src/paginas/Resultados.tsx`): o cartão "Motivos mais comuns" e os tempos entre os indicadores; teste Vitest em `Resultados.test.tsx`; verifica com `pnpm --filter @ggv/web test`.
- [x] 9.6 Playwright: o Sócio vê os motivos mais comuns na Gestão; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 9.7 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
- [x] 9.8 CA1 · Recorte "Vara" pela vara conferida no caso (o #27 entrou na main durante a história): `RECORTES` no contrato, o grupo em `apps/api/src/fluxo/resultados.ts`, teste no cálculo e no Playwright; verifica com `pnpm --filter @ggv/api test` e `pnpm --filter @ggv/web e2e`.

## GGVP-150 · Chance de êxito pelos casos parecidos, com a cor, o que falta saber e o histórico

- [x] 10.1 CA2, CA6 · Contrato: `ChanceDeExito` ganha `cor`, `sugereNaoPegar` e `faltaSaber` (`packages/contratos/src/inss.ts`); ação `chance.ver` (advogada, Sênior e Sócio) e matriz versão 26, com a impressão digital nova no teste; verifica com `pnpm --filter @ggv/contratos test`.
- [x] 10.2 CA2, CA4 · Regras em `apps/api/src/fluxo/chance.ts`: `corDaChance` (limites 15 e 50 incluídos no amarelo) e `oQueFaltaSaber`; teste em `chance.test.ts`; verifica com `pnpm --filter @ggv/api test`.
- [x] 10.3 CA4, CA5, CA6 · Rota `POST /api/casos/:id/chance` em `apps/api/src/rotas/conferencia.ts`: pede `chance.ver`, devolve a cor e o que falta saber, e o histórico guarda os casos usados; a decisão da conferência guarda a chance no histórico; teste em `conferencia.test.ts`.
- [x] 10.4 CA2, CA3, CA4, CA6 · Tela da conferência (`apps/web/src/paginas/Conferencia.tsx`): a cor, a sugestão abaixo de 15% sem bloquear, o que falta saber, e a chance só para quem tem `chance.ver`; teste Vitest.
- [x] 10.5 Playwright: a Sênior vê a chance com a cor e o que falta saber na conferência.
- [x] 10.6 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
- [ ] 10.7 CA1 · Os outros fatores dos casos parecidos (provas, perito ou juízo, motivos), depois da resposta do Lucas no cartão (09/10).
