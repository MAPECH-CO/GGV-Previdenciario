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

- [x] 3.1 Contrato: a assinatura (ZapSign, tentativas, sênior, erro) e a etapa "leitura" em `src/dados/contrato.ts`. Verifica com `npm run typecheck`.
- [x] 3.2 Regra: `TENTATIVAS_DE_ASSINATURA`, `DIAS_ENTRE_TENTATIVAS_DE_ASSINATURA`, `cobrancaDaAssinatura` e `mensagemDoLink` em `src/regras/contrato.ts`, com teste em `src/regras/contrato.test.ts` (CA2, CA11, CA12). Verifica com `npx vitest run src/regras/contrato.test.ts`.
- [x] 3.3 Servidor de exemplo: a semente da Nair, `enviarParaAssinatura`, `registrarTentativaDeAssinatura`, `receberRetornoDoZapSign` e o ZapSign simulado em `src/dados/contrato.ts`, com teste em `src/dados/contrato.test.ts` (CA1 a CA7, CA9 a CA12). A linha fixa "Nair · Colher assinatura" sai de `atendimento.ts`. Verifica com `npx vitest run src/dados/contrato.test.ts`.
- [x] 3.4 Tela `/contrato/:processoId/assinatura` (`src/paginas/ColherAssinatura.tsx`, Figma `10:176`): "Como o cliente vai assinar?", "Enviar para assinatura", a janela do Chatwoot com o link, o cartão do ZapSign com o status, as tentativas, o lembrete, a ligação, o limite, o pendente e o retorno simulado, o erro com "Tentar de novo" e o painel; teste em `ColherAssinatura.test.tsx` (CA1 a CA6, CA9 a CA12). Verifica com `npx vitest run src/paginas/ColherAssinatura.test.tsx`.
- [x] 3.5 Playwright `e2e/colher-assinatura.e2e.ts`: da Central ao lembrete e à sênior (CA2, CA4, CA5, CA11, CA12), o retorno assinado na pasta do caso (CA3, CA6, CA10), tema escuro e fonte grande. Verifica com `npm run e2e -- colher-assinatura`.
- [ ] 3.6 Ligar no servidor: o ZapSign de verdade (modelo, link, webhook autenticado e o segredo no cofre do servidor) e o Chatwoot (GGVP-102). Depende do GGVP-118 e do banco do Mateus. **Fica aberta nesta história.**

## GGVP-77 · Assinatura em papel na entrevista

- [x] 4.1 Contrato: `impressoEm` na assinatura, em `src/dados/contrato.ts`. Verifica com `npm run typecheck`.
- [x] 4.2 Regra: `entrevistaDoCaso` e `papelNaHora` em `src/regras/contrato.ts`, com teste em `src/regras/contrato.test.ts` (CA1, CA4). Verifica com `npx vitest run src/regras/contrato.test.ts`.
- [x] 4.3 Servidor de exemplo: `imprimirKit`, `digitalizarContratoAssinado` (a automação do balcão simulada) e `concluirAssinaturaEmPapel` em `src/dados/contrato.ts`, com teste em `src/dados/contrato.test.ts` (CA1 a CA4). Verifica com `npx vitest run src/dados/contrato.test.ts`.
- [x] 4.4 Tela `/contrato/:processoId/assinatura` (Figma `10:176`): "Em papel na hora" só na entrevista presencial, o cartão "Assinatura em papel" com a impressão, as datas, a digitalização e o anexo obrigatório, "Concluir a assinatura" e o "Contrato assinado em papel"; teste em `ColherAssinatura.test.tsx` (CA1 a CA4). Verifica com `npx vitest run src/paginas/ColherAssinatura.test.tsx`.
- [x] 4.5 Playwright `e2e/colher-assinatura.e2e.ts`: do contrato gerado ao papel na hora, com a digitalização na pasta do caso (CA1, CA2, CA3). Verifica com `npm run e2e -- colher-assinatura`.
- [ ] 4.6 Ligar no servidor: a impressão de verdade e o aviso do n8n quando o contrato assinado passa no scanner. Depende do GGVP-118, do banco do Mateus e da automação do balcão. **Fica aberta nesta história.**

## GGVP-85 · Verificar o contrato assinado

- [x] 5.1 Contrato: a leitura do contrato assinado, a verificação, as versões anteriores e as etapas "conferir" e "copia" em `src/regras/contrato.ts` e `src/dados/contrato.ts`. Verifica com `npm run typecheck`.
- [x] 5.2 Regra: `precisaConferir`, `resumoDaLeitura`, `paginasDaLeitura` e `motivoParadoDaVerificacao` em `src/regras/contrato.ts`, com teste em `src/regras/contrato.test.ts` (CA1, CA2, CA4, CA5). Verifica com `npx vitest run src/regras/contrato.test.ts`.
- [x] 5.3 Servidor de exemplo: `concluirLeituraDoContrato` (o ponto que a leitura da GGVP-81 chama), a leitura de exemplo, `verificarContrato` e `avisarClienteDaConferencia` em `src/dados/contrato.ts`, com teste em `src/dados/contrato.test.ts` (CA1 a CA7). Verifica com `npx vitest run src/dados/contrato.test.ts`.
- [x] 5.4 Tela `/contrato/:processoId/conferir` (`src/paginas/ConferirContrato.tsx`, Figma `10:202`): chips com o benefício, "A IA sugere · você confere", o contato do cliente, o contrato na íntegra, a página anexa, "O que corrigir", "Está certo — seguir", "Corrigir" e o painel "Está tudo certo?"; "Simular a leitura da IA" na tela de colher a assinatura e o aviso da volta no preparo. Teste em `ConferirContrato.test.tsx` (CA2 a CA7). Verifica com `npx vitest run src/paginas/ConferirContrato.test.tsx src/paginas/ColherAssinatura.test.tsx src/paginas/PrepararContrato.test.tsx`.
- [x] 5.5 Playwright `e2e/conferir-contrato.e2e.ts`: a Nair sem tarefa de conferir (CA1, CA7), o Antônio com a página cortada, corrigir e voltar ao preparo (CA2 a CA6), tema escuro e fonte grande. Verifica com `npm run e2e -- conferir-contrato`.
- [ ] 5.6 Ligar no servidor: a leitura da GGVP-81 chama `concluirLeituraDoContrato` (sai o botão "Simular a leitura da IA") e o corpo de `src/dados/contrato.ts` vira `fetch`. Depende da junção com o grupo documentos, do GGVP-118 e do banco do Mateus. **Fica aberta nesta história.**

## GGVP-89 · Cópia do contrato para o cliente levar

<!-- Fim do grupo contrato. -->

<!-- Grupo documentos: preencher só as seções deste bloco. -->

## GGVP-81 · Ler e arquivar os documentos

## GGVP-91 · Checklist de documentos obrigatórios do benefício

## GGVP-97 · Boas-vindas ao cliente

## GGVP-101 · Cobrar os documentos pendentes

## GGVP-18 · Liberar o caso ao Jurídico

<!-- Fim do grupo documentos. -->
