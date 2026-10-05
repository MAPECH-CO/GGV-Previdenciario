# Tasks

<!-- Grupo contrato: preencher só as seções deste bloco. -->

## GGVP-65 · Kit de documentos por benefício

## GGVP-69 · Preencher o contrato pelo modelo e conferir

## GGVP-72 · Assinatura digital pelo ZapSign

## GGVP-77 · Assinatura em papel na entrevista

## GGVP-85 · Verificar o contrato assinado

## GGVP-89 · Cópia do contrato para o cliente levar

<!-- Fim do grupo contrato. -->

<!-- Grupo documentos: preencher só as seções deste bloco. -->

## GGVP-81 · Ler e arquivar os documentos

- [x] 7.1 Contrato: tipos em `apps/web/src/dados/leitura.ts` (documento lido, dados lidos, arquivamento, mudança de caso); `Ficha.rg` opcional em `tipos.ts` e `leituras` opcional no `Banco` de `servidor.ts`, só acrescentados no fim. Verifica com `npm run typecheck`.
- [x] 7.2 Regras com teste: `src/regras/leitura.ts` (confiança abaixo de 80% pede atenção, mesma pessoa pelo nome ou pelo CPF, motivo da quarentena, divergência campo a campo, "Arquivar" só com a conferência e os duplicados decididos, quarentena com mais de um dia), com teste em `src/regras/leitura.test.ts` (CA7, CA8, CA9, CA10, CA12). Verifica com `npx vitest run src/regras/leitura.test.ts`.
- [x] 7.3 Servidor de exemplo: `src/dados/leitura.ts` (a pilha de exemplo da Rita, a leitura simulada da IA para o que chega pelo scanner e pelo card, `documentosLidos`, `arquivarDocumentos`, `usarNoCadastro`, `liberarDaQuarentena`, `moverDocumento`, `relatorioDeQuarentena` e a tarefa "Conferir documento"), com teste em `src/dados/leitura.test.ts` (CA1, CA2, CA4, CA6, CA8, CA9, CA10, CA11, CA12, CA13, CA16). Verifica com `npx vitest run src/dados/leitura.test.ts`.
- [x] 7.4 Tela do passo `/clientes/:id/conferir-documentos` (`src/paginas/ConferirDocumentos.tsx`, Figma `10:466`): topo, instruções, "A IA sugere · você confere", documentos com tipo, data e confiança, "Reclassificar", dados lidos contra o cadastro com "Usar no cadastro", quarentena com "liberar" e "Mover para outro caso" com motivo, a conferência, "Arquivar" e o painel "Antes de concluir" com a decisão dos duplicados; rota em `App.tsx`; a Central mostra "Conferir documento" no lugar das linhas fixas; teste em `ConferirDocumentos.test.tsx`, `App.test.tsx` e `CentralAtendimento.test.tsx` (CA3, CA7, CA8, CA9, CA10, CA11, CA14). Verifica com `npx vitest run src/paginas/ConferirDocumentos.test.tsx src/App.test.tsx src/paginas/CentralAtendimento.test.tsx`.
- [x] 7.5 Playwright `e2e/conferir-documentos.e2e.ts`: da Central à conferência da Rita, divergência e "Usar no cadastro", duplicado, quarentena movida com motivo, "Arquivar" (CA7, CA8, CA9, CA10, CA11); do balcão ao scanner até a conferência (CA1); tema escuro e fonte grande. Verifica com `npm run e2e`.
- [ ] 7.6 Ligar no servidor: trocar o corpo das funções de `src/dados/leitura.ts` por `fetch` nos endpoints da spec, ler o que o n8n gravou no Drive e chamar a IA de verdade. Depende do GGVP-118, do banco do Mateus e da automação do scanner. **Fica aberta nesta história.**

## GGVP-91 · Checklist de documentos obrigatórios do benefício

## GGVP-97 · Boas-vindas ao cliente

## GGVP-101 · Cobrar os documentos pendentes

## GGVP-18 · Liberar o caso ao Jurídico

<!-- Fim do grupo documentos. -->
