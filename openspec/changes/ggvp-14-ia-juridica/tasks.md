# Tasks

## GGVP-106 · Guardrails de IA e do chat

- [x] 1.1 CA2, CA4 · Contratos em `packages/contratos/src/ia.ts`: `SugestaoDaIa`, `ChamadaDaIa`; testes.
- [x] 1.2 CA4 · Banco: tabela `chamada_ia` com RLS, migração 0013; teste das migrações (46 tabelas).
- [x] 1.3 CA1, CA2, CA4, CA11 · Servidor `apps/api/src/ia/`: `sugerir` (OpenAI) e `lerDocumento` (Mistral), `fetch` injetado; desligada sem chave; recusa dado de saúde sem autorização; registro de toda chamada; instrução com a regra dos números; testes sem serviço de verdade.
- [x] 1.4 CA4 · `GET /api/casos/:id/ia`: auditoria para a gestão e o Jurídico; saída só para quem vê dado de saúde, com o acesso registrado; testes.
- [x] 1.5 `pnpm dev` da API lê também o `.env.ia`; o módulo lê as chaves do ambiente (`process.env`) por padrão. A primeira rota que usar a IA instancia o módulo.
- [x] 1.6 Rodar typecheck, lint e testes (sem tela nesta história); colar a saída; perguntar "Agora ok?".

## GGVP-110 · Conteúdo malicioso não manipula a IA

- [x] 2.1 CA3 · Banco: coluna `alerta` em `chamada_ia` (migração 0014); `SugestaoDaIa` ganha `alerta`.
- [x] 2.2 CA1, CA3, CA7 · Servidor: detector de instrução suspeita na entrada e na saída e de CID na saída; alerta na chamada e no histórico do caso (`ia_alerta`); saída com CID barrada; testes de ataque.
- [x] 2.3 CA1, CA10 · Teste: publicação com instrução escondida, sugestão da IA e a publicação continua sem classe até a advogada classificar.
- [x] 2.4 Rodar typecheck, lint e testes; colar a saída; perguntar "Agora ok?".

## GGVP-34 e GGVP-74 · A IA na leitura da publicação

- [x] 3.1 Contrato `SugestaoDePublicacao` em `packages/contratos/src/justica.ts`; a finalidade `classificar_publicacao` responde em JSON (classe, dias, resumo).
- [x] 3.2 Servidor: a API monta a IA (`criarServidor` aceita uma IA de teste); `POST /api/publicacoes/:id/sugestao` (perfil `publicacao.classificar`) confere o formato e guarda a classe sugerida; nada classifica; testes com IA falsa.
- [x] 3.3 Tela "Ler publicação": "Sugerir com a IA", a sugestão marcada, o resumo, o alerta e "Usar a sugestão"; testes de tela.
- [x] 3.4 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-63 · A IA escreve a versão 1 da petição inicial

- [x] 4.1 IA: finalidade `minuta_peticao` (leva dado de saúde; pode citar o CID que está no caso, por isso não barra CID); a regra de CID passa a valer por finalidade.
- [x] 4.2 Contratos: `PedirMinuta` e `MinutaDaIa`; `PedirPeticao` aceita `chamadaIaId`.
- [x] 4.3 Servidor: `POST /api/casos/:id/peticao/minuta` monta o conteúdo do caso e devolve a sugestão com as fontes, sem gravar petição; o pedido com `chamadaIaId` marca a versão 1 como "minuta da IA"; testes com IA falsa.
- [x] 4.4 Tela "Pedir a petição": "Escrever a versão 1 com a IA" preenche a caixa, com as fontes e os avisos; testes de tela.
- [x] 4.5 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-22 · A IA sugere o resumo do resultado ao cliente

- [x] 5.1 Contratos: `AprovarResumo` aceita `chamadaIaId`; resposta da sugestão (`SugestaoDoResumo`).
- [x] 5.2 Servidor: `POST /api/casos/:id/resultado/sugestao` (perfil `resultado.aprovar_resumo`), com o benefício, o desfecho e o texto da última decisão de mérito; não grava; a aprovação guarda a chamada em `sugestao_ia`; testes com IA falsa.
- [x] 5.3 Tela "Explicar o resultado": "Sugerir o resumo com a IA" preenche a caixa, com o selo; testes de tela.
- [x] 5.4 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-131 · Chance de êxito (primeiro recorte: conferência da Sênior)

- [x] 6.1 CA2 · Regra em código, com teste: `calcularChance` (favoráveis sobre decididos, sem desistência), em `apps/api/src/fluxo/chance.ts`.
- [x] 6.2 Contrato `ChanceDeExito`; finalidade `fatores_da_chance` (explica, não calcula).
- [x] 6.3 CA2, CA4, CA9, CA10 · `POST /api/casos/:id/chance` (perfil `caso.aprovar_para_inss`): desfechos conferidos do mesmo benefício, número com casos e base, fatores da IA, histórico `chance_mostrada`; testes com IA falsa.
- [x] 6.4 Tela da conferência: "Ver a chance de êxito", o número ou "sem casos parecidos na casa ainda", e os fatores como sugestão; testes de tela.
- [x] 6.5 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## Ajustes do teste no portal (07/10)

- [x] 7.1 GGVP-22: sem a publicação de mérito, a IA é avisada de que o motivo fica para a advogada; instrução `resumo_resultado` v3 (o porquê só do texto da decisão, senão "[completar: o motivo da decisão]"); teste.
- [x] 7.2 GGVP-131: o laudo novo vai à IA em frase inteira, não em "sim/não"; teste.
- [x] 7.3 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-45 · Buscar no acervo antes de escrever

- [x] 8.1 `buscarNoAcervo` com busca por texto em português, mesmo benefício, sem o próprio caso, até 3 trechos anonimizados; testes (CA1, CA2, CA4, CA6).
- [x] 8.2 Minuta da petição: com "Usar precedentes", os trechos vão à IA e às fontes; sem nada, "Sem referência na casa"; instrução `minuta_peticao` v3 (a tese sim, fato e nome de outro cliente não; sem número); testes (CA1, CA2, CA5).
- [x] 8.3 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-54 · A IA analisa o motivo do indeferimento

- [x] 9.1 Contratos: `AnaliseDoIndeferimentoPelaIa`, `AnaliseDoDespacho`; `Despachar` aceita `chamadaIaId`.
- [x] 9.2 Servidor: finalidade `analisar_indeferimento`; `POST /api/casos/:id/despacho/analise` (perfil `caso.despachar_indeferimento`, despacho esperando) com o caso e o acervo; o despacho guarda `sugestao_ia`; testes com IA falsa (CA1, CA4).
- [x] 9.3 Tela "Despachar caso": "Analisar com a IA", a análise marcada como sugestão, as fontes e "Usar a sugestão"; testes de tela.
- [x] 9.4 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-67 · A IA faz outra versão da petição

- [x] 10.1 Contratos: `PedirOutraVersao` ("O que mudar" obrigatório); `NovaVersao` aceita `chamadaIaId`.
- [x] 10.2 Servidor: finalidade `nova_versao_peticao`; `POST /api/casos/:id/peticao/versoes/sugestao` (perfil `peticao.aprovar`, com pedido e sem protocolo) devolve a sugestão sem gravar; a versão salva com a chamada sai "<nome> · versão da IA"; testes com IA falsa.
- [x] 10.3 Tela: "Pedir outra versão à IA" com "O que mudar" na conferência; o texto cai na caixa da nova versão, marcado; testes de tela.
- [x] 10.4 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-79 · A IA sugere as tarefas da exigência do juiz

- [x] 11.1 Contratos: `AnaliseDaExigenciaPelaIa`, `SugestaoDaExigencia`; `AnalisarExigenciaJuiz` aceita `chamadaIaId`.
- [x] 11.2 Servidor: finalidade `analisar_exigencia_juiz`; `POST /api/casos/:id/exigencia-juiz/sugestao` (perfil `exigencia_juiz.distribuir`, análise esperando) com a publicação, o prazo, o caso e o acervo; a decisão guarda `sugestao_ia`; testes com IA falsa.
- [x] 11.3 Tela "Exigência do juiz": "Sugerir com a IA", a sugestão marcada e "Usar a sugestão" (sem prazo interno); testes de tela.
- [x] 11.4 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## Sugestão pronta, sem botão (Mateus, 07/10)

- [x] 12.1 `sugerir`: devolve a chamada `ok` guardada para o mesmo conteúdo; `refazer`, `soPreparar` e `validar`; pedidos iguais em curso viram uma chamada; testes.
- [x] 12.2 `preparo`: cada rota com IA registra como listar e preparar; rodada ao subir e a cada 5 minutos, só com chave; testes.
- [x] 12.3 Rotas: a lógica de cada sugestão vira função usada pela rota e pelo preparo (despacho, exigência do juiz, publicação, resumo, chance, minuta); a minuta tem o padrão do pedido e aceita `refazer`.
- [x] 12.4 Telas: a sugestão aparece ao abrir e preenche o formulário (Despachar caso, Exigência do juiz, Ler publicação, Explicar o resultado, Conferência, Pedir a petição), sem "Sugerir" nem "Usar a sugestão"; testes de tela.
- [ ] 12.5 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-19 · Estudo de caso do processo perdido

- [x] 13.1 Contratos: `EstudoDaIa`, `EstudosDeCaso`, `RevisarEstudo`; matriz v13 com `estudo.ver` e `estudo.revisar`.
- [x] 13.2 Servidor: finalidade `estudo_de_caso`; preparo dos casos perdidos sem estudo; tarefa "Revisar estudo de caso" só com novo processo; `GET /api/estudos`; `POST /api/casos/:id/estudo/revisao`; o estudo no acervo; testes com IA falsa.
- [x] 13.3 Tela "Estudos de caso" (`/estudos`): por benefício e chance, motivo e aprendizado, novo processo, revisão da Sênior, "Baixar os estudos"; atalho no topo para o Jurídico; testes de tela.
- [x] 13.4 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-38 · Recomendação sobre a perícia

- [x] 14.1 Contratos: `RecomendacaoDaIa`, `RecomendacaoDaPericia`, `AprovarRecomendacao`, `PericiasDoCaso`.
- [x] 14.2 Servidor: finalidade `recomendacao_pericia`; preparo das perícias sem resultado nem recomendação aprovada; tarefa "Conferir a recomendação da perícia" para a advogada; `GET /api/casos/:id/pericias`; `POST /api/pericias/:id/recomendacao/sugestao`; `POST /api/pericias/:id/recomendacao`; testes com IA falsa.
- [x] 14.3 Tela "Perícias do caso" (`/casos/:id/pericias`): a recomendação pronta e editável (o que levar; na do juiz, quesitos e assistente técnico), "Aprovar a recomendação", a aprovada só para leitura; testes de tela.
- [x] 14.4 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

## GGVP-142 · Chat e Suporte pelo motor de IA de verdade (Mateus, 09/10)

- [x] 16.1 ADR-016 (o kit de agentes da OpenAI no chat) e a dependência `@openai/agents` 0.18.0 na API, com o rastreamento desligado; verifica com `pnpm --filter @ggv/api typecheck`.
- [x] 16.2 CA2 · `POST /api/chat`: as recusas (G17; G11 com histórico), "o que é o G8?", os portões do pedido e o pedido de outro perfil, como código, sem chamar o modelo. Teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 16.3 CA1, CA4 · O agente: a instrução, o modelo com o `fetch` injetado, as finalidades `chat` e `chat_juridico` no registro, a saúde (Jurídico e Sócio, com o acesso registrado), a barra de CID e a resposta sem IA. Teste com `fetch` falso; verifica com `pnpm --filter @ggv/api test`.
- [x] 16.4 CA1, CA2 · Ferramentas de leitura: o caso (pela página do processo, com a sessão), o acervo com a regra de saúde, as tarefas da pessoa e o portão; as fontes e os links pelo código. Teste com `fetch` falso; verifica com `pnpm --filter @ggv/api test`.
- [x] 16.5 CA3 · Ação com aprovação: o cartão a partir da aprovação do kit, guardado com quem pediu; `POST` e `DELETE /api/chat/acoes/:id`; criar tarefa e pedir a peça, com "feito pelo chat" no histórico. Teste com `fetch` falso; verifica com `pnpm --filter @ggv/api test`.
- [x] 16.6 CA3 · Marcar a perícia pelo chat leva à perícia do caso (decisão do Mateus, 09/10): lá a IA lê o comprovante e a pessoa confere a data, a hora e o local antes de marcar; o chat não marca sem a pessoa ver a leitura. Teste junto com a 16.7; verifica com `pnpm --filter @ggv/api test`.
- [x] 16.7 CA3 · As ações que dependem de enviar arquivo (laudo, documento, comprovante de RPV, lote do acervo) respondem com o link da tela. Teste; verifica com `pnpm --filter @ggv/api test`.
- [x] 16.8 Tela: com o servidor ligado, `perguntar`, `confirmarAcao` e `cancelarAcao` vão ao servidor. Teste Vitest com `fetch` falso; verifica com `pnpm --filter @ggv/web test`.
- [x] 16.9 Playwright do chat no servidor: a recusa do G17 sem modelo e a resposta sem a chave da IA, com o link do caso; verifica com `pnpm --filter @ggv/web e2e`.
- [x] 16.10 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".
