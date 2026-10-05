# Tasks

<!-- Grupo contrato: preencher só as seções deste bloco. -->

## GGVP-65 · Kit de documentos por benefício

- [x] 1.1 Contrato: os tipos do kit e do contrato do processo em `apps/web/src/regras/contrato.ts` e `apps/web/src/dados/contrato.ts`, e `contratos?` no `Banco` de `servidor.ts`. Verifica com `npm run typecheck`.
- [x] 1.2 Regra: a tabela `KITS` e `montarKit` em `src/regras/contrato.ts`, com um teste por benefício da tabela, as exceções, o modelo, o catálogo único e as condições do LOAS em `src/regras/contrato.test.ts` (CA1 a CA6, CA8). Verifica com `npx vitest run src/regras/contrato.test.ts`.
- [x] 1.3 Servidor de exemplo: a semente (Cleide, Aposentadoria PCD, para preparar), `fecharContrato`, `obterContrato`, `salvarCondicoes` e `tarefasDoContrato` em `src/dados/contrato.ts`, com teste em `src/dados/contrato.test.ts` (CA1, CA2, CA8, CA9). A linha fixa "Cleide · Conferir contrato" sai de `atendimento.ts`. Verifica com `npx vitest run src/dados/contrato.test.ts`.
- [x] 1.4 Tela `/contrato/:processoId/preparar` (`src/paginas/PrepararContrato.tsx`, Figma `10:143`): chips, título, "O que você deve fazer", o cartão "Kit do benefício" com os documentos, o modelo, quem assina e as condições do LOAS, e o aviso do benefício sem kit; a tarefa na Central. Teste em `PrepararContrato.test.tsx` (CA1, CA2, CA3, CA5, CA8). Verifica com `npx vitest run src/paginas/PrepararContrato.test.tsx src/paginas/CentralAtendimento.test.tsx`.
- [x] 1.5 Playwright `e2e/preparar-contrato.e2e.ts`: da Central ao kit das aposentadorias (CA1, CA4, CA5), tema escuro e fonte grande. Verifica com `npm run e2e -- preparar-contrato`.
- [ ] 1.6 Ligar no servidor: trocar o corpo de `src/dados/contrato.ts` por `fetch` e ligar `fecharContrato` à definição do benefício e à nova demanda (GGVP-124). Depende do GGVP-118 e do banco do Mateus. **Fica aberta nesta história.**

## GGVP-69 · Preencher o contrato pelo modelo e conferir

- [x] 2.1 Contrato: os campos do modelo, a origem, as correções e o documento gerado em `src/regras/contrato.ts` e `src/dados/contrato.ts` (etapa "assinatura", `dados`, `corrigidos`, `documento`, `versoes`). Verifica com `npm run typecheck`.
- [x] 2.2 Regra: `camposDoModelo`, `erroDoCampo` (pela biblioteca `campos`), `motivoParadoDoGerar`, `datasDoKit`, o identificador do modelo, os honorários e `restosDoModelo`, com teste em `src/regras/contrato.test.ts` (CA1 a CA11). Verifica com `npx vitest run src/regras/contrato.test.ts`.
- [x] 2.3 Servidor de exemplo: `gerarContrato` em `src/dados/contrato.ts` (valida de novo, grava a correção na ficha e no contrato, registra no histórico, gera o texto de cada documento e passa para "Colher assinatura"), com teste em `src/dados/contrato.test.ts` (CA1, CA3, CA6, CA7, CA8, CA9). Verifica com `npx vitest run src/dados/contrato.test.ts`.
- [x] 2.4 Tela `/contrato/:processoId/preparar` (Figma `10:143`): o cartão "Documento preenchido" com a origem e os honorários, "O que conferir", "O que corrigir", as quatro conferências, "Gerar contrato" com o motivo parado, o painel "Os documentos foram aprovados?" e o "Contrato gerado"; teste em `PrepararContrato.test.tsx` (CA1, CA2, CA3, CA5, CA6, CA7, CA9, CA10, CA11). Verifica com `npx vitest run src/paginas/PrepararContrato.test.tsx`.
- [x] 2.5 Playwright `e2e/preparar-contrato.e2e.ts`: os campos com a origem e os honorários (CA1, CA5, CA11), a trava, a correção e o CPF de outra ficha (CA3, CA6, CA7). Verifica com `npm run e2e -- preparar-contrato`.
- [ ] 2.6 Ligar no servidor: trocar o corpo de `gerarContrato` por `fetch`, usar os modelos convertidos de verdade (pasta "MODELOS ZAPSIGN · PREV") e a lista do cliente de exemplo deles. Depende do GGVP-118, do banco do Mateus e da GGVP-104. **Fica aberta nesta história.**

## GGVP-72 · Assinatura digital pelo ZapSign

## GGVP-77 · Assinatura em papel na entrevista

## GGVP-85 · Verificar o contrato assinado

## GGVP-89 · Cópia do contrato para o cliente levar

<!-- Fim do grupo contrato. -->

<!-- Grupo documentos: preencher só as seções deste bloco. -->

## GGVP-81 · Ler e arquivar os documentos

## GGVP-91 · Checklist de documentos obrigatórios do benefício

## GGVP-97 · Boas-vindas ao cliente

## GGVP-101 · Cobrar os documentos pendentes

## GGVP-18 · Liberar o caso ao Jurídico

<!-- Fim do grupo documentos. -->
