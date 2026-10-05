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

- [x] 9.1 Contrato: tipos em `apps/web/src/dados/boasVindas.ts` (boas-vindas do caso, registro de cada tentativa, envio conferido) e `boasVindas` opcional no `Banco`. Verifica com `npm run typecheck`.
- [x] 9.2 Regras com teste: `src/regras/boasVindas.ts` (já era cliente quando tem outro processo; a mensagem pelo modelo de exemplo, com as cópias e as pendências do checklist em linguagem simples), com teste em `src/regras/boasVindas.test.ts` (CA1, CA3, CA5). Verifica com `npx vitest run src/regras/boasVindas.test.ts`.
- [x] 9.3 Servidor de exemplo: `src/dados/boasVindas.ts` (as cópias do kit até a junção com o grupo contrato, `obterBoasVindas`, `enviarBoasVindas` uma vez e conferida, a falha sem telefone e a tarefa "Reenviar boas-vindas"), com teste em `src/dados/boasVindas.test.ts` (CA1, CA2, CA3, CA4, CA5, CA6). Verifica com `npx vitest run src/dados/boasVindas.test.ts`.
- [x] 9.4 Bloco "Boas-vindas (D1.22)" na tela do checklist (`src/componentes/CartaoBoasVindas.tsx`, Figma `1818:2`, rótulo Chatwoot): esperando a conferência, a enviar com a mensagem para conferir, "Conferi a mensagem" e "Enviar pelo Chatwoot", enviada, já era cliente e a falha com "Tentar de novo"; o subtítulo diz cliente novo ou já era cliente; a Central mostra "Reenviar boas-vindas"; teste em `CartaoBoasVindas.test.tsx` e `CentralAtendimento.test.tsx` (CA1, CA2, CA3, CA4, CA6). Verifica com `npx vitest run src/componentes/CartaoBoasVindas.test.tsx`.
- [x] 9.5 Playwright `e2e/boas-vindas.e2e.ts`: conferido o checklist, a mensagem com as pendências sai pelo Chatwoot simulado e aparece no histórico e nos últimos contatos (CA1, CA2, CA4, CA5); já era cliente (CA3); sem telefone vira tarefa (CA6); tema escuro e fonte grande. Verifica com `npm run e2e`.
- [ ] 9.6 Ligar no servidor: trocar o corpo das funções de `src/dados/boasVindas.ts` por `fetch` nos endpoints da spec, mandar pelo Chatwoot de verdade com o modelo aprovado e as cópias do grupo contrato (GGVP-89). Depende do GGVP-118, do banco do Mateus e da GGVP-102. **Fica aberta nesta história.**

## GGVP-101 · Cobrar os documentos pendentes

- [x] 10.1 Contrato: tipos em `apps/web/src/regras/cobranca.ts` (tentativa, prazo externo, decisão da sênior) e em `src/dados/cobranca.ts` (cobrança do caso, registro da tentativa, decisão); `cobrancas` opcional no `Banco`. Verifica com `npm run typecheck`.
- [x] 10.2 Regras com teste: `src/regras/cobranca.ts` (2 tentativas e 3 dias, próxima tentativa, data adiada só para a próxima, prazo externo que aperta e deixa urgente, quando sobe para a sênior, mais uma tentativa depois da decisão, adiar e decidir com as travas, a mensagem pronta), com teste em `src/regras/cobranca.test.ts` (CA3, CA5, CA7, CA8, CA10, CA11, CA12). Verifica com `npx vitest run src/regras/cobranca.test.ts`.
- [x] 10.3 Servidor de exemplo: `src/dados/cobranca.ts` (a cobrança aberta pela conferência incompleta, a do Antônio na semente com o prazo do juiz e no limite, `obterCobranca`, `registrarTentativa`, `adiarCobranca`, `decidirCobranca`, o fechamento sozinho quando chega tudo, as tarefas "Cobrar documento" e "Decidir cobrança"), com teste em `src/dados/cobranca.test.ts` (CA1, CA2, CA3, CA4, CA5, CA6, CA7, CA8, CA9, CA10, CA12). Verifica com `npx vitest run src/dados/cobranca.test.ts`.
- [x] 10.4 Tela `/casos/:processoId/cobranca` (`src/paginas/CobrarDocumento.tsx`, Figma `2106:3`): chips com o benefício, título, instruções com a tentativa e o prazo externo, pendentes do checklist com o próximo lembrete, aviso do G15, tentativas e decisões, contato com "Ligar" e "Chatwoot", "Anexar o documento recebido" (janela "Conferir e enviar"), "Enviar cobrança" (Chatwoot simulado com a mensagem pronta) e "Adiar" com a nova data; a cobrança entra na janela do Chatwoot; teste em `Cobranca.test.tsx` (CA2, CA4, CA5, CA6, CA7, CA10, CA11, CA12). Verifica com `npx vitest run src/paginas/Cobranca.test.tsx`.
- [x] 10.5 Tela da sênior `/casos/:processoId/cobranca/decidir` (`src/paginas/DecidirCobranca.tsx`, Figma `1818:440`): laço, pendências e prazo, tentativas, as três decisões, o novo prazo, a justificativa obrigatória, a nota do limite e "Registrar decisão"; o checklist incompleto passa a "Gerar cobrança das pendências", como no Figma `1818:2`; rotas em `App.tsx`; as Centrais mostram "Cobrar documento" e "Decidir cobrança"; teste em `Cobranca.test.tsx`, `ConferirChecklist.test.tsx`, `App.test.tsx`, `CentralAtendimento.test.tsx` e `CentralAdvogada.test.tsx` (CA1, CA7, CA8). Verifica com `npx vitest run src/paginas`.
- [x] 10.6 Playwright `e2e/cobranca.e2e.ts`: do checklist incompleto à cobrança na Central, enviada pelo Chatwoot com a mensagem pronta (CA1, CA4, CA6, CA11); a do Antônio na sênior, decidida com justificativa e de volta ao Atendimento (CA7, CA8, CA12); tema escuro e fonte grande nas duas telas. Verifica com `npm run e2e`.
- [ ] 10.7 Ligar no servidor: trocar o corpo das funções de `src/dados/cobranca.ts` por `fetch` nos endpoints da spec, ler o prazo do juiz ou do INSS do processo, mandar pelo Chatwoot de verdade e levar o laço para a régua geral da GGVP-94. Depende do GGVP-118, do banco do Mateus, da GGVP-102 e da GGVP-94. **Fica aberta nesta história.**

## GGVP-18 · Liberar o caso ao Jurídico

<!-- Fim do grupo documentos. -->
