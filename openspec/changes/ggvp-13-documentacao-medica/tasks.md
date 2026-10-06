# Tasks

<!-- Grupo 1: roteiro, classificação, parecer, complemento e portão. -->

## GGVP-93 · Roteiro de conteúdo mínimo por benefício

- [x] 1.1 Contrato: tipos do roteiro em `apps/web/src/regras/roteiro.ts` (`TipoDoItem`, `ItemDoRoteiro`, `VersaoDoRoteiro`, `Roteiro`) e `roteiros?` no `Banco` de `servidor.ts`, acrescentado no fim. Verifica com `pnpm typecheck`.
- [x] 1.2 Regra: `emVigor`, `roteiroDoBeneficio` (um roteiro para vários benefícios; fora de todos, "sem roteiro"), `versao`, `novaVersao` e `motivoParaNaoSalvar` em `src/regras/roteiro.ts`, com teste em `src/regras/roteiro.test.ts` (CA1, CA2, CA3). Verifica com `pnpm vitest run src/regras/roteiro.test.ts`.
- [x] 1.3 Servidor de exemplo: a semente da matriz de `docs/requisitos/roteiro-laudos.md` e da resposta do Lucas de 01/10, `obterRoteiros`, `obterRoteiro`, `roteiroDoCaso` e `salvarRoteiro` (só a sênior; nova versão com autor e data; valida de novo) em `src/dados/roteiro.ts`, com teste em `src/dados/roteiro.test.ts` (CA1, CA2, CA3). Verifica com `pnpm vitest run src/dados/roteiro.test.ts`.
- [x] 1.4 Tela `/roteiros` e `/roteiros/:id` (`src/paginas/Roteiro.tsx`): a lista, os itens por tipo com o texto do escritório, "Editar" para a sênior, "Salvar nova versão" com a trava, as versões anteriores com autor e data, e o aviso para quem não é do Jurídico; rotas em `App.tsx`. Teste em `Roteiro.test.tsx` e `App.test.tsx` (CA1, CA2). Verifica com `pnpm vitest run src/paginas/Roteiro.test.tsx src/App.test.tsx`.
- [x] 1.5 Playwright `e2e/roteiro.e2e.ts`: a sênior abre o roteiro do LOAS Deficiente, edita um item e salva a versão 2; a advogada vê sem editar; o Atendimento não vê (CA1, CA2); tema escuro e fonte grande. Verifica com `PORTA_E2E_API=3193 PORTA_E2E_WEB=5193 pnpm exec playwright test roteiro`.
- [ ] 1.6 Ligar no servidor: trocar o corpo de `src/dados/roteiro.ts` por `fetch` nos endpoints da design e tirar o perfil da sessão. Depende do banco do Mateus. **Fica aberta nesta história.**
- [ ] 1.7 CA3 e CA4 na tela: o aviso "benefício sem roteiro" com a conferência manual, e a versão usada no parecer refeito, aparecem na tela do parecer (GGVP-20, tarefa 3.x). A regra fica pronta aqui.
- [ ] 1.8 Rodar typecheck, lint, testes e Playwright; colar a saída; perguntar "Agora ok?" (no fim do grupo 1).

## GGVP-95 · Classificar cada documento médico que entra

- [x] 2.1 Contrato: os sete tipos médicos no fim de `TIPOS_DE_DOCUMENTO` (`catalogos.ts`), `TIPOS_MEDICOS` em `regras/leitura.ts`, e `emitente`, `registro`, `sugerido`, a situação "ilegivel" e `ilegiveis` na conferência em `dados/leitura.ts`. Verifica com `pnpm typecheck`.
- [x] 2.2 Regra: as pistas dos tipos médicos em `regras/arquivos.ts` e `ehMedico` com os novos tipos, com teste em `regras/regras.test.ts` e `regras/leitura.test.ts` (CA1). Verifica com `pnpm vitest run src/regras/regras.test.ts src/regras/leitura.test.ts`.
- [x] 2.3 Servidor de exemplo: em `dados/leitura.ts`, o emitente e o registro do laudo da pilha da Rita e do que sobe pelo card, a correção da classificação no histórico, o ilegível fora da conferência e `tarefasDePedirLegivel`, com teste em `dados/leitura.test.ts` (CA1 a CA10 com documento médico). Verifica com `pnpm vitest run src/dados/leitura.test.ts`.
- [x] 2.4 Tela `/clientes/:id/conferir-documentos` (`ConferirDocumentos.tsx`, Figma `10:466`): o documento médico com tipo, data de emissão, emitente e registro, sem o conteúdo; a correção pelo "Reclassificar"; o bloco dos ilegíveis; a Central do Atendimento com "Pedir documento legível". Teste em `ConferirDocumentos.test.tsx` e `CentralAtendimento.test.tsx` (CA1, CA2, CA3). Verifica com `pnpm vitest run src/paginas/ConferirDocumentos.test.tsx src/paginas/CentralAtendimento.test.tsx`.
- [x] 2.5 Playwright `e2e/documento-medico.e2e.ts`: o laudo da Rita com o emitente e o CRM, reclassificado e arquivado, a correção no histórico (CA1, CA2, CA10); o laudo ilegível que sobe pelo card vira "Pedir documento legível" na Central (CA3); tema escuro e fonte grande. Verifica com `PORTA_E2E_API=3193 PORTA_E2E_WEB=5193 pnpm exec playwright test documento-medico`.
- [ ] 2.6 Ligar no servidor: a IA de verdade lê o emitente e o registro e marca a leitura que falhou; o corpo de `dados/leitura.ts` vira `fetch`. Depende do GGVP-118 e do banco do Mateus. **Fica aberta nesta história.**

<!-- Fim do grupo 1. -->

<!-- Grupo 2: PCD, Auxílio-Acidente e LOAS de menor de 16 anos. -->

<!-- Fim do grupo 2. -->
