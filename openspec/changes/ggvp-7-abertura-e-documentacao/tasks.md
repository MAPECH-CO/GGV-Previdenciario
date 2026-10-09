# Tasks

<!-- Grupo contrato: preencher só as seções deste bloco. -->

## GGVP-65 · Kit de documentos por benefício

- [x] 1.1 Contrato: os tipos do kit e do contrato do processo em `apps/web/src/regras/contrato.ts` e `apps/web/src/dados/contrato.ts`, e `contratos?` no `Banco` de `servidor.ts`. Verifica com `npm run typecheck`.
- [x] 1.2 Regra: a tabela `KITS` e `montarKit` em `src/regras/contrato.ts`, com um teste por benefício da tabela, as exceções, o modelo, o catálogo único e as condições do LOAS em `src/regras/contrato.test.ts` (CA1 a CA6, CA8). Verifica com `npx vitest run src/regras/contrato.test.ts`.
- [x] 1.3 Servidor de exemplo: a semente (Cleide, Aposentadoria PCD, para preparar), `fecharContrato`, `obterContrato`, `salvarCondicoes` e `tarefasDoContrato` em `src/dados/contrato.ts`, com teste em `src/dados/contrato.test.ts` (CA1, CA2, CA8, CA9). A linha fixa "Cleide · Conferir contrato" sai de `atendimento.ts`. Verifica com `npx vitest run src/dados/contrato.test.ts`.
- [x] 1.4 Tela `/contrato/:processoId/preparar` (`src/paginas/PrepararContrato.tsx`, Figma `10:143`): chips, título, "O que você deve fazer", o cartão "Kit do benefício" com os documentos, o modelo, quem assina e as condições do LOAS, e o aviso do benefício sem kit; a tarefa na Central. Teste em `PrepararContrato.test.tsx` (CA1, CA2, CA3, CA5, CA8). Verifica com `npx vitest run src/paginas/PrepararContrato.test.tsx src/paginas/CentralAtendimento.test.tsx`.
- [x] 1.5 Playwright `e2e/preparar-contrato.e2e.ts`: da Central ao kit das aposentadorias (CA1, CA4, CA5), tema escuro e fonte grande. Verifica com `npm run e2e -- preparar-contrato`.
- [ ] 1.6 Ligar no servidor: trocar o corpo de `src/dados/contrato.ts` por `fetch`. No servidor de exemplo, `fecharContrato` já é chamado pelo fechamento (GGVP-60) e pela nova demanda (GGVP-124), em `ea33f2c`. Depende do GGVP-118 e do banco do Mateus. **Fica aberta nesta história.**

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

- [x] 6.1 Contrato: a cópia (impressão, visita, entrega) e a etapa "entregue" em `src/dados/contrato.ts`. Verifica com `npm run typecheck`.
- [x] 6.2 Regra: `errosDaEntrega`, `motivoParadoDaEntrega` e `errosDaVisita` (pela biblioteca `campos`) em `src/regras/contrato.ts`, com teste em `src/regras/contrato.test.ts` (CA3, CA4). Verifica com `npx vitest run src/regras/contrato.test.ts`.
- [x] 6.3 Servidor de exemplo: a semente da Cleide (Aposentadoria Especial), `imprimirCopia`, `marcarVisitaDaCopia` e `registrarEntregaDaCopia` em `src/dados/contrato.ts`, o passo D1.20 do novo compromisso em `dados/agenda.ts`, com teste em `src/dados/contrato.test.ts` (CA1 a CA5). A linha fixa "Cleide · Entregar a cópia do contrato" sai de `atendimento.ts`. Verifica com `npx vitest run src/dados/contrato.test.ts`.
- [x] 6.4 Tela `/contrato/:processoId/copia` (`src/paginas/EntregarCopia.tsx`, Figma `2106:69`): chips, título, a linha do contrato assinado e da visita, "O que você deve fazer", "Imprimir cópia para o cliente", "Registrar a entrega" com a confirmação, a data, quem recebeu e a observação, "Entregar depois, numa visita", a entrega registrada e o painel; teste em `EntregarCopia.test.tsx` (CA1, CA3, CA4, CA5). Verifica com `npx vitest run src/paginas/EntregarCopia.test.tsx src/paginas/CentralAtendimento.test.tsx`.
- [x] 6.5 Playwright `e2e/entregar-copia.e2e.ts`: da Central à entrega (CA1, CA2, CA3, CA5), a visita na agenda (CA4), tema escuro e fonte grande. Verifica com `npm run e2e -- entregar-copia`.
- [ ] 6.6 Ligar no servidor: o corpo de `src/dados/contrato.ts` vira `fetch`, a página do processo (GGVP-86) ganha "Imprimir cópia para o cliente" e o checklist (GGVP-91) lê a etapa "entregue". Depende do GGVP-118, do banco do Mateus e da junção com o grupo documentos. **Fica aberta nesta história.**

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

- [x] 11.1 Contrato: tipos em `apps/web/src/regras/liberacao.ts` (perfil, parecer) e em `src/dados/liberacao.ts` (caso para liberar, pedido, liberação); `liberacoes` opcional no `Banco`. Verifica com `npm run typecheck`.
- [x] 11.2 Regras com teste: `src/regras/liberacao.ts` (os benefícios da matriz de laudos pedem parecer "Suficiente", a trava com o checklist, o parecer e as duas conferências, a idade na fila em dias), com teste em `src/regras/liberacao.test.ts` (CA2, CA5, CA7). Verifica com `npx vitest run src/regras/liberacao.test.ts`.
- [x] 11.3 Servidor de exemplo: `src/dados/liberacao.ts` (o parecer de exemplo até a GGVP-20, a fila da Documentação com o checklist conferido completo e o Sebastião da semente, `obterLiberacao`, `liberarAoJuridico` só pela Documentação · ADM com a tentativa de outro perfil registrada, as tarefas "Liberar ao Jurídico" e "Conferir antes do INSS"), com teste em `src/dados/liberacao.test.ts` (CA1, CA2, CA4, CA5, CA6, CA7). Verifica com `npx vitest run src/dados/liberacao.test.ts`.
- [x] 11.4 Tela do passo `/casos/:processoId/liberar` (`src/paginas/LiberarCaso.tsx`, Figma `10:264`): chips com o benefício, instruções com o kit, "Conferir" com os três itens (o parecer é registro), aviso do G17, a situação para outro perfil (`?perfil=`), "Resumo do que foi coletado", "Documentos (abrir cada um)", "Liberar ao Jurídico", o painel "Antes de concluir" e o feito com quem liberou; rota em `App.tsx`; a Central mostra "Liberar ao Jurídico" com a idade na fila no lugar da linha fixa, e a Central da Advogada mostra "Conferir antes do INSS"; teste em `LiberarCaso.test.tsx`, `App.test.tsx` e `CentralAtendimento.test.tsx` (CA1, CA2, CA4, CA5, CA6, CA7). Verifica com `npx vitest run src/paginas/LiberarCaso.test.tsx`.
- [x] 11.5 Playwright `e2e/liberar.e2e.ts`: o caminho inteiro da Rita, da leitura ao OK e à fila da sênior (CA1, CA6, CA7); o Sebastião na fila há 2 dias e travado (CA2, CA5); outro perfil vê só a situação (CA4); tema escuro e fonte grande. Verifica com `npm run e2e`.
- [ ] 11.6 Ligar no servidor: trocar o corpo das funções de `src/dados/liberacao.ts` por `fetch` nos endpoints da spec, tirar o perfil do login (a tela já usa o perfil da sessão; o servidor de exemplo ainda recebe o `perfil` que a tela manda, e o servidor de verdade confere o da sessão), ler o parecer da GGVP-20 e gravar no histórico do processo (GGVP-86). Depende do GGVP-118, do banco do Mateus, da GGVP-20 e da GGVP-86. **Fica aberta nesta história.**

<!-- Fim do grupo documentos. -->

## GGVP-125 · Ligar a Recepção e a Abertura no servidor (Mateus, 08/10)

Em ordem, elo por elo, sobre as telas do Pedro (spec `ggvp-125`). Modo misto até terminar: lead novo no servidor, semente de exemplo no navegador.

### Bloco 1 · O lead e a ficha

- [x] 125.1 Banco: tabela `ficha_recepcao` (a ficha da Recepção, por pessoa, no formato das telas) e a migração; a pessoa em `pessoa`.
- [x] 125.2 Contratos (`packages/contratos/src/recepcao.ts`): busca, "Já existe?", novo cliente, edição da ficha e ficha de atendimento, em Zod; matriz com `ficha.editar`.
- [x] 125.3 Servidor (`apps/api/src/rotas/recepcao.ts`): `POST /api/balcao/busca`, `POST /api/fichas/duplicidade`, `POST /api/fichas`, `GET /api/fichas/:id`, `PATCH /api/fichas/:id`, `PUT /api/fichas/:id/ficha-de-atendimento`, com as regras do Pedro, o perfil da sessão e o histórico; testes.
- [x] 125.4 Telas: o modo servidor no `servidor.ts` (ligado na abertura do app; os testes seguem no modo exemplo), as funções do bloco chamando a API, a busca juntando os dois lados e a cópia da ficha para o modo exemplo; testes.
- [x] 125.5 Playwright: um lead cadastrado pela Atendimento achado pela advogada em outra sessão; os testes do Pedro seguem passando.
- [x] 125.6 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

### Bloco 2 · Agenda e confirmação

- [x] 125.7 Banco: `tarefa_recepcao` (a tarefa no formato das telas, por pessoa, com setor e quando foi concluída) e `compromisso_interno`; a migração.
- [x] 125.8 Contratos: marcação, entrevista agora, resultado, convite, compromisso interno, encaminhamento, mensagem e registro da confirmação.
- [x] 125.9 Servidor: `GET /api/recepcao` (fichas, tarefas abertas e compromissos internos, para a cópia do navegador); `POST /api/fichas/:id/agendamentos`, `POST /api/fichas/:id/entrevistas/agora`, `POST /api/fichas/:id/encaminhamentos`, `POST /api/agendamentos/:id/resultado`, `POST /api/agendamentos/:id/convite`, `POST /api/agenda/internos`, `POST /api/agendamentos/:id/confirmacao/mensagem`, `POST /api/agendamentos/:id/confirmacao`; G15 no servidor; as tarefas que abrem e concluem, também na ficha de atendimento; testes.
- [x] 125.10 Telas: a cópia atualizada ao abrir cada tela, depois da sessão; as funções do bloco chamando a API para as fichas do servidor; a cópia em três vias com a agenda por compromisso; testes.
- [x] 125.11 Playwright: a Atendimento marca e registra a confirmação; a advogada, em outra sessão, vê "Preparar entrevista" na Central e a entrevista na agenda.
- [x] 125.12 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".


### Bloco 3a · Entrevista gravada e transcrição

- [x] 125.13 Banco: `gravacao_recepcao` (a gravação ou a conversa no formato das telas, por pessoa, com `so_juridico`) e a migração; matriz com `entrevista.gravar` (Jurídico).
- [x] 125.14 Contratos: início (com o aviso), ação, fim, sem áudio, áudio de fora, transcrição, conferência, documentos, prova e conversa sem áudio.
- [x] 125.15 Servidor: `POST /api/entrevistas/:id/gravacoes`, `POST /api/gravacoes/:id/acoes`, `POST /api/gravacoes/:id/encerrar`, `POST /api/gravacoes/:id/audio`, `POST /api/gravacoes/:id/sem-audio`, `POST /api/entrevistas/:id/audio`, `POST /api/gravacoes/:id/transcricao`, `POST /api/gravacoes/:id/conferencias`, `POST /api/gravacoes/:id/documentos`, `PATCH /api/gravacoes/:id/trechos/:aos`, `POST /api/fichas/:id/conversas`; as gravações na cópia das telas por perfil; o fim da entrevista abre e conclui as tarefas; testes.
- [x] 125.16 Telas: as funções da entrevista e da transcrição chamando a API para as fichas do servidor; a cópia recebe as gravações; testes.
- [x] 125.17 Playwright: a advogada grava e encerra a entrevista de um lead do balcão; outra sessão do Jurídico vê "Cadastrar lead"; a Atendimento não recebe a gravação.
- [x] 125.18 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

### Bloco 3b · Cadastro, benefício, cálculo, fechamento, nova demanda e cofre

- [x] 125.19 Contratos: cadastro, análise da ficha, decisão do benefício, cálculo, fechamento, recontato, nova demanda, situação do cofre e renovação (sem a senha); matriz com `ficha.analisar` (Jurídico).
- [x] 125.20 Servidor: `PUT /api/fichas/:id/cadastro`, `POST /api/entrevistas/:id/analise`, `POST /api/entrevistas/:id/beneficio`, `POST /api/entrevistas/:id/calculo`, `POST /api/fichas/:id/fechamento`, `POST /api/fichas/:id/recontato`, `POST /api/fichas/:id/demandas`, `POST /api/fichas/:id/cofre/gov`, `POST /api/entrevistas/:id/renovacao`; G16 na pessoa; o papel do fechamento pela sessão; a situação do cofre lida do cofre de verdade; testes.
- [x] 125.21 Telas: as funções do bloco chamando a API para as fichas do servidor; a senha vai ao cofre de verdade; "fechou" segue para o contrato do modo exemplo até o bloco 4; testes.
- [x] 125.22 Playwright: do lead do balcão gravado à definição do benefício pela advogada e ao fechamento com o motivo; a senha guardada não fica na ficha nem no navegador.
- [x] 125.23 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

### Bloco 3c · Segunda ficha médica

- [x] 125.24 Banco: `segunda_ficha_medica` (a seção médica por pessoa, à parte da ficha) e a migração.
- [x] 125.25 Contratos: envio da segunda ficha (respostas e origem).
- [x] 125.26 Servidor: `POST /api/fichas/:id/segunda-ficha/leitura`, `PUT /api/fichas/:id/segunda-ficha` e `GET /api/fichas/:id/segunda-ficha` (só com `dado_saude.ver_detalhe`, cada leitura em `acesso_dado_sensivel`); a ficha sem os campos médicos; o tablet em branco não apaga; testes.
- [x] 125.27 Telas: ler e salvar a segunda ficha das fichas do servidor; a preparação da entrevista busca a seção médica ao abrir, sem guardar no navegador; testes.
- [x] 125.28 Playwright: a Atendimento salva a segunda ficha de um lead do balcão; a advogada vê a seção médica na preparação; a cópia da Atendimento não traz os campos médicos.
- [x] 125.29 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

### Bloco 4a · Fechar e preparar o contrato

- [x] 125.30 Telas do Pedro: os tipos do contrato e as funções puras (campos do caso, textos dos modelos) vão para `regras/contratoDoCaso.ts`, reexportados por `dados/contrato.ts`, para o servidor não carregar o banco de exemplo.
- [x] 125.31 Banco: `contrato_recepcao` (o contrato do caso, no formato das telas, com a etapa do processo) e a migração.
- [x] 125.32 Contratos: fechar (benefício), condições do kit e geração do contrato.
- [x] 125.33 Servidor: `POST /api/fichas/:id/processos` (cria o caso em `caso` e o contrato; o lead vira cliente), `PUT /api/processos/:id/contrato/condicoes`, `POST /api/processos/:id/contrato/gerar`; os processos das fichas com a etapa do contrato; os contratos na cópia das telas; testes.
- [x] 125.34 Telas: fechar, condições e gerar chamando a API para as fichas do servidor; processos e contratos na cópia em três vias; testes.
- [x] 125.35 Playwright: do lead do balcão com o benefício definido ao "fechou" e ao "Preparar contrato" em outra sessão (a geração tem os testes do servidor e das telas, e o 125.40 gera pelas rotas).
- [x] 125.36 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

### Bloco 4b · Colher a assinatura (ZapSign e papel)

- [x] 125.37 Contratos: a tentativa de assinatura (canal e mensagem).
- [x] 125.38 Servidor: `POST /api/processos/:id/contrato/zapsign`, `/tentativas` (G15: a tarefa da sênior no banco), `/zapsign/retorno-simulado`, `/impressao`, `/digitalizacao` e `/assinatura-em-papel`; testes.
- [x] 125.39 Telas: enviar, tentar de novo, simular o retorno, imprimir, digitalizar e concluir chamando a API para os contratos do servidor; o arquivo assinado na pasta da cópia daqui; testes.
- [x] 125.40 Playwright: do contrato gerado ao assinado pelo ZapSign e ao assinado em papel, visto de outra sessão.
- [x] 125.41 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

### Bloco 4c · Ler, conferir e entregar a cópia

- [x] 125.42 Telas do Pedro: `visitaDaCopia` e a leitura de exemplo vão para `regras/contratoDoCaso.ts`, para o servidor usar as mesmas.
- [x] 125.43 Contratos: verificação do contrato, visita e entrega da cópia (o aviso usa a mensagem do bloco 2).
- [x] 125.44 Servidor: `POST /api/processos/:id/contrato/leitura-simulada`, `/verificacao`, `/conferencia/aviso`, `/copia/impressao`, `/copia/visita` e `/copia/entrega`; testes.
- [x] 125.45 Telas: a leitura, a conferência, o aviso e a cópia chamando a API para os contratos do servidor; a página corrigida na pasta da cópia daqui; testes.
- [x] 125.46 Playwright: do assinado em papel à leitura, à conferência e à cópia entregue, visto de outra sessão.
- [x] 125.47 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

### Revisão do bloco 3b · telefone do lead e do cliente (revisor, 08/10)

- [x] 125.48 Trazer a correção do revisor (decisão do Pedro, 08/10): a regra única do contato não pede verificação ao lead; os testes dele de servidor, tela e navegador.
- [x] 125.49 Servidor: o cadastro (`PUT /api/fichas/:id/cadastro`) passa a ficha de cliente pela trava do contato, como a edição da ficha; teste do lead que troca e do cliente que não troca.
- [x] 125.50 O teste do cadastro volta a trocar o telefone do lead sem a verificação (sai o ajuste da junção com a main).
- [x] 125.51 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

### Bloco 5a · A lista de arquivos da ficha no servidor

- [x] 125.52 Servidor: a imagem da segunda ficha, o contrato assinado (ZapSign e papel) e a página corrigida entram em `arquivos` da ficha do servidor, com `nomeSemSobrescrever`; testes.
- [x] 125.53 Servidor: `POST /api/fichas/:id/ficha-de-atendimento/leitura` (a leitura em papel, simulada), com a imagem em Documentos pessoais e sem senha no cofre (G9); testes.
- [x] 125.54 Telas: a cópia recebe `arquivos` em três vias, pelo nome; sai o arquivo que as telas punham só na cópia; a leitura da ficha de atendimento chama a API para as fichas do servidor; testes.
- [x] 125.55 Playwright: o contrato assinado numa sessão aparece na pasta do processo em outra.
- [x] 125.56 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

### Bloco 5b · A chegada, a leitura e o arquivo dos documentos no servidor

- [x] 125.57 Banco: `leitura_documento` (uma leitura por arquivo, à parte da ficha) e a migração.
- [x] 125.58 Contratos: envio pelo card, recebimento, arquivamento, mudança de caso e campo do cadastro.
- [x] 125.59 Servidor: `POST /api/fichas/:id/arquivos` (card; laudo novo para o Jurídico, sem resumo), `POST /api/tarefas/:id/lote` e `/registro`; a leitura simulada nasce quando o arquivo chega (também o contrato assinado); testes.
- [x] 125.60 Servidor: `GET /api/fichas/:id/documentos-lidos`, `POST /api/fichas/:id/documentos-lidos/arquivar` (com a junção do contrato), `POST /api/documentos-lidos/:id/liberar`, `/mover` e `/cadastro`; as leituras no `GET /api/recepcao`; testes.
- [x] 125.61 Telas: envio pelo card, lote, recebimento, conferência, quarentena, mover e cadastro chamando a API para as fichas do servidor; as leituras do servidor na cópia; testes.
- [x] 125.62 Playwright: o RG enviado pelo card numa sessão é conferido e arquivado em outra.
- [x] 125.63 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

### Bloco 5b+ · O arquivo do card guardado e o laudo novo no parecer (pedido do Pedro, 09/10)

- [x] 125.64 Servidor: `POST /api/fichas/:id/arquivos/conteudo` (arquivo e hash): só arquivo já anunciado no envio e com o hash conferido; guarda no armazenamento do portal como `documento` da pessoa e do caso (sensível se for médico) e, para laudo, relatório médico e prontuário com caso, o `documento_medico` não conferido; o mesmo conteúdo duas vezes não duplica; testes.
- [x] 125.65 Telas: `enviarArquivos` manda o conteúdo de cada arquivo depois do envio, para as fichas do servidor; `ConferirEnviar` passa os arquivos; testes.
- [x] 125.66 Rodar typecheck, lint, testes e Playwright; colar a saída.

### Bloco 5c · Checklist, boas-vindas e cobrança no servidor

- [x] 125.67 Telas do Pedro: a tabela de nomes do kit, o kit como lista do benefício, os documentos e os complementares do caso e o contrato assinado vão para `regras/checklist.ts`, para o servidor usar os mesmos; testes.
- [x] 125.68 Banco: `conferencia_checklist`, `boas_vindas` e `cobranca_documento` e a migração 0024; matriz 23 com `cobranca.decidir` (só a Sênior).
- [x] 125.69 Contratos: a tentativa, o adiamento e a decisão da cobrança.
- [x] 125.70 Servidor: `GET /api/processos/:id/checklist` e `POST .../checklist/conferencia` (o kit vigente do escritório; os documentos lidos e arquivados, o contrato, o acidente e a criança do banco; a incompleta abre a cobrança); o checklist de cada caso no `GET /api/recepcao`; testes.
- [x] 125.71 Servidor: a liberação (G1) do caso da Recepção confere esse checklist (a última conferência completa e o de agora completo); testes.
- [x] 125.72 Servidor: `GET` e `POST /api/processos/:id/boas-vindas` ("Já enviei": uma vez por cliente novo, depois do checklist conferido; histórico e contatos); os registros no `GET /api/recepcao`; testes.
- [x] 125.73 Servidor: `GET /api/processos/:id/cobranca`, `POST .../tentativas`, `/adiamento` e `/decisao` (só a Sênior, no limite, com justificativa); a cobrança fecha sozinha quando chega tudo; as cobranças no `GET /api/recepcao`; testes.
- [x] 125.74 Telas: checklist, boas-vindas ("Enviar boas-vindas" na Central da Atendimento, a mensagem para copiar e "Já enviei") e cobrança chamando a API para os casos do servidor; o checklist, os registros e as cobranças do servidor na cópia; testes.
- [x] 125.75 Playwright: a Documentação confere o checklist incompleto de um caso do servidor; em outra sessão, a Atendimento vê "Cobrar documento" e registra a tentativa.
- [x] 125.76 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?".

### Bloco 6 · A primeira liberação ao Jurídico no servidor (pedido do Pedro, 09/10; números 125.90 em diante para não colidir com o 5c)

- [x] 125.90 Telas: `liberarAoJuridico` (dados/liberacao.ts), para o caso do servidor, chama `POST /api/casos/:id/liberacao` depois das conferências da tela e só grava a liberação aqui se o servidor aceitar; `tarefasDaFilaDaSenior` não repete o caso do servidor (a Central da Sênior já traz o D2.01 do servidor); testes.
- [x] 125.91 Rodar typecheck, lint e testes; colar a saída.
