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

- [x] 8.1 Contrato: tipos em `apps/web/src/regras/checklist.ts` (item, checklist, lista do benefício, condição) e em `src/dados/checklist.ts` (conferência); `checklists` opcional no `Banco`; os documentos do LOAS e as notas do produtor no fim de `TIPOS_DE_DOCUMENTO`; a leitura guarda a hora do "Arquivar" e aponta "sem assinatura" e "data em branco". Verifica com `npm run typecheck`.
- [x] 8.2 Regras com teste: `src/regras/checklist.ts` (contrato do kit, lista do benefício, condicionais do caso, documentos da entrevista sem repetir, recebido, pendente pelo G1 e problema pela quarentena, "completo" calculado, sem lista nunca completa, trava da liberação com o que falta), com teste em `src/regras/checklist.test.ts` (CA1, CA2, CA3, CA5, CA6, CA7, CA8, CA10). Verifica com `npx vitest run src/regras/checklist.test.ts`.
- [x] 8.3 Servidor de exemplo: `src/dados/checklist.ts` (a configuração de exemplo só com o LOAS, o que a entrevista pediu à Rita e ao Antônio, o contrato assinado até a junção com o grupo contrato, `obterChecklist`, `conferirChecklist` e a tarefa "Conferir checklist" depois da leitura arquivada), com teste em `src/dados/checklist.test.ts` (CA1, CA2, CA5, CA6, CA7, CA8, CA9, CA10). Verifica com `npx vitest run src/dados/checklist.test.ts`.
- [x] 8.4 Tela do passo `/casos/:processoId/checklist` (`src/paginas/ConferirChecklist.tsx`, Figma `1818:2`): topo, instruções, "Checklist · benefício" com ok, falta e problema e o porquê de cada item, situação calculada, aviso do benefício sem lista, trava da liberação, a nota da lista e "Concluir a conferência"; rota em `App.tsx`; a Central mostra "Conferir checklist"; a conferência de documentos mostra o que ainda falta depois de arquivar; teste em `ConferirChecklist.test.tsx`, `ConferirDocumentos.test.tsx`, `App.test.tsx` e `CentralAtendimento.test.tsx` (CA1, CA2, CA3, CA5, CA6, CA7; GGVP-81 CA14). Verifica com `npx vitest run src/paginas/ConferirChecklist.test.tsx`.
- [x] 8.5 Playwright `e2e/checklist.e2e.ts`: da leitura arquivada ao checklist da Rita, incompleto e com a liberação bloqueada, e "Concluir a conferência" (CA1, CA3, CA5, CA7); benefício sem lista (CA6); tema escuro e fonte grande. Verifica com `npm run e2e`.
- [ ] 8.6 Ligar no servidor: trocar o corpo das funções de `src/dados/checklist.ts` por `fetch` nos endpoints da spec e ler as listas da configuração do escritório (GGVP-104) e a lista da entrevista (GGVP-46). Depende do GGVP-118, do banco do Mateus, da GGVP-104 e da GGVP-46. **Fica aberta nesta história.**

## GGVP-97 · Boas-vindas ao cliente

## GGVP-101 · Cobrar os documentos pendentes

## GGVP-18 · Liberar o caso ao Jurídico

<!-- Fim do grupo documentos. -->
