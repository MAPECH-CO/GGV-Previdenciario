# Tasks

<!-- Grupo 1: iniciar, marcar, reunir o que a perícia pede e a orientação. -->

## GGVP-49 · Iniciar a tarefa de perícia

- [x] 1.1 Contrato: tipos da perícia (`TipoDePericia`, `Instancia`, `OrigemDaPericia`, `PedidoDePericia`, `EventoDaPericia`, `Pericia`) em `src/regras/pericia.ts` e `src/dados/pericia.ts`; `pericias?` no fim do `Banco` de `servidor.ts`; o Jurídico administrativo no fim de `PERFIS` (`dados/perfis.ts`). Verifica com `pnpm typecheck`.
- [x] 1.2 Regra: `ORIGENS` (rótulo, passo, diagrama), `situacaoDaPericia`, `etapaEmPericia`, `prazosDaPericia` e `proximaTentativa` em `src/regras/pericia.ts`, com teste em `src/regras/pericia.test.ts` (CA1, CA2). Verifica com `pnpm vitest run src/regras/pericia.test.ts`.
- [x] 1.3 Servidor de exemplo: `iniciarPericia` (ponta da GGVP-31, D3 e D3a), `liberarAgendamento` (ponta da vigília do INSS), a semente da Maria, do Pedro e do Antônio, `obterPericia` e `tarefasDoJuridicoAdm` em `src/dados/pericia.ts`; a linha fixa "Decidir perícia" sai de `advogada.ts`. Teste em `src/dados/pericia.test.ts` (CA1 a CA4). Verifica com `pnpm vitest run src/dados/pericia.test.ts`.
- [x] 1.4 Tela `/casos/:id/pericia/aberta` (`src/paginas/PericiaAberta.tsx`, Figma `14:534` com o pedido do Lucas de 02/10) e Central `/juridico-administrativo` (`src/paginas/CentralJuridicoAdm.tsx`, Figma `2051:173` e `2107:892`); rotas em `App.tsx`. Teste em `PericiaAberta.test.tsx` (CA1 a CA4). Verifica com `pnpm vitest run src/paginas/PericiaAberta.test.tsx`.
- [x] 1.5 Página do processo com a perícia `/casos/:id/pericia` (`src/paginas/ProcessoPericia.tsx`, Figma `2179:2`, `2179:333`, `2179:664`) e o caso "Em perícia" na ficha (`CasoEmAndamento.tsx`). Teste em `PericiaAberta.test.tsx` (CA1, CA4; dado de saúde só para o Jurídico). Verifica com `pnpm vitest run src/paginas/PericiaAberta.test.tsx`.
- [x] 1.6 Playwright `e2e/pericia-iniciar.e2e.ts`: a perícia da Maria aberta pelo sistema, a tela do passo com os prazos e o histórico, a tarefa na Central do Jurídico administrativo, a ficha "Em perícia" (CA1 a CA4); tema escuro e fonte grande. Verifica com `PORTA_E2E_API=3141 PORTA_E2E_WEB=5186 pnpm exec playwright test pericia-iniciar`.
- [ ] 1.7 Ligar no servidor: a GGVP-31 (D2.03), o despacho da sênior (D3) e o pedido do juiz (D3a) chamam `iniciarPericia`; a vigília do INSS chama `liberarAgendamento`; o corpo de `dados/pericia.ts` vira `fetch` e o perfil vem da sessão. **Ponta para ligar na junção com o INSS. Fica aberta nesta história.**

## GGVP-53 · Marcar a perícia com o cliente

- [x] 2.1 Contrato: `TentativaDeMarcar`, `LidoDoComprovante`, `Marcacao` e o lembrete em `src/regras/pericia.ts` e `src/dados/pericia.ts`; o comprovante da perícia no fim de `TIPOS_DE_DOCUMENTO`. Verifica com `pnpm typecheck`.
- [x] 2.2 Regra: `motivoParaNaoRegistrarTentativa`, `motivoParaNaoRegistrarMarcacao`, `lembreteDaVespera`, `LIMITE_DE_REMARCACOES_DA_PERICIA` e `passouDoLimite`, com teste em `src/regras/pericia.test.ts` (CA1, CA3, CA4, CA8, CA9). Verifica com `pnpm vitest run src/regras/pericia.test.ts`.
- [x] 2.3 Servidor de exemplo: `registrarTentativa`, `lerComprovante` (IA simulada), `esperarComprovante`, `registrarMarcacao` (pasta, agenda, ficha, lembrete, Documentação), `remarcarPericia`, `autorizarRemarcacao`, o lembrete da véspera e a perícia na agenda (`eventosDasPericias`, ligado em `dados/agenda.ts`), com teste em `src/dados/pericia.test.ts` (CA1 a CA9). Verifica com `pnpm vitest run src/dados/pericia.test.ts`.
- [x] 2.4 Tela `/casos/:id/pericia/marcar` (`src/paginas/MarcarPericia.tsx`, Figma `10:374`); o card de confirmação do chat (Figma `2085:2`); o detalhe da perícia na agenda (Figma `2164:513`); o lembrete no Chatwoot simulado. A perícia na agenda não ocupa a sala do escritório (`horarioOcupado`) nem vira "confirmar entrevista" no Atendimento. Teste em `MarcarPericia.test.tsx` (CA1 a CA9, G9). Verifica com `pnpm vitest run src/paginas/MarcarPericia.test.tsx`.
- [x] 2.5 Playwright `e2e/pericia-marcar.e2e.ts`: a tentativa sem sucesso, o comprovante lido e conferido, a perícia na agenda e na ficha, o documento novo para a Documentação, o comprovante pelo chat, o lembrete da véspera e o limite que sobe para a advogada (CA1 a CA9); tema escuro e fonte grande. Verifica com `PORTA_E2E_API=3141 PORTA_E2E_WEB=5186 pnpm exec playwright test pericia-marcar`.
- [ ] 2.6 Ligar no servidor: a leitura do PDF pela IA de verdade, o Chatwoot com o modelo aprovado e o lembrete agendado pelo servidor; o corpo de `dados/pericia.ts` vira `fetch`. Depende do GGVP-118, do banco do Mateus e da GGVP-102. **Fica aberta nesta história.**

## GGVP-56 · Reunir o que a perícia pede

- [x] 3.1 Contrato: `KIT_DA_PERICIA` e `DocumentosDaPericia` (itens, faltas justificadas, conferências, cobranças, pedidos ao médico, conclusão) em `src/dados/pericia.ts`. Verifica com `pnpm typecheck`.
- [x] 3.2 Regra: `motivoParaNaoConcluirDocumentos` e `limiteDaCobranca` (10 dias antes), com teste em `src/regras/pericia.test.ts` (CA3, CA5, CA7). Verifica com `pnpm vitest run src/regras/pericia.test.ts`.
- [x] 3.3 Servidor de exemplo: a tarefa da Documentação nasce só com "Sim", o item anexado pela pasta (leitura do D1), `justificarFalta`, `concluirDocumentos` (volta ao Jurídico administrativo), `registrarCobrancaDaPericia`, `pedirAoMedicoNaPericia` (G20) e `tarefasDaDocumentacaoNaPericia`; as linhas fixas da Maria saem de `atendimento.ts`. Teste em `src/dados/pericia.test.ts` (CA1 a CA7). Verifica com `pnpm vitest run src/dados/pericia.test.ts`.
- [x] 3.4 Telas `/casos/:id/pericia/documentos` (`src/paginas/ReunirDocumentosPericia.tsx`, Figma `10:522`) e `/casos/:id/pericia/cobranca` (`src/paginas/CobrarDocumentoPericia.tsx`, Figma `10:239`); a Central do Atendimento com as tarefas da perícia. As pistas dos documentos da avaliação social entram no fim de `regras/arquivos.ts`. Teste em `ReunirDocumentosPericia.test.tsx` e `CentralAtendimento.test.tsx` (CA1 a CA7). Verifica com `pnpm vitest run src/paginas/ReunirDocumentosPericia.test.tsx src/paginas/CentralAtendimento.test.tsx`.
- [x] 3.5 Playwright `e2e/pericia-documentos.e2e.ts`: a Documentação recebe a lista do Pedro (social), anexa, justifica a falta, confere e conclui; a tarefa volta ao Jurídico administrativo; a cobrança com o pedido ao médico barrado pelo G20 (CA1 a CA7); tema escuro e fonte grande. Verifica com `PORTA_E2E_API=3141 PORTA_E2E_WEB=5186 pnpm exec playwright test pericia-documentos`.
- [ ] 3.6 Ligar no servidor: o kit vem da configuração do escritório, a cobrança pelo Chatwoot de verdade; o corpo de `dados/pericia.ts` vira `fetch`. Depende do banco do Mateus e da GGVP-102. **Fica aberta nesta história.**

## GGVP-61 · Orientação da perícia, padrão ou pelo perfil do perito

- [x] 4.1 Contrato: `Perito`, `LaudoDoPerfil` em `src/dados/peritos.ts`; `OrientacaoDaPericia` em `src/dados/pericia.ts`; `recusasDoChat?` no fim do `Banco`. Verifica com `pnpm typecheck`.
- [x] 4.2 Regra: `escolherOrientacao`, `problemaDaOrientacao` (G11 e G20), `recusaDoChatNaPericia`, `jurimetria` e `numerosDaJurimetria` (G22, sem amostra mínima desde a junção de 08/10), com teste em `src/regras/pericia.test.ts`, incluindo os pedidos maliciosos (CA1, CA2, CA4, CA5, CA8, CA10, CA12). Verifica com `pnpm vitest run src/regras/pericia.test.ts`.
- [x] 4.3 Servidor de exemplo: os peritos de exemplo (ponta da GGVP-59), a orientação montada ao registrar a data (padrão ou pelo perfil, com o motivo e a versão), a verificação, `ligarPerito` e `registrarRecusaDoChat`, com teste em `src/dados/pericia.test.ts` (CA1 a CA12). Verifica com `pnpm vitest run src/dados`.
- [x] 4.4 Telas: a orientação, a pergunta do perito e a jurimetria na página do processo (`ProcessoPericia.tsx`, janela `JurimetriaPerito.tsx`, Figma `2184:2`); a "Dica para a perícia" no chat (Figma `2186:857`); a recusa do G11 no chat das Centrais (`ChatIA.tsx`). A janela do Chatwoot e o chat assinam com a pessoa do perfil. Teste em `OrientacaoPericia.test.tsx` (CA2, CA5, CA6, CA7, CA9, CA11, CA12). Verifica com `pnpm vitest run src/paginas/OrientacaoPericia.test.tsx`.
- [x] 4.5 Playwright `e2e/pericia-orientacao.e2e.ts`: a orientação padrão da Maria, a do Antônio pelo perfil do perito com a versão, o perito do Pedro ligado em um clique, a jurimetria com amostra insuficiente e o pedido malicioso recusado no chat (CA1 a CA12); tema escuro e fonte grande. Verifica com `PORTA_E2E_API=3141 PORTA_E2E_WEB=5186 pnpm exec playwright test pericia-orientacao`.
- [ ] 4.6 Ligar no servidor: a IA de verdade monta a orientação sobre o acervo (RAG do D4), o perito nomeado vem do acervo e a jurimetria da GGVP-59; o corpo de `dados/pericia.ts` e `dados/peritos.ts` vira `fetch`. **Ponta para ligar com a GGVP-59. Fica aberta nesta história.**
- [x] 4.7 Rodar typecheck, lint, testes e Playwright; colar a saída; gravar o teste em vídeo do grupo; perguntar "Agora ok?" (no fim do grupo 1).

<!-- Grupo 2: preparar o cliente, comparecimento, resultado e perfil do perito. -->

## GGVP-62 · Preparar o cliente

- [x] 5.1 Contrato: a preparação e as recusas do envio na `Pericia` (`src/dados/pericia.ts`). Verifica com `pnpm typecheck`.
- [x] 5.2 Servidor de exemplo: `enviarOrientacao` (verifica de novo, recusa e registra; guarda o texto, o canal e a data), a preparação que cai quando a data muda, a tarefa "Orientar para a perícia" na tela nova e a resposta "o cliente ligou" do chat, com teste em `src/dados/pericia.test.ts` (CA1 a CA8). Verifica com `pnpm vitest run src/dados/pericia.test.ts`.
- [x] 5.3 Tela `/casos/:id/pericia/orientar` (`src/paginas/OrientarPericia.tsx`, Figma `10:405`) e o chat (Figma `2107:1091`). Teste em `OrientarPericia.test.tsx` (CA1 a CA8). Verifica com `pnpm vitest run src/paginas/OrientarPericia.test.tsx`.
- [x] 5.4 Playwright `e2e/pericia-preparar.e2e.ts` (CA1 a CA8); tema escuro e fonte grande. Verifica com `PORTA_E2E_API=3141 PORTA_E2E_WEB=5186 pnpm exec playwright test pericia-preparar`.
- [ ] 5.5 Ligar no servidor: o envio pelo Chatwoot de verdade (GGVP-102) e a verificação no servidor do Mateus. **Fica aberta nesta história.**

## GGVP-66 · Comparecimento e remarcação

- [x] 6.1 Regra: `periciaJaPassou`, `HORA_DA_CONFIRMACAO` e o estado da confirmação, com teste em `src/regras/pericia.test.ts` (CA1, CA6, CA7, CA8). Verifica com `pnpm vitest run src/regras/pericia.test.ts`.
- [x] 6.2 Servidor de exemplo: `confirmarPresenca`, `registrarComparecimento` (faltou remarca e conta no limite; compareceu espera o resultado), as tarefas e os alertas, com teste em `src/dados/pericia.test.ts` (CA1 a CA9). Verifica com `pnpm vitest run src/dados/pericia.test.ts`.
- [x] 6.3 Tela `/casos/:id/pericia/comparecimento` (`src/paginas/ComparecimentoPericia.tsx`, Figma `1818:289`) e "Marcar como realizado" na agenda. Teste em `ComparecimentoPericia.test.tsx` (CA1 a CA9). Verifica com `pnpm vitest run src/paginas/ComparecimentoPericia.test.tsx`.
- [x] 6.4 Playwright `e2e/pericia-comparecimento.e2e.ts` (CA1 a CA9); tema escuro e fonte grande. Verifica com `PORTA_E2E_API=3141 PORTA_E2E_WEB=5186 pnpm exec playwright test pericia-comparecimento`.
- [ ] 6.5 Ligar no servidor: a confirmação pelo Chatwoot e os alertas pelo servidor. **Fica aberta nesta história.**

## GGVP-70 · Conferir o resultado e decidir o próximo passo

- [x] 7.1 Regra: `motivoParaNaoRegistrarResultado`, `CONFERENCIAS_DO_RESULTADO` e como cada origem segue, com teste em `src/regras/pericia.test.ts` (CA2 a CA6). Verifica com `pnpm vitest run src/regras/pericia.test.ts`.
- [x] 7.2 Servidor de exemplo: `resultadoNoGerid` (ponta da vigília), `lerLaudoDaPericia` (IA simulada), `registrarResultado` (favorável, desfavorável, nova perícia, volta à origem, histórico com a indicação da IA), a tarefa da advogada e as respostas do chat, com teste em `src/dados/pericia.test.ts` (CA1 a CA9). Verifica com `pnpm vitest run src/dados/pericia.test.ts`.
- [x] 7.3 Tela `/casos/:id/pericia/resultado` (`src/paginas/ResultadoPericia.tsx`, Figma `14:556` e `1579:431`), a página do processo com o resultado e o chat da advogada (Figma `2107:667`, `2186:2`). Teste em `ResultadoPericia.test.tsx` (CA1 a CA9). Verifica com `pnpm vitest run src/paginas/ResultadoPericia.test.tsx`.
- [x] 7.4 Playwright `e2e/pericia-resultado.e2e.ts` (CA1 a CA9); tema escuro e fonte grande. Verifica com `PORTA_E2E_API=3141 PORTA_E2E_WEB=5186 pnpm exec playwright test pericia-resultado`.
- [ ] 7.5 Ligar no servidor: a vigília do GERID (Mateus), a leitura do laudo pela IA de verdade e o retorno ao D2 (`avancarJuncaoD2`, `avancarExigencia`). **Ponta para ligar na junção com o INSS. Fica aberta nesta história.**

## GGVP-73 · Atualizar o perfil do perito

- [x] 8.1 Servidor de exemplo: o laudo entra no perfil ao registrar o resultado (sem dado pessoal, sem duplicar); o laudo do perito não reconhecido fica fora das contas até ligar; com teste em `src/dados/pericia.test.ts` (CA1 a CA7). Verifica com `pnpm vitest run src/dados/pericia.test.ts`.
- [x] 8.2 Telas: o feito do resultado com a versão do perfil, a pergunta de um clique e o histórico do perfil na janela da jurimetria. Teste em `ResultadoPericia.test.tsx` (CA1, CA3, CA6, CA7). Verifica com `pnpm vitest run src/paginas/ResultadoPericia.test.tsx`.
- [x] 8.3 Playwright no `e2e/pericia-resultado.e2e.ts`: o laudo atualiza o perfil (CA1, CA3). Verifica com `PORTA_E2E_API=3141 PORTA_E2E_WEB=5186 pnpm exec playwright test pericia-resultado`.
- [ ] 8.4 Ligar no servidor: a extração pela IA de verdade e o acervo (RAG) com o perfil; a GGVP-59 lê dele. **Fica aberta nesta história.**
- [x] 8.5 Rodar typecheck, lint, testes e Playwright; colar a saída; gravar o teste em vídeo do grupo; perguntar "Agora ok?" (no fim do grupo 2).

## GGVP-137 · Ligar no servidor as telas da Perícia

- [x] 9.1 As regras e as mudanças da perícia saem do servidor de exemplo para `src/regras/periciaNoCaso.ts`, puras e com a hora vinda de fora; o servidor de exemplo e o de verdade usam as mesmas. Verifica com `pnpm vitest run src/dados/pericia.test.ts`.
- [x] 9.2 Contratos em `packages/contratos/src/pericia.ts`; matriz v13 (`pericia.reunir_documentos`, `pericia.decidir_no_limite`, `pericia.conferir_resultado`); colunas `pericia.documento` e `perito.perfil`.
- [x] 9.3 Rotas em `apps/api/src/rotas/pericia.ts`, com o perfil da sessão, os portões (G20, G11, dado de saúde) e o histórico; testes em `pericia.test.ts` (CA1 a CA6). Verifica com `pnpm --filter @ggv/api exec vitest run src/rotas/pericia.test.ts`.
- [x] 9.4 Telas no modo misto, depois do pedido #29: as funções de `dados/pericia.ts` chamam a API quando o caso é do servidor (`doServidor`), a cópia recebe a perícia e as Centrais, as tarefas do servidor (`sincronizarPericias`); o PDF sobe em multipart. Testes em `src/dados/periciaLigada.test.ts` e Playwright `e2e/pericia-servidor.e2e.ts`, com login, da perícia marcada ao resultado (CA7).
- [ ] 9.5 O servidor de exemplo da Perícia sai do código; a semente fica só para os testes (CA8). Hoje o caminho de exemplo só atende os casos da semente ("-exemplo"), que os testes de tela e os Playwright da Perícia usam; tirá-lo pede refazer esses Playwright sobre casos do servidor. A migração (0016) e a matriz (v14) já estão sobre a main de 08/10.
